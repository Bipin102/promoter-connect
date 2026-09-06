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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
