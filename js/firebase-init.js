// Central Firebase bootstrap. Every page imports from here (not from the SDK directly).
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { serverTimestamp, onAuthStateChanged, signOut };

export const isDemoConfig = firebaseConfig.apiKey === "YOUR_API_KEY";

if (isDemoConfig) {
  // Surfaces a visible banner instead of failing silently with cryptic Firebase errors.
  window.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.textContent =
      "⚠ Firebase is not configured yet. Add your project credentials in js/firebase-config.js to activate Promoter Connect.";
    bar.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#ff2ea6;color:#0a0a12;font-family:sans-serif;font-weight:700;text-align:center;padding:10px;font-size:14px;";
    document.body.prepend(bar);
  });
}
