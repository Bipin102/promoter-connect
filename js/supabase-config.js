/**
 * SUPABASE CONFIGURATION — ADD YOUR CREDENTIALS HERE
 * ----------------------------------------------------
 * Used only for image storage (profile photos, portfolios, live check-in
 * photos) — everything else (auth, database) stays on Firebase.
 *
 * 1. Go to https://supabase.com → sign up (free, no credit card) → New project.
 *    Pick any name/region and a throwaway database password — we never use
 *    Supabase's database, only its Storage product.
 * 2. Once the project finishes provisioning: left sidebar → Storage →
 *    "New bucket" → name it exactly `promoter-connect-uploads` → toggle
 *    "Public bucket" ON → Create.
 * 3. Click into that bucket → Policies tab → New policy → "For full
 *    customization" → allow ALL operations (SELECT, INSERT, UPDATE, DELETE)
 *    for roles `anon` and `authenticated`, with the expression `true` for
 *    both USING and WITH CHECK. Save.
 *    (This app authenticates uploads via Firebase, not Supabase, so there's
 *    no Supabase-recognized user to scope the policy to — this mirrors the
 *    same "trust signed-in client" tradeoff already documented for a few
 *    other things in this MVP, e.g. notifications. See README.)
 * 4. Settings (gear icon) → API → copy the "Project URL" and the
 *    "anon public" key → paste them below.
 */
export const supabaseConfig = {
  url: "YOUR_SUPABASE_PROJECT_URL",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  bucket: "promoter-connect-uploads",
};
