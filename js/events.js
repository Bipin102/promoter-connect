import { db, serverTimestamp } from "./firebase-init.js";
import {
  collection, doc, getDoc, getDocs, updateDoc, query, where, onSnapshot, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { pushNotification } from "./notifications.js";

export const URGENT_WINDOW_MS = 60 * 60 * 1000;

export async function postEvent(companyId, data) {
  const isUrgent = data.hiringType === "urgent";
  const payload = {
    companyId,
    eventName: data.eventName,
    brand: data.brand || "",
    category: data.category || "",
    date: data.date,
    startTime: data.startTime,
    endTime: data.endTime,
    location: data.location,
    locationGeo: data.locationGeo || null,
    positionsRequired: Number(data.positionsRequired) || 1,
    positionsFilled: 0,
    genderReq: data.genderReq || "",
    ageReq: data.ageReq || "",
    experienceReq: data.experienceReq || "",
    skillsReq: data.skillsReq || [],
    dressCode: data.dressCode || "",
    description: data.description || "",
    paymentAmount: Number(data.paymentAmount) || 0,
    paymentType: data.paymentType || "per_event",
    specialInstructions: data.specialInstructions || "",
    contactPerson: data.contactPerson || "",
    hiringType: data.hiringType, // 'normal' | 'urgent'
    status: "open", // open -> fulfilled | window_ended -> completed | cancelled
    urgentStartedAt: isUrgent ? serverTimestamp() : null,
    urgentDeadlineMs: isUrgent ? Date.now() + URGENT_WINDOW_MS : null,
    fulfilledAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = doc(collection(db, "events"));
  await runTransaction(db, async (tx) => {
    const companyRef = doc(db, "companies", companyId);
    const company = await tx.get(companyRef);
    tx.set(ref, payload);
    if (company.exists()) tx.update(companyRef, { eventsPosted: (company.data().eventsPosted || 0) + 1, lastPostedEventId: ref.id });
  });
  await notifyPromotersOfNewEvent(payload).catch(() => {});
  return ref.id;
}

/** Puts the new gig in every promoter's notification bell. */
async function notifyPromotersOfNewEvent(event) {
  const promoters = await getDocs(collection(db, "promoters"));
  const ids = promoters.docs.map((d) => d.id).filter((id) => !id.startsWith("demo_"));
  const pay = `₹${Number(event.paymentAmount || 0).toLocaleString("en-IN")}`;
  const date = new Date(`${event.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const note = {
    type: "new_event",
    title: (event.hiringType === "urgent" ? "Urgent gig: " : "New gig: ") + event.eventName.slice(0, 100),
    message: `${event.location} · ${date} · ${pay}`.slice(0, 500),
    link: `/promoter/jobs?q=${encodeURIComponent(event.eventName)}`,
    read: false,
  };
  // Firestore batches cap at 500 writes.
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((userId) => batch.set(doc(collection(db, "notifications")), { ...note, userId, createdAt: serverTimestamp() }));
    await batch.commit();
  }
}

export async function getEvent(eventId) {
  const s = await getDoc(doc(db, "events", eventId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function reopenUrgentEvent(eventId) {
  await updateDoc(doc(db, "events", eventId), { status: "open", urgentDeadlineMs: Date.now() + URGENT_WINDOW_MS, updatedAt: serverTimestamp() });
}

export function watchEvent(eventId, cb) {
  return onSnapshot(doc(db, "events", eventId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

export async function listOpenEvents(filters = {}) {
  // Sorted client-side: an "in" filter plus orderBy(createdAt) would need a composite index.
  const snap = await getDocs(query(collection(db, "events"), where("status", "in", ["open", "fulfilled"])));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  if (filters.hiringType) list = list.filter((e) => e.hiringType === filters.hiringType);
  if (filters.location) list = list.filter((e) => (e.location || "").toLowerCase().includes(filters.location.toLowerCase()));
  if (filters.category) list = list.filter((e) => (e.category || "").toLowerCase().includes(filters.category.toLowerCase()));
  if (filters.date) list = list.filter((e) => e.date === filters.date);
  if (filters.minPayment) list = list.filter((e) => e.paymentAmount >= Number(filters.minPayment));
  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    list = list.filter((e) =>
      (e.eventName || "").toLowerCase().includes(kw) ||
      (e.brand || "").toLowerCase().includes(kw) ||
      (e.category || "").toLowerCase().includes(kw) ||
      (e.location || "").toLowerCase().includes(kw)
    );
  }
  return list;
}

export async function listCompanyEvents(companyId) {
  // Sorted client-side to avoid needing a composite index.
  const snap = await getDocs(query(collection(db, "events"), where("companyId", "==", companyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

/** Moves an urgent event whose hour ran out to window_ended. There's no backend job,
 *  so whichever client sees it first makes the change. */
export async function reconcileUrgentWindow(event) {
  if (
    event.hiringType === "urgent" &&
    event.status === "open" &&
    event.urgentDeadlineMs &&
    Date.now() > event.urgentDeadlineMs
  ) {
    // Signed-out visitors can't write; they still get the corrected status locally.
    await updateDoc(doc(db, "events", event.id), { status: "window_ended", updatedAt: serverTimestamp() }).catch(() => {});
    return { ...event, status: "window_ended" };
  }
  return event;
}

/** Cancels the event and every active booking on it, and tells each booked promoter. */
export async function cancelEvent(event) {
  await updateDoc(doc(db, "events", event.id), { status: "cancelled", updatedAt: serverTimestamp() });
  const snap = await getDocs(query(collection(db, "bookings"), where("eventId", "==", event.id)));
  const active = snap.docs.filter((d) => ["booked", "on_the_way", "checked_in", "active"].includes(d.data().status));
  await Promise.all(active.map(async (d) => {
    await updateDoc(d.ref, { status: "cancelled", updatedAt: serverTimestamp() });
    await pushNotification(d.data().promoterId, {
      type: "event_cancelled",
      title: "Event cancelled",
      message: `${event.eventName} on ${event.date} was cancelled by the company.`,
      link: "/promoter/bookings",
    });
  }));
  return active.length;
}

