/**
 * FIREBASE CONFIGURATION — ADD YOUR CREDENTIALS HERE
 * ----------------------------------------------------
 * 1. Go to https://console.firebase.google.com → create a project (e.g. "promoter-connect").
 * 2. Project Settings → General → "Your apps" → Add app → Web (</>).
 * 3. Copy the config object Firebase gives you and paste the values below.
 * 4. Enable these in the Firebase console:
 *    - Authentication → Sign-in method → Email/Password → Enable
 *    - Firestore Database → Create database (production mode)
 *    - Storage → Get started
 * 5. Deploy the security rules in /firestore.rules and /storage.rules
 *    (Firebase console → Firestore/Storage → Rules tab → paste contents → Publish).
 *
 * DO NOT commit real production secrets you consider sensitive to a public repo.
 * Firebase web config values are not secret in the traditional sense (they are
 * visible in any deployed site's JS bundle) — access is controlled by the
 * Security Rules, not by hiding this file.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDwmVud5-zEgaT4Dkga51zGIrMb0PUm2-E",
  authDomain: "promoter-connect.firebaseapp.com",
  projectId: "promoter-connect",
  storageBucket: "promoter-connect.firebasestorage.app",
  messagingSenderId: "168774983956",
  appId: "1:168774983956:web:8d8c757e869223bc062201",
  measurementId: "G-4W8CYZ3PJD"
};
