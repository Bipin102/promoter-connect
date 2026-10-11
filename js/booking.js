import { db, serverTimestamp } from "./firebase-init.js";
import {
  doc, runTransaction, collection, setDoc, getDocs, getDoc, query, where,
  updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { pushNotification } from "./notifications.js";
import { grantPayoutAccess } from "./payouts.js";

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
 * The booking id is `${eventId}_${promoterId}`, so the transaction can check
 * "already booked" and "spot still free" with document reads alone. Two
 * promoters racing for the last spot can't both get it.
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

  await grantPayoutAccess(bookingId, promoter.uid, result.event.companyId).catch(() => {});
  await pushNotification(result.event.companyId, {
    type: "booking_confirmed",
    title: "New booking",
    message: `${promoter.fullName} booked a spot for ${result.event.eventName} (${result.newFilled} of ${result.positionsRequired} filled).`,
    link: `/company/event?id=${eventId}`,
  });
  if (result.isNowFull) {
    await pushNotification(result.event.companyId, {
      type: "fulfilled",
      title: "Fully staffed",
      message: `All ${result.positionsRequired} spots for ${result.event.eventName} are filled.`,
      link: `/company/event?id=${eventId}`,
    });
  }

  return { bookingId, ...result };
}

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
    title: "New application",
    message: `${promoter.fullName} applied for ${event.eventName}.`,
    link: `/company/event?id=${eventId}`,
  });
}

const byAppliedAt = (a, b) => (a.appliedAt?.toMillis?.() || 0) - (b.appliedAt?.toMillis?.() || 0);

/** Live list of an event's applications, oldest first. */
export function watchApplicationsForEvent(eventId, cb) {
  const q = query(collection(db, "applications"), where("eventId", "==", eventId));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byAppliedAt)));
}

/** Pending application count per event, for a company's lists. */
export async function pendingApplicationCounts(companyId) {
  const snap = await getDocs(query(collection(db, "applications"), where("companyId", "==", companyId)));
  const counts = {};
  snap.docs.forEach((d) => {
    const a = d.data();
    if (a.status === "pending") counts[a.eventId] = (counts[a.eventId] || 0) + 1;
  });
  return counts;
}

/** eventId -> application status, for a promoter's job list. */
export async function promoterApplicationStatuses(promoterId) {
  const snap = await getDocs(query(collection(db, "applications"), where("promoterId", "==", promoterId)));
  return Object.fromEntries(snap.docs.map((d) => [d.data().eventId, d.data().status]));
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
      const current = await tx.get(appRef);
      if (current.data().status !== "pending") throw new Error("ALREADY_DECIDED");
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
    await grantPayoutAccess(bookingRef.id, application.promoterId, application.companyId).catch(() => {});
    await pushNotification(application.promoterId, {
      type: "booking_confirmed",
      title: "You're booked",
      message: `Your application for ${application.eventName} was accepted.`,
      link: `/promoter/bookings`,
    });
  } else {
    await updateDoc(appRef, { status: "rejected" });
    await pushNotification(application.promoterId, {
      type: "application_declined",
      title: "Application not accepted",
      message: `${application.eventName} went with other promoters this time.`,
      link: "/promoter/jobs",
    });
  }
}

/** Accepts pending applications oldest first until the event's spots run out. Returns how many were accepted. */
export async function acceptApplicationsInOrder(applications, spotsLeft) {
  let accepted = 0;
  for (const a of applications.filter((x) => x.status === "pending")) {
    if (accepted >= spotsLeft) break;
    try {
      await respondToApplication(a.id, "accepted");
      accepted++;
    } catch (err) {
      if (err.message === "FULL") break;
      if (err.message !== "ALREADY_DECIDED") throw err;
    }
  }
  return accepted;
}

export async function listPromoterBookings(promoterId) {
  // Sorted client-side to avoid needing a composite index.
  const snap = await getDocs(query(collection(db, "bookings"), where("promoterId", "==", promoterId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byTimestampDesc("bookedAt"));
}

function byTimestampDesc(field) {
  return (a, b) => (b[field]?.toMillis?.() || 0) - (a[field]?.toMillis?.() || 0);
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

/** Closes out an event: completes active bookings and bumps both sides' eventsCompleted. */
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
