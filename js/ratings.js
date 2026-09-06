import { db, serverTimestamp } from "./firebase-init.js";
import {
  doc, getDoc, setDoc, runTransaction, collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { pushNotification } from "./notifications.js";

const PROMOTER_CATEGORIES = ["professionalism", "punctuality", "communication", "workQuality"];
const COMPANY_CATEGORIES = ["professionalism", "communication", "workEnvironment", "paymentExperience"];

export function categoriesFor(fromRole) {
  return fromRole === "company" ? PROMOTER_CATEGORIES : COMPANY_CATEGORIES;
}

function average(obj) {
  const vals = Object.values(obj).filter((v) => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/**
 * fromRole: 'company' (rating a promoter) | 'promoter' (rating a company).
 * Only allowed once the booking is COMPLETED, and only once per side (deterministic doc id).
 */
export async function submitRating(booking, fromRole, categories, comment = "") {
  if (booking.status !== "completed") throw new Error("NOT_ELIGIBLE");

  const ratingId = `${booking.id}_${fromRole}`;
  const ratingRef = doc(db, "ratings", ratingId);
  const existing = await getDoc(ratingRef);
  if (existing.exists()) throw new Error("ALREADY_RATED");

  const toId = fromRole === "company" ? booking.promoterId : booking.companyId;
  const toRole = fromRole === "company" ? "promoter" : "company";
  const overall = average(categories);

  await setDoc(ratingRef, {
    bookingId: booking.id,
    eventId: booking.eventId,
    fromId: fromRole === "company" ? booking.companyId : booking.promoterId,
    fromRole,
    toId,
    toRole,
    categories,
    overall,
    comment,
    createdAt: serverTimestamp(),
  });

  const targetCollection = toRole === "promoter" ? "promoters" : "companies";
  await runTransaction(db, async (tx) => {
    const tRef = doc(db, targetCollection, toId);
    const tSnap = await tx.get(tRef);
    if (!tSnap.exists()) return;
    const data = tSnap.data();
    const prevCount = data.ratingCount || 0;
    const prevAvg = data.ratingAvg || 0;
    const newCount = prevCount + 1;
    const newAvg = (prevAvg * prevCount + overall) / newCount;
    tx.update(tRef, { ratingAvg: newAvg, ratingCount: newCount });
  });

  await pushNotification(toId, {
    type: "new_rating",
    title: "⭐ You Received a New Rating",
    message: `You received a ${overall.toFixed(1)}★ rating for "${booking.eventName}".`,
    link: toRole === "promoter" ? "/promoter/ratings.html" : "/company/dashboard.html",
  });
}

export async function hasRated(bookingId, fromRole) {
  const s = await getDoc(doc(db, "ratings", `${bookingId}_${fromRole}`));
  return s.exists();
}

export async function listRatingsFor(toId) {
  const snap = await getDocs(query(collection(db, "ratings"), where("toId", "==", toId), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
