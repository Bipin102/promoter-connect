import { db, serverTimestamp } from "./firebase-init.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHTML } from "./ui.js";

// A promoter's phone number lives in contactDetails/{uid}, not on the public
// profile. Like payment details, companies can read it once they've booked
// that promoter (payoutAccess/{promoterId}_{companyId}, checked in the rules).
// Company numbers are business contacts and sit on the company profile.

/** Indian mobile numbers in any common format -> "+91XXXXXXXXXX", or null if invalid. */
export function normalizePhone(input) {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+919820012345" -> "98200 12345" for the input box. */
export function localDigits(phone) {
  const digits = String(phone || "").replace(/^\+91/, "");
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function phoneLinkHTML(phone) {
  if (!phone) return "";
  const display = `+91 ${localDigits(phone)}`;
  return `<a class="link" href="tel:${escapeHTML(phone)}">${escapeHTML(display)}</a>`;
}

export async function getPromoterPhone(uid) {
  const snap = await getDoc(doc(db, "contactDetails", uid));
  return snap.exists() ? snap.data().phone : null;
}

export async function savePromoterPhone(uid, phone) {
  await setDoc(doc(db, "contactDetails", uid), { phone, updatedAt: serverTimestamp() });
}

/** What a promoter still needs before applying or booking. Empty when ready. */
export function missingForPromoter(p) {
  const missing = [];
  if (!p.photoURL) missing.push("a photo");
  if (!p.hasPhone) missing.push("your phone number");
  if (!p.city) missing.push("your city");
  return missing;
}

/** What a company still needs before posting events. Empty when ready. */
export function missingForCompany(c) {
  const missing = [];
  if (!c.logoURL) missing.push("a logo");
  if (!c.phone) missing.push("a phone number");
  if (!c.location) missing.push("your city");
  return missing;
}

export function listMissing(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0];
}
