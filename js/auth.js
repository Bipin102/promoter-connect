import { auth, db, serverTimestamp, onAuthStateChanged, signOut } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { recordReferral } from "./referrals.js";

/**
 * Creates the Firestore side of an account (users/{uid} + promoters/{uid} or
 * companies/{uid}). Split out from signup() so the same logic can also repair
 * an account whose Auth user exists but whose profile docs never got written
 * (e.g. a signup that was interrupted mid-way by a transient error).
 */
export async function createUserDocs(user, { role, name, email, referredBy = null }) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email,
    role, // 'promoter' | 'company'
    displayName: name,
    referredBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (role === "promoter") {
    await setDoc(doc(db, "promoters", user.uid), {
      uid: user.uid,
      fullName: name,
      email,
      photoURL: "",
      age: null, gender: "", height: "", city: "",
      yearsExperience: 0, skills: [], languages: [], brands: [],
      categories: [], availability: "available",
      ratingAvg: 0, ratingCount: 0, eventsCompleted: 0,
      verified: false, quickResponder: false,
      totalEarnings: 0, pendingEarnings: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(doc(db, "companies", user.uid), {
      uid: user.uid,
      companyName: name,
      email,
      logoURL: "",
      description: "", industry: "", location: "", contact: "",
      eventsPosted: 0, eventsCompleted: 0,
      ratingAvg: 0, ratingCount: 0, verified: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
}

/** referral is { code, referrerId } from an invite link, or null. */
export async function signup({ email, password, role, name, referral = null }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await createUserDocs(cred.user, { role, name, email, referredBy: referral?.referrerId || null });
  if (referral) await recordReferral(cred.user.uid, referral, role);
  return cred.user;
}

/**
 * One-tap Google sign-in. For a first-time user with a role chosen (from the
 * sign-up page), the account is created straight away.
 * Resolves with { user, profile, isNew }; profile is null if no role was given yet.
 */
export async function continueWithGoogle({ role = null, referral = null } = {}) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(auth, provider);
  const existing = await getUserDoc(user.uid);
  if (existing || !role) return { user, profile: existing, isNew: false };

  const name = user.displayName || user.email.split("@")[0];
  await createUserDocs(user, { role, name, email: user.email, referredBy: referral?.referrerId || null });
  if (referral) await recordReferral(user.uid, referral, role);
  return { user, profile: { role }, isNew: true };
}

/** Plain-language messages for Firebase auth errors shown on the login and sign-up pages. */
export function authErrorMessage(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "There's already an account with this email. Try logging in, or use Continue with Google.";
  if (code.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password")) return "That email and password don't match an account.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a few minutes and try again.";
  if (code.includes("network-request-failed")) return "You seem to be offline. Check your connection and try again.";
  if (code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) return "";
  if (code.includes("popup-blocked")) return "Your browser blocked the Google window. Allow pop-ups for this site and try again.";
  if (code.includes("operation-not-allowed") || code.includes("unauthorized-domain") || code.includes("configuration-not-found")) {
    return "Google sign-in isn't available right now. Please use your email instead.";
  }
  if (code.includes("account-exists-with-different-credential")) return "This email already has an account. Log in with your email and password.";
  return "Something went wrong. Please try again.";
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
  window.location.href = "/";
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

const ACTIVE_PING_MS = 60 * 60 * 1000;
let lastActiveTouched = false;

// Feeds the "active users" count on the admin dashboard; at most one write per user per hour.
function touchLastActive(uid, profile) {
  if (lastActiveTouched) return;
  lastActiveTouched = true;
  const last = profile.lastActiveAt?.toMillis?.() || 0;
  if (Date.now() - last < ACTIVE_PING_MS) return;
  updateDoc(doc(db, "users", uid), { lastActiveAt: serverTimestamp() }).catch(() => {});
}

// The navbar and the page guard both need the profile on load; share one read.
const profileRequests = new Map();
export function getUserDoc(uid) {
  if (!profileRequests.has(uid)) {
    const request = getDoc(doc(db, "users", uid)).then((s) => (s.exists() ? s.data() : null));
    request.then((profile) => { if (!profile) profileRequests.delete(uid); }, () => profileRequests.delete(uid));
    profileRequests.set(uid, request);
  }
  return profileRequests.get(uid);
}

const adminRequests = new Map();
export function isAdmin(uid) {
  if (!adminRequests.has(uid)) {
    adminRequests.set(uid, getDoc(doc(db, "admins", uid)).then((s) => s.exists(), () => false));
  }
  return adminRequests.get(uid);
}

/** Redirects away unless signed in (and in the given role). Resolves with { user, profile }. */
export function requireAuth(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/auth/login";
        return;
      }
      const profile = await getUserDoc(user.uid);
      if (!profile) {
        // Signed in but the signup never finished writing the profile.
        window.location.href = "/auth/complete-profile";
        return;
      }
      if (requiredRole && profile.role !== requiredRole) {
        window.location.href = profile.role === "company"
          ? "/company/dashboard"
          : "/promoter/dashboard";
        return;
      }
      touchLastActive(user.uid, profile);
      resolve({ user, profile });
    });
  });
}

/** Admins are the uids listed in the `admins` collection (written from the Firebase console only). */
export function requireAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/auth/login";
        return;
      }
      resolve({ user, isAdmin: await isAdmin(user.uid) });
    });
  });
}

/** Resolves once with { user, profile } for whoever is signed in, or null. Never redirects. */
export function getSession() {
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, async (user) => {
      stop();
      if (!user) return resolve(null);
      const profile = await getUserDoc(user.uid);
      resolve(profile ? { user, profile } : null);
    });
  });
}

/** For public pages and the navbar: reports the signed-in user (or null) without redirecting. */
export function watchAuth(cb) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null, null);
    const profile = await getUserDoc(user.uid);
    if (profile) touchLastActive(user.uid, profile);
    cb(user, profile);
  });
}
