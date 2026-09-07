import { db, serverTimestamp } from "./firebase-init.js";
import {
  collection, addDoc, doc, getDoc, getDocs, updateDoc, query, where, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { pushNotification } from "./notifications.js";

export const URGENT_WINDOW_MS = 60 * 60 * 1000; // the core 1-hour fulfillment USP

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
    locationGeo: data.locationGeo || null, // optional {lat,lng} captured at posting time, powers reachability matching
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
  const ref = await addDoc(collection(db, "events"), payload);
  await updateDoc(doc(db, "companies", companyId), {}); // no-op keeps rules happy on some setups
  return ref.id;
}

export async function getEvent(eventId) {
  const s = await getDoc(doc(db, "events", eventId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export function watchEvent(eventId, cb) {
  return onSnapshot(doc(db, "events", eventId), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

export async function listOpenEvents(filters = {}) {
  const snap = await getDocs(query(collection(db, "events"), orderBy("createdAt", "desc")));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list = list.filter((e) => e.status === "open" || e.status === "fulfilled");
  if (filters.hiringType) list = list.filter((e) => e.hiringType === filters.hiringType);
  if (filters.location) list = list.filter((e) => (e.location || "").toLowerCase().includes(filters.location.toLowerCase()));
  if (filters.category) list = list.filter((e) => e.category === filters.category);
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
  // Sorted client-side so this doesn't depend on a manually-created composite index
  // (where(companyId) + orderBy(createdAt) on different fields needs one otherwise).
  const snap = await getDocs(query(collection(db, "events"), where("companyId", "==", companyId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}

/** Client-side correction for urgent jobs whose 1-hour window elapsed without full fulfillment.
 *  (A production build would run this via a scheduled Cloud Function; here any viewer's client
 *  performs the honest state transition the moment the deadline is detected.) */
export async function reconcileUrgentWindow(event) {
  if (
    event.hiringType === "urgent" &&
    event.status === "open" &&
    event.urgentDeadlineMs &&
    Date.now() > event.urgentDeadlineMs
  ) {
    await updateDoc(doc(db, "events", event.id), { status: "window_ended", updatedAt: serverTimestamp() });
    return { ...event, status: "window_ended" };
  }
  return event;
}

export async function cancelEvent(eventId) {
  await updateDoc(doc(db, "events", eventId), { status: "cancelled", updatedAt: serverTimestamp() });
}

export async function markEventCompleted(eventId) {
  await updateDoc(doc(db, "events", eventId), { status: "completed", updatedAt: serverTimestamp() });
}

export { pushNotification };
