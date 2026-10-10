import { auth, db, serverTimestamp, onAuthStateChanged, signOut } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Creates the Firestore side of an account (users/{uid} + promoters/{uid} or
 * companies/{uid}). Split out from signup() so the same logic can also repair
 * an account whose Auth user exists but whose profile docs never got written
 * (e.g. a signup that was interrupted mid-way by a transient error).
 */
export async function createUserDocs(user, { role, name, email }) {
  await setDoc(doc(db, "users", user.uid), {
    uid: user.uid,
    email,
    role, // 'promoter' | 'company'
    displayName: name,
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

export async function signup({ email, password, role, name }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  await createUserDocs(cred.user, { role, name, email });
  return cred.user;
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
