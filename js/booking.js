import { db, serverTimestamp } from "./firebase-init.js";
import {
  doc, runTransaction, collection, addDoc, setDoc, getDocs, getDoc, query, where,
  updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { pushNotification } from "./notifications.js";

function generateBookingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PC-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export const BOOKING_ERRORS = {
  ALREADY_BOOKED: "You already have a booking for this event.",
  WINDOW_CLOSED: "This requirement is no longer accepting bookings.",
  FULL: "Sorry, all promoter positions for this event have now been filled.",
  NOT_FOUND: "This event no longer exists.",
};

/**
 * Atomic instant-booking for urgent (and normal) positions.
 * Uses a deterministic booking doc id (`${eventId}_${promoterId}`) so the
 * transaction can check "already booked" and "slot available" with plain
 * document reads/writes only — no query is needed inside the transaction,
 * which keeps this safe under concurrent BOOK NOW clicks from many promoters.
 */
export async function bookPosition(eventId, promoter) {
  const eventRef = doc(db, "events", eventId);
  const bookingId = `${eventId}_${promoter.uid}`;
  const bookingRef = doc(db, "bookings", bookingId);

  const result = await runTransaction(db, async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists()) throw new Error("NOT_FOUND");
    const event = eventSnap.data();

    const existing = await tx.get(bookingRef);
    if (existing.exists()) throw new Error("ALREADY_BOOKED");

    const windowExpired =
      event.hiringType === "urgent" && event.urgentDeadlineMs && Date.now() > event.urgentDeadlineMs;
    if (windowExpired) throw new Error("WINDOW_CLOSED");
    if (event.status !== "open") throw new Error(event.status === "fulfilled" ? "FULL" : "WINDOW_CLOSED");
    if ((event.positionsFilled || 0) >= event.positionsRequired) throw new Error("FULL");

    const newFilled = (event.positionsFilled || 0) + 1;
    const isNowFull = newFilled >= event.positionsRequired;

    tx.update(eventRef, {
      positionsFilled: newFilled,
      status: isNowFull ? "fulfilled" : "open",
      fulfilledAt: isNowFull ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });

    const bookingCode = generateBookingCode();
    tx.set(bookingRef, {
      eventId,
      companyId: event.companyId,
      promoterId: promoter.uid,
      promoterName: promoter.fullName,
      eventName: event.eventName,
      brand: event.brand,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      paymentAmount: event.paymentAmount,
      status: "booked",
      paymentStatus: "pending",
      bookingCode,
      bookedAt: serverTimestamp(),
    });

    return { bookingCode, newFilled, positionsRequired: event.positionsRequired, isNowFull, event };
  });

  await pushNotification(result.event.companyId, {
    type: "booking_confirmed",
    title: "👤 New Promoter Confirmed",
    message: `${promoter.fullName} confirmed a position for "${result.event.eventName}" (${result.newFilled}/${result.positionsRequired}).`,
    link: `/company/event.html?id=${eventId}`,
  });
  if (result.isNowFull) {
    await pushNotification(result.event.companyId, {
      type: "fulfilled",
      title: "✅ Requirement Fully Fulfilled",
      message: `All ${result.positionsRequired} promoter positions for "${result.event.eventName}" are confirmed.`,
      link: `/company/event.html?id=${eventId}`,
    });
  }

  return { bookingId, ...result };
}

/** Normal-job application (no slot race — reviewed manually by the company). */
export async function applyToEvent(eventId, promoter) {
  const appId = `${eventId}_${promoter.uid}`;
  const appRef = doc(db, "applications", appId);
  const existing = await getDoc(appRef);
  if (existing.exists()) throw new Error("ALREADY_APPLIED");

  const eventSnap = await getDoc(doc(db, "events", eventId));
  if (!eventSnap.exists()) throw new Error("NOT_FOUND");
  const event = eventSnap.data();

  await setDoc(appRef, {
    eventId, companyId: event.companyId, promoterId: promoter.uid,
    promoterName: promoter.fullName, eventName: event.eventName,
    status: "pending", appliedAt: serverTimestamp(),
  });

  await pushNotification(event.companyId, {
    type: "new_application",
    title: "🔔 New Application",
    message: `${promoter.fullName} applied for "${event.eventName}".`,
    link: `/company/event.html?id=${eventId}`,
  });
}

export async function listApplicationsForEvent(eventId) {
  const snap = await getDocs(query(collection(db, "applications"), where("eventId", "==", eventId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function respondToApplication(applicationId, decision, promoter) {
  const appRef = doc(db, "applications", applicationId);
  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) throw new Error("NOT_FOUND");
  const application = appSnap.data();

  if (decision === "accepted") {
    const eventId = application.eventId;
    const eventRef = doc(db, "events", eventId);
    const bookingRef = doc(db, "bookings", `${eventId}_${application.promoterId}`);
    await runTransaction(db, async (tx) => {
      const eventSnap = await tx.get(eventRef);
      const event = eventSnap.data();
      if ((event.positionsFilled || 0) >= event.positionsRequired) throw new Error("FULL");
      const newFilled = (event.positionsFilled || 0) + 1;
      const isNowFull = newFilled >= event.positionsRequired;
      tx.update(eventRef, {
        positionsFilled: newFilled,
        status: isNowFull ? "fulfilled" : "open",
        updatedAt: serverTimestamp(),
      });
      tx.update(appRef, { status: "accepted" });
      tx.set(bookingRef, {
        eventId, companyId: event.companyId, promoterId: application.promoterId,
        promoterName: application.promoterName, eventName: event.eventName,
        brand: event.brand, date: event.date, startTime: event.startTime, endTime: event.endTime,
        location: event.location, paymentAmount: event.paymentAmount,
        status: "booked", paymentStatus: "pending",
        bookingCode: generateBookingCode(), bookedAt: serverTimestamp(),
      });
    });
    await pushNotification(application.promoterId, {
      type: "booking_confirmed",
      title: "✅ Booking Confirmed",
      message: `You're booked for "${application.eventName}"!`,
      link: `/promoter/bookings.html`,
    });
  } else {
    await updateDoc(appRef, { status: "rejected" });
  }
}

export async function listPromoterBookings(promoterId) {
  // Sorted client-side (not via a Firestore orderBy) so this never depends on a
  // manually-created composite index — where(promoterId) + orderBy(bookedAt) on
  // different fields would otherwise fail at query time until one exists.
  const snap = await getDocs(query(collection(db, "bookings"), where("promoterId", "==", promoterId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byTimestampDesc("bookedAt"));
}

function byTimestampDesc(field) {
  return (a, b) => (b[field]?.toMillis?.() || 0) - (a[field]?.toMillis?.() || 0);
}

export async function listCompanyBookingsForEvent(eventId) {
  const snap = await getDocs(query(collection(db, "bookings"), where("eventId", "==", eventId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchCompanyBookingsForEvent(eventId, cb) {
  const q = query(collection(db, "bookings"), where("eventId", "==", eventId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function getBooking(bookingId) {
  const s = await getDoc(doc(db, "bookings", bookingId));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function updateBookingStatus(bookingId, status) {
  await updateDoc(doc(db, "bookings", bookingId), { status, updatedAt: serverTimestamp() });
}

/** Company marks the whole event as done: flips active bookings to COMPLETED and
 *  bumps each side's "events completed" counter (which feeds badges + ratings eligibility). */
export async function completeEvent(eventId) {
  const bookingsSnap = await getDocs(query(collection(db, "bookings"), where("eventId", "==", eventId)));
  const bookings = bookingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const active = bookings.filter((b) => ["booked", "on_the_way", "checked_in", "active"].includes(b.status));

  await Promise.all(active.map((b) => updateDoc(doc(db, "bookings", b.id), { status: "completed", updatedAt: serverTimestamp() })));

  await Promise.all(active.map((b) =>
    runTransaction(db, async (tx) => {
      const pRef = doc(db, "promoters", b.promoterId);
      const pSnap = await tx.get(pRef);
      if (pSnap.exists()) tx.update(pRef, { eventsCompleted: (pSnap.data().eventsCompleted || 0) + 1 });
    })
  ));

  if (active.length) {
    const companyId = active[0].companyId;
    await runTransaction(db, async (tx) => {
      const cRef = doc(db, "companies", companyId);
      const cSnap = await tx.get(cRef);
      if (cSnap.exists()) tx.update(cRef, { eventsCompleted: (cSnap.data().eventsCompleted || 0) + 1 });
    });
  }

  await updateDoc(doc(db, "events", eventId), { status: "completed", updatedAt: serverTimestamp() });
  return active;
}

export async function cancelBooking(bookingId, eventId) {
  const eventRef = doc(db, "events", eventId);
  const bookingRef = doc(db, "bookings", bookingId);
  await runTransaction(db, async (tx) => {
    const eventSnap = await tx.get(eventRef);
    const event = eventSnap.data();
    tx.update(bookingRef, { status: "cancelled", updatedAt: serverTimestamp() });
    tx.update(eventRef, {
      positionsFilled: Math.max(0, (event.positionsFilled || 1) - 1),
      status: "open",
      updatedAt: serverTimestamp(),
    });
  });
}
