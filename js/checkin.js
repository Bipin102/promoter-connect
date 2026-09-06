import { db, serverTimestamp } from "./firebase-init.js";
import { doc, addDoc, collection, getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { uploadImage } from "./storage.js";
import { pushNotification } from "./notifications.js";

function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000 }
    );
  });
}

/**
 * Submits a live event check-in: uploads the proof photo, captures an optional
 * GPS location, timestamps the submission, and flips the booking to CHECKED IN.
 */
export async function submitCheckIn(booking, photoFile) {
  const location = await getLocation();
  const photoURL = await uploadImage(`checkins/${booking.id}/${Date.now()}.jpg`, photoFile);

  const checkInRef = await addDoc(collection(db, "liveCheckIns"), {
    bookingId: booking.id,
    eventId: booking.eventId,
    promoterId: booking.promoterId,
    promoterName: booking.promoterName,
    companyId: booking.companyId,
    photoURL,
    location,
    timestamp: serverTimestamp(),
    status: "arrived",
  });

  await updateDoc(doc(db, "bookings", booking.id), { status: "checked_in", updatedAt: serverTimestamp() });

  await pushNotification(booking.companyId, {
    type: "checked_in",
    title: "📸 Promoter Checked In",
    message: `${booking.promoterName} just checked in live at "${booking.eventName}".`,
    link: `/company/event.html?id=${booking.eventId}`,
  });

  return checkInRef.id;
}

export async function listCheckInsForEvent(eventId) {
  const snap = await getDocs(query(collection(db, "liveCheckIns"), where("eventId", "==", eventId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listCheckInsForBooking(bookingId) {
  const snap = await getDocs(query(collection(db, "liveCheckIns"), where("bookingId", "==", bookingId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
