import { db, serverTimestamp } from "./firebase-init.js";
import {
  doc, getDoc, runTransaction, collection, getDocs, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { pushNotification } from "./notifications.js";

const PROMOTER_CATEGORIES = ["professionalism", "punctuality", "communication", "workQuality"];
const COMPANY_CATEGORIES = ["professionalism", "communication", "workEnvironment", "paymentExperience"];

export const CATEGORY_LABELS = {
  professionalism: "Professionalism",
  punctuality: "Punctuality",
  communication: "Communication",
  workQuality: "Quality of work",
  workEnvironment: "Work environment",
  paymentExperience: "Payment",
};

export function categoriesFor(fromRole) {
  return fromRole === "company" ? PROMOTER_CATEGORIES : COMPANY_CATEGORIES;
}

function average(obj) {
  const vals = Object.values(obj).filter((v) => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/** fromRole is who is rating. One rating per side per completed booking (the doc id enforces it). */
export async function submitRating(booking, fromRole, categories, comment = "") {
  if (booking.status !== "completed") throw new Error("NOT_ELIGIBLE");

  const ratingId = `${booking.id}_${fromRole}`;
  const ratingRef = doc(db, "ratings", ratingId);
  const toId = fromRole === "company" ? booking.promoterId : booking.companyId;
  const toRole = fromRole === "company" ? "promoter" : "company";
  const overall = average(categories);
  const targetRef = doc(db, toRole === "promoter" ? "promoters" : "companies", toId);

  // The rating and the running average change together; the security rules
  // only accept an average update that comes with a brand-new rating.
  await runTransaction(db, async (tx) => {
    const [existing, target] = [await tx.get(ratingRef), await tx.get(targetRef)];
    if (existing.exists()) throw new Error("ALREADY_RATED");
    tx.set(ratingRef, {
      bookingId: booking.id,
      eventId: booking.eventId,
      fromId: fromRole === "company" ? booking.companyId : booking.promoterId,
      fromRole,
      toId,
      toRole,
      categories,
      overall,
      comment: comment.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
    if (!target.exists()) return;
    const prevCount = target.data().ratingCount || 0;
    const prevAvg = target.data().ratingAvg || 0;
    tx.update(targetRef, {
      ratingAvg: (prevAvg * prevCount + overall) / (prevCount + 1),
      ratingCount: prevCount + 1,
      lastRatingId: ratingId,
    });
  });

  await pushNotification(toId, {
    type: "new_rating",
    title: "New rating",
    message: `You were rated ${overall.toFixed(1)} out of 5 for ${booking.eventName}.`,
    link: toRole === "promoter" ? "/promoter/ratings" : "/company/dashboard",
  });
}

export async function hasRated(bookingId, fromRole) {
  const s = await getDoc(doc(db, "ratings", `${bookingId}_${fromRole}`));
  return s.exists();
}

export async function listRatingsFor(toId) {
  // Sorted client-side to avoid needing a composite index.
  const snap = await getDocs(query(collection(db, "ratings"), where("toId", "==", toId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
}
