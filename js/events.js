import { db, serverTimestamp } from "./firebase-init.js";
import {
  collection, doc, getDoc, getDocs, updateDoc, query, where, onSnapshot, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { pushNotification } from "./notifications.js";
import { hasEnded } from "./render.js";

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

/** Fields a company can change after posting. Hiring type stays as posted. */
const EDITABLE = ["eventName", "brand", "category", "date", "startTime", "endTime", "location", "locationGeo",
  "positionsRequired", "genderReq", "ageReq", "experienceReq", "skillsReq", "dressCode", "description",
  "paymentAmount", "paymentType", "specialInstructions", "contactPerson"];
/** What a booking copies from its event, so a promoter's booking shows the new details. */
const BOOKING_COPY = ["eventName", "brand", "date", "startTime", "endTime", "location", "paymentAmount"];
/** Changes promoters should hear about. */
const NOTEWORTHY = { date: "date", startTime: "time", endTime: "time", location: "venue", paymentAmount: "pay", paymentType: "pay", eventName: "name" };

export function canEditEvent(event) {
  return ["open", "fulfilled", "window_ended"].includes(event.status) && !hasEnded(event);
}

/**
 * Saves a company's edits. Keeps the filled count, reopens a full gig that
 * gained spots (or closes one that now has none left), brings every active
 * booking in line, and tells booked and waiting promoters what changed.
 * Returns how many promoters were told.
 */
export async function updateEvent(event, data) {
  const changes = {};
  for (const key of EDITABLE) {
    let value = data[key];
    if (value === undefined) continue;
    if (key === "positionsRequired") value = Number(value) || 1;
    if (key === "paymentAmount") value = Number(value) || 0;
    if (JSON.stringify(value ?? null) !== JSON.stringify(event[key] ?? null)) changes[key] = value;
  }
  if (!Object.keys(changes).length) return { changed: false, notified: 0 };

  const filled = event.positionsFilled || 0;
  const required = changes.positionsRequired ?? event.positionsRequired;
  if (required < filled) throw new Error("BELOW_FILLED");
  if (event.status === "fulfilled" && required > filled) { changes.status = "open"; changes.fulfilledAt = null; }
  if (event.status === "open" && required === filled) { changes.status = "fulfilled"; changes.fulfilledAt = serverTimestamp(); }

  await updateDoc(doc(db, "events", event.id), { ...changes, updatedAt: serverTimestamp() });
  const after = { ...event, ...changes };

  const bookingChanges = Object.fromEntries(BOOKING_COPY.filter((k) => k in changes).map((k) => [k, after[k] ?? ""]));
  const [bookingSnap, appSnap] = await Promise.all([
    getDocs(query(collection(db, "bookings"), where("eventId", "==", event.id), where("companyId", "==", event.companyId))),
    getDocs(query(collection(db, "applications"), where("eventId", "==", event.id))),
  ]);
  const active = bookingSnap.docs.filter((d) => ["booked", "on_the_way", "checked_in"].includes(d.data().status));
  if (Object.keys(bookingChanges).length) {
    await Promise.all(active.map((d) => updateDoc(d.ref, { ...bookingChanges, updatedAt: serverTimestamp() }).catch(() => {})));
  }

  const what = [...new Set(Object.keys(changes).map((k) => NOTEWORTHY[k]).filter(Boolean))];
  if (!what.length) return { changed: true, notified: 0 };
  const list = what.length > 1 ? `${what.slice(0, -1).join(", ")} and ${what.at(-1)}` : what[0];
  const date = new Date(`${after.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const summary = `${after.location} · ${date} · ₹${Number(after.paymentAmount || 0).toLocaleString("en-IN")}`;
  const waiting = appSnap.docs.filter((d) => d.data().status === "pending").map((d) => [d.data().promoterId, `/promoter/jobs?event=${event.id}`]);
  const booked = active.map((d) => [d.data().promoterId, "/promoter/bookings"]);
  const people = new Map([...waiting, ...booked]);
  await Promise.all([...people].map(([userId, link]) => pushNotification(userId, {
    type: "event_updated",
    title: `${after.eventName.slice(0, 90)}: ${list} changed`,
    message: `Now: ${summary}`.slice(0, 500),
    link,
  }).catch(() => {})));
  return { changed: true, notified: people.size };
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
  // A gig whose day is over isn't open any more, whatever its status says.
  return list.filter((e) => !hasEnded(e));
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

