import { db, serverTimestamp } from "./firebase-init.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHTML } from "./ui.js";

// A promoter's payment details live in payoutDetails/{uid}, away from the public
// profile. A company can read them only once it has a booking with that
// promoter: the booking creates payoutAccess/{promoterId}_{companyId}, which the
// security rules check.

export const PAYOUT_METHODS = {
  upi: "UPI",
  bank: "Bank transfer",
  cash: "Cash on the day",
};

const UPI_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function validatePayout(p) {
  if (!PAYOUT_METHODS[p.method]) return "Choose how you'd like to be paid.";
  if (p.method === "upi" && !UPI_PATTERN.test(p.upiId)) return "Enter a UPI ID like name@okaxis.";
  if (p.method === "bank") {
    if (!p.accountName) return "Enter the account holder's name.";
    if (!/^\d{6,18}$/.test(p.accountNumber)) return "Enter the account number using digits only.";
    if (!IFSC_PATTERN.test(p.ifsc)) return "Enter an 11-character IFSC code like HDFC0001234.";
  }
  return null;
}

export async function getPayout(promoterId) {
  const snap = await getDoc(doc(db, "payoutDetails", promoterId));
  return snap.exists() ? snap.data() : null;
}

export async function savePayout(promoterId, p) {
  const data = { method: p.method, updatedAt: serverTimestamp() };
  if (p.method === "upi") data.upiId = p.upiId;
  if (p.method === "bank") Object.assign(data, { accountName: p.accountName, accountNumber: p.accountNumber, ifsc: p.ifsc });
  await setDoc(doc(db, "payoutDetails", promoterId), data);
}

/** Lets the booking's company see the promoter's payout details. Safe to call more than once. */
export async function grantPayoutAccess(bookingId, promoterId, companyId) {
  await setDoc(doc(db, "payoutAccess", `${promoterId}_${companyId}`), { promoterId, companyId, bookingId });
}

/** One-line summary shown to a company next to a confirmed promoter. */
export function payoutSummaryHTML(p) {
  if (!p) return `<span class="text-faint">Payment method not added yet</span>`;
  if (p.method === "upi") return `UPI: <code>${escapeHTML(p.upiId)}</code>`;
  if (p.method === "bank") return `Bank: ${escapeHTML(p.accountName)} · A/c <code>${escapeHTML(p.accountNumber)}</code> · IFSC <code>${escapeHTML(p.ifsc)}</code>`;
  return "Prefers cash on the day";
}
