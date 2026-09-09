# Promoter Connect

**Built by a Promoter, for a Promoter.**

A real-time event workforce marketplace connecting Event Companies with Promoters.
Its core differentiator: **⚡ NEED A PROMOTER? GET THEM WITHIN 1 HOUR.** — a live,
atomic, race-condition-safe fulfillment system, not a job listing with an expiry timer.

Live flow: **Post → Match → Confirm → Check-In → Complete → Rate**

---

## Tech Stack

- **Frontend:** Vanilla HTML5 / CSS3 / JavaScript (ES modules, no build step)
- **Auth:** Firebase Authentication (email/password, role-based)
- **Database:** Firebase Firestore
- **Storage:** Supabase Storage (profile photos, portfolios, live check-in photos) —
  not Firebase Storage; see the note in [Set Up Supabase](#2-set-up-supabase-for-image-storage) below.
- **Hosting:** Vercel (static site, zero build config)

No framework, no bundler — every page is a standalone `.html` file that imports
shared logic from `/js/*.js` via native `<script type="module">`.

---

## 1. Set Up Firebase (required before anything works)

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add project**
   (e.g. `promoter-connect`).
2. **Build → Authentication → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database** → **Create database** (start in production mode —
   the rules below lock it down properly).
4. **Project settings → General → Your apps → Add app → Web (`</>`)** → register
   the app (nickname anything, e.g. "promoter-connect-web") → copy the `firebaseConfig` object.
5. Paste those 6 values into **[`js/firebase-config.js`](js/firebase-config.js)**.
   The site shows a big pink banner on every page until you do this.
6. Deploy the security rules: **Firestore Database → Rules** tab → paste the
   contents of [`firestore.rules`](firestore.rules) → **Publish**.

That's it for Firebase — no Cloud Functions, no Admin SDK, no service account needed.

## 2. Set Up Supabase (for image storage)

Image uploads (profile photos, portfolios, live check-in photos) run on
**Supabase Storage**, not Firebase Storage. Why: as of late 2024, Firebase
Storage requires linking a Google Cloud **Blaze** billing account just to
*enable* it at all (even though usage stays inside a free-tier quota
afterward) — and if that billing account ever ends up flagged/delinquent by
Google (which can happen even to a brand-new account, unrelated to actual
usage or payment history), Storage becomes uncreatable with no clear fix on
your end. Supabase's Storage free tier needs no card at all, so it sidesteps
that failure mode entirely. Auth and the database are unaffected — those stay
on Firebase.

1. Go to [supabase.com](https://supabase.com) → sign up (free) → **New project**
   (any name/region; the database password is never used — this app only uses
   Supabase's Storage product, not its Postgres database).
2. Once it finishes provisioning: left sidebar → **Storage** → **New bucket** →
   name it exactly `promoter-connect-uploads` → toggle **Public bucket** ON → **Create**.
3. Click into that bucket → **Policies** tab → **New policy** → "For full
   customization" → allow **all operations** (SELECT, INSERT, UPDATE, DELETE)
   for roles `anon` and `authenticated`, with `true` for both the USING and
   WITH CHECK expressions → **Save**.
   (This app authenticates every upload via Firebase, not Supabase — there's no
   Supabase-recognized user to scope a tighter policy to, so this trusts any
   signed-in-to-Firebase client the same way a couple of other things in this
   MVP do; see Known Limitations below.)
4. **Settings (gear icon) → API** → copy the **Project URL** and the **`anon`
   `public`** key → paste them into
   **[`js/supabase-config.js`](js/supabase-config.js)**.

## 3. Run Locally

Any static file server works (ES module imports need `http://`, not `file://`):

```bash
npx serve .
# or: python3 -m http.server 5500
```

Open the printed URL, e.g. `http://localhost:3000/index.html`.

## 4. Seed Demo Data (optional but recommended)

1. Sign up for any account (promoter or company) so you're authenticated.
2. Visit `/admin/seed.html` and click **Run Seed**.
3. This writes ~8 demo promoters, 5 demo companies (Nike, Cadbury, Skoda, Nykaa/Kay
   Beauty, Ferrero Rocher), and 7 demo events (a mix of open/fulfilled/window-ended,
   normal/urgent) so `/promoter/jobs.html` and `/company/find-promoters.html` aren't empty.
   Demo docs are tagged `isDemo: true` and use `demo_*` ids.

## 5. Deploy to Vercel with your custom domain

```bash
vercel                # first deploy, link/create the project
vercel --prod         # promote to production
vercel domains add promoterconnect.site <project-name>
vercel domains add www.promoterconnect.site <project-name>
```

Then, at your domain registrar, point `promoterconnect.site` at Vercel's DNS
(Vercel's CLI/dashboard tells you the exact `A`/`CNAME` records to add — usually
an `A` record to `76.76.21.21` for the apex domain and a `CNAME` to
`cname.vercel-dns.com` for `www`). Once DNS propagates, the site is served
directly from `promoterconnect.site` — Vercel's own domain is never shown to visitors.

---

## Project Structure

```
index.html                 Landing page (hero, how-it-works, USP, comparison)
auth/
  signup.html               Role selection (Promoter / Company) + registration
  login.html                Login + forgot-password
promoter/
  dashboard.html            Stats, urgent jobs, upcoming events, ratings preview
  profile.html              Edit profile, upload photo + portfolio gallery
  jobs.html                 Browse/search/filter normal + urgent jobs, apply/book
  bookings.html             Upcoming / completed / cancelled bookings
  event.html                Booking detail → status, live check-in, rate company
  ratings.html              Ratings & reviews received
company/
  dashboard.html            Stats, active urgent trackers, upcoming events
  profile.html              Edit company profile + logo
  post-event.html           Post a job — Normal or 🔥 Urgent (1-Hour) hiring
  manage-events.html        All posted events by status
  event.html                Fulfillment tracker, applications, confirmed promoters,
                             live check-ins, complete/cancel, rate promoters
  find-promoters.html       Search/filter promoter directory
shared/
  promoter-profile.html     Public promoter profile (viewed by companies)
  company-profile.html      Public company profile (viewed by promoters)
admin/
  seed.html                 One-click demo data seeder
js/                         All application logic (see below)
css/                        main.css (tokens/layout), components.css, dashboard.css
firestore.rules             Firestore security rules
```

### `js/` modules

| File | Responsibility |
|---|---|
| `firebase-config.js` | **Your Firebase credentials go here.** |
| `firebase-init.js` | Initializes the Firebase app once; exports `auth`, `db`. |
| `supabase-config.js` | **Your Supabase credentials go here** (image storage only). |
| `auth.js` | Signup (creates `users` + `promoters`/`companies` docs), login, logout, `requireAuth()` route guard. |
| `db.js` | Promoter/company profile CRUD, portfolio subcollection, promoter directory search. |
| `events.js` | Post/list/watch events, the honest client-side 1-hour window reconciliation. |
| `booking.js` | **The core USP.** Atomic `runTransaction`-based instant booking (race-safe), normal-job applications, event completion. |
| `checkin.js` | Live check-in: photo upload, geolocation capture, timestamp, booking status flip. |
| `ratings.js` | Two-way ratings, eligibility checks (completed bookings only, one per side), running average. |
| `notifications.js` | Firestore-backed notification inbox + bell dropdown, real-time via `onSnapshot`. |
| `storage.js` | Image upload helper (Supabase Storage) with type/size validation. |
| `render.js` | Shared job-card markup + live countdown ticking. |
| `geo.js` | GPS capture (`navigator.geolocation`) + haversine-distance-based "reachable within 1 hour" estimate, used to match promoters to nearby urgent gigs. |
| `ui.js` | Toasts, modals, confirm dialogs, star rendering, badge logic, mobile bottom nav. |
| `layout.js` | Injects the shared navbar/footer and reacts to auth state. |

---

## How the 1-Hour Fulfillment USP Actually Works

This is **not** "a job post that disappears after an hour." It's a fulfillment
tracker with real state:

1. Company posts with **Hiring Type: 🔥 Urgent**. The event doc gets
   `urgentDeadlineMs = now + 60min`, `status: "open"`, `positionsFilled: 0`.
2. Promoters see it immediately on `/promoter/jobs.html`, with a live countdown.
3. **BOOK NOW** runs `bookPosition()` in `js/booking.js`, which uses a Firestore
   **transaction** keyed on a deterministic booking id (`${eventId}_${promoterId}`)
   so it can safely read-then-write the event's `positionsFilled` counter and the
   booking doc atomically — two promoters racing for the last slot can never both
   win; the loser gets `❌ Sorry, all promoter positions for this event have now
   been filled.`
4. When `positionsFilled === positionsRequired`, the transaction itself flips
   `status → "fulfilled"` and stamps `fulfilledAt`. The company's dashboard shows
   `✅ REQUIREMENT FULFILLED — X/X Confirmed — Time Taken: N Minutes`.
5. If the 60-minute deadline passes first, any client that views the event calls
   `reconcileUrgentWindow()`, which honestly flips it to `🟡 window_ended` — it
   never pretends to be fully fulfilled. The company can then **Continue Searching
   (Reopen)**, **Edit**, or **Cancel**.

## Live Check-In & Two-Way Ratings

- **Live Check-In** (`js/checkin.js`): once booked, a promoter can submit a photo
  (camera-capture on mobile) + optional GPS + server timestamp from `/promoter/event.html`.
  This is stored separately from portfolio photos, in `liveCheckIns`, and shown to
  the company on `/company/event.html` as `🟢 ARRIVED AT EVENT`.
- **Ratings** (`js/ratings.js`): only unlockable once a booking's status is
  `completed` (set via the company's **Mark Event Completed** action, which also
  bumps both sides' `eventsCompleted` counters). Each side can rate the other
  exactly once per booking (deterministic `${bookingId}_${fromRole}` doc id), across
  role-appropriate categories, and the target's `ratingAvg`/`ratingCount` update
  atomically. Badges (`✓ Verified`, `⭐ Highly Rated`, `🔥 Top Promoter`, `⚡ Quick
  Responder`, `🎯/🏆 event-count badges`) are all computed live from these real
  numbers in `js/ui.js` — never hardcoded.

## Location-Based Matching

On `/promoter/profile.html`, a promoter can click **📍 Share My Current Location** to save
GPS coordinates to their profile (`promoters/{uid}.location`). When a company optionally
captures the venue's GPS while posting an event (**📍 Use Current Location for Venue** on
`/company/post-event.html`, saved as `events/{id}.locationGeo`), the jobs page shows each
promoter a distance + estimated travel time, and a **"Only show gigs I can reach within 1
hour"** filter. Distance uses the haversine formula and an assumed average urban speed
(25 km/h) — it's an estimate, not real turn-by-turn routing (that would need a paid
Directions/Distance Matrix API), but it's enough to keep urgent matching honest about
actual reachability instead of just comparing city names.

## Known MVP Limitations (documented, not hidden)

This is a pure static-site + client-SDK architecture (as scoped: HTML/CSS/JS +
Firebase + Vercel, no server). A few things a backend would normally own are
handled with documented tradeoffs instead:

- **1-hour window expiry** is reconciled by whichever client next views an expired
  urgent event, not by a server-side cron/Cloud Function. Fine for a live app with
  regular traffic; a production build should add a scheduled Cloud Function.
- **Notifications** are written directly by the acting client into the recipient's
  inbox (Firestore rules allow any signed-in user to `create` a notification row,
  since there's no server to do it centrally). Tighten this with Cloud Functions
  if you need it airtight.
- **Image storage access is trust-based, not per-user-scoped**: the Supabase
  bucket policy allows any client holding the public `anon` key to
  read/write/delete objects — there's no Supabase-recognized identity to scope
  a tighter policy to, since uploads are authenticated via Firebase instead.
  Fine for this MVP (nothing sensitive is stored there — public profile/portfolio/
  check-in photos), but a production build should proxy uploads through a small
  server that verifies the caller's Firebase ID token before writing to Storage.

## Future Scope

AI-powered promoter–gig matching, location-based discovery, in-app chat, payment
gateway integration (the `paymentStatus`/`paymentAmount` fields are already in the
data model), company verification workflows, and analytics dashboards.

---

Built by a Promoter, for a Promoter. — Khushboo Yadav & Hiloni Shinde
