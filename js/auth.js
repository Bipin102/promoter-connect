import { auth, db, serverTimestamp, onAuthStateChanged, signOut } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function signup({ email, password, role, name }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });

  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email,
    role, // 'promoter' | 'company'
    displayName: name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (role === "promoter") {
    await setDoc(doc(db, "promoters", cred.user.uid), {
      uid: cred.user.uid,
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
    await setDoc(doc(db, "companies", cred.user.uid), {
      uid: cred.user.uid,
      companyName: name,
      email,
      logoURL: "",
      description: "", industry: "", location: "", contact: "",
      eventsPosted: 0, eventsCompleted: 0,
      ratingAvg: 0, ratingCount: 0, verified: false,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
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
        window.location.href = "/auth/login.html";
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
