import { auth, db, serverTimestamp, onAuthStateChanged, signOut } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
  window.location.href = "/index.html";
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export function getUserDoc(uid) {
  return getDoc(doc(db, "users", uid)).then((s) => (s.exists() ? s.data() : null));
}

/**
 * Guards a page: waits for auth, ensures role matches (if given), redirects otherwise.
 * Resolves with { user, profile } once ready. Use at the top of protected pages.
 */
export function requireAuth(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/auth/login.html";
        return;
      }
      const profile = await getUserDoc(user.uid);
      if (!profile) {
        // Auth account exists but the Firestore profile never got written (an
        // interrupted signup) — send them to finish it instead of bouncing
        // back to login, which would just loop forever.
        window.location.href = "/auth/complete-profile.html";
        return;
      }
      if (requiredRole && profile.role !== requiredRole) {
        window.location.href = profile.role === "company"
          ? "/company/dashboard.html"
          : "/promoter/dashboard.html";
        return;
      }
      resolve({ user, profile });
    });
  });
}

/** Non-blocking helper for public pages (landing/nav) that just need to know if someone's logged in. */
export function watchAuth(cb) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return cb(null, null);
    const profile = await getUserDoc(user.uid);
    cb(user, profile);
  });
}
