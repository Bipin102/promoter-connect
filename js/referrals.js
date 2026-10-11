import { db, serverTimestamp } from "./firebase-init.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { escapeHTML, toast } from "./ui.js";

// Invite codes map to their owner in referralCodes/{CODE}. Each referred
// account gets referrals/{newUid}, so an account can only ever count once.

const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;
const PENDING_KEY = "pc-ref";

export function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function suggestCode(name) {
  const letters = normalizeCode(name.split(" ")[0]).replace(/[0-9]/g, "").slice(0, 6) || "PC";
  return letters + String(Math.floor(10 + Math.random() * 90));
}

export function inviteLink(code) {
  return `${location.origin}/r/${code}`;
}

/** The uid that owns a code, or null if there's no such code. Works signed out. */
export async function lookupCode(code) {
  const clean = normalizeCode(code);
  if (!CODE_PATTERN.test(clean)) return null;
  const snap = await getDoc(doc(db, "referralCodes", clean));
  return snap.exists() ? snap.data().uid : null;
}

const friendlyError = (message) => Object.assign(new Error(message), { friendly: true });

export async function createReferralCode(uid, rawCode) {
  const code = normalizeCode(rawCode);
  if (!CODE_PATTERN.test(code)) throw friendlyError("Use 4 to 12 letters or numbers.");
  if (await lookupCode(code)) throw friendlyError("That code is taken. Try another.");
  await setDoc(doc(db, "referralCodes", code), { uid, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "users", uid), { referralCode: code });
  return code;
}

/** Called right after sign-up. Never throws: a bad or stale code shouldn't block an account. */
export async function recordReferral(newUid, referral, role) {
  if (!referral || referral.referrerId === newUid) return;
  try {
    await setDoc(doc(db, "referrals", newUid), {
      referrerId: referral.referrerId, code: referral.code, role, createdAt: serverTimestamp(),
    });
  } catch {}
  forgetPendingCode();
}

export async function countReferrals(uid) {
  const snap = await getCountFromServer(query(collection(db, "referrals"), where("referrerId", "==", uid)));
  return snap.data().count;
}

// The code from an invite link is kept for the visit, in case they open log in first.
export function rememberPendingCode(code) {
  try { sessionStorage.setItem(PENDING_KEY, normalizeCode(code)); } catch {}
}
export function pendingCode() {
  try { return sessionStorage.getItem(PENDING_KEY) || ""; } catch { return ""; }
}
function forgetPendingCode() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch {}
}

/** Renders the "Invite friends" card into host for the signed-in user. */
export async function mountInviteCard(host, { uid, name, code }) {
  if (!code) {
    host.innerHTML = `
      <p class="text-dim text-sm">Create your invite code, then send your link to friends. When they sign up with it, they show up here.</p>
      <form class="invite-create" novalidate>
        <label for="invite-code" class="sr-only">Invite code</label>
        <input class="input" id="invite-code" maxlength="12" autocomplete="off" spellcheck="false" value="${escapeHTML(suggestCode(name || ""))}" />
        <button class="btn btn-primary" type="submit">Create code</button>
      </form>
      <p class="field-hint">4 to 12 letters or numbers. You can't change it later.</p>`;
    const input = host.querySelector("#invite-code");
    input.addEventListener("input", () => { input.value = normalizeCode(input.value); });
    host.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true; btn.textContent = "Creating…";
      try {
        const created = await createReferralCode(uid, input.value);
        mountInviteCard(host, { uid, name, code: created });
      } catch (err) {
        toast(err.friendly ? err.message : "Couldn't create the code. Please try again.", "error");
        btn.disabled = false; btn.textContent = "Create code";
      }
    });
    return;
  }

  const link = inviteLink(code);
  const message = `Join me on Promoter Connect, where promoters find paid event gigs: ${link}`;
  host.innerHTML = `
    <div class="invite-stats">
      <div><div class="stat-label">Your code</div><div class="invite-code">${escapeHTML(code)}</div></div>
      <div><div class="stat-label">Friends joined</div><div class="invite-count" id="invite-count">–</div></div>
    </div>
    <div class="invite-link">
      <label for="invite-link" class="sr-only">Your invite link</label>
      <input class="input" id="invite-link" readonly value="${escapeHTML(link)}" />
      <button class="btn btn-secondary" type="button" data-copy>Copy</button>
      <button class="btn btn-primary" type="button" data-share>Share</button>
    </div>`;

  host.querySelector("[data-copy]").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(link);
      e.target.textContent = "Copied";
      setTimeout(() => { e.target.textContent = "Copy"; }, 1500);
    } catch {
      host.querySelector("#invite-link").select();
      toast("Press Ctrl+C (or long-press) to copy the link.");
    }
  });
  host.querySelector("[data-share]").addEventListener("click", async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Promoter Connect", text: message }); } catch {}
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    }
  });

  try {
    const count = await countReferrals(uid);
    host.querySelector("#invite-count").textContent = count;
  } catch {
    host.querySelector("#invite-count").textContent = "–";
  }
}
