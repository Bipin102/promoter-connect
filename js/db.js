import { db, serverTimestamp } from "./firebase-init.js";
import {
  doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where,
  orderBy, limit as fsLimit, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getPromoter(uid) {
  const s = await getDoc(doc(db, "promoters", uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function getCompany(uid) {
  const s = await getDoc(doc(db, "companies", uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function updatePromoter(uid, data) {
  await updateDoc(doc(db, "promoters", uid), { ...data, updatedAt: serverTimestamp() });
}

export async function updateCompany(uid, data) {
  await updateDoc(doc(db, "companies", uid), { ...data, updatedAt: serverTimestamp() });
}

export async function listPromoters(filters = {}) {
  const snap = await getDocs(collection(db, "promoters"));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (filters.city) list = list.filter((p) => (p.city || "").toLowerCase().includes(filters.city.toLowerCase()));
  if (filters.gender) list = list.filter((p) => p.gender === filters.gender);
  if (filters.minRating) list = list.filter((p) => (p.ratingAvg || 0) >= Number(filters.minRating));
  if (filters.skill) list = list.filter((p) => (p.skills || []).some((s) => s.toLowerCase().includes(filters.skill.toLowerCase())));
  if (filters.language) list = list.filter((p) => (p.languages || []).some((l) => l.toLowerCase().includes(filters.language.toLowerCase())));
  if (filters.verifiedOnly) list = list.filter((p) => p.verified);
  if (filters.availability) list = list.filter((p) => p.availability === filters.availability);
  list.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
  return list;
}

export async function addPortfolioImage(uid, url) {
  return addDoc(collection(db, "promoters", uid, "portfolio"), { url, createdAt: serverTimestamp() });
}

export async function listPortfolio(uid) {
  const snap = await getDocs(query(collection(db, "promoters", uid, "portfolio"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function removePortfolioImage(uid, imgId) {
  await deleteDoc(doc(db, "promoters", uid, "portfolio", imgId));
}

export { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, orderBy, fsLimit };
