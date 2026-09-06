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
- **Storage:** Firebase Storage (profile photos, portfolios, live check-in photos)
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
4. **Build → Storage** → **Get started** (production mode is fine here too).
5. **Project settings → General → Your apps → Add app → Web (`</>`)** → register
   the app (nickname anything, e.g. "promoter-connect-web") → copy the `firebaseConfig` object.
6. Paste those 6 values into **[`js/firebase-config.js`](js/firebase-config.js)**.
   The site shows a big pink banner on every page until you do this.
7. Deploy the security rules:
   - Firestore: **Firestore Database → Rules** tab → paste the contents of
     [`firestore.rules`](firestore.rules) → **Publish**.
   - Storage: **Storage → Rules** tab → paste the contents of
     [`storage.rules`](storage.rules) → **Publish**.

That's it — no Cloud Functions, no Admin SDK, no service account needed for the app itself.

## 2. Run Locally

Any static file server works (ES module imports need `http://`, not `file://`):

```bash
npx serve .
# or: python3 -m http.server 5500
```

Open the printed URL, e.g. `http://localhost:3000/index.html`.

## 3. Seed Demo Data (optional but recommended)

1. Sign up for any account (promoter or company) so you're authenticated.
2. Visit `/admin/seed.html` and click **Run Seed**.
3. This writes ~8 demo promoters, 5 demo companies (Nike, Cadbury, Skoda, Nykaa/Kay
   Beauty, Ferrero Rocher), and 7 demo events (a mix of open/fulfilled/window-ended,
   normal/urgent) so `/promoter/jobs.html` and `/company/find-promoters.html` aren't empty.
   Demo docs are tagged `isDemo: true` and use `demo_*` ids.

## 4. Deploy to Vercel with your custom domain

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
storage.rules               Storage security rules
```

### `js/` modules

| File | Responsibility |
|---|---|
| `firebase-config.js` | **Your credentials go here.** |
| `firebase-init.js` | Initializes the Firebase app once; exports `auth`, `db`, `storage`. |
| `auth.js` | Signup (creates `users` + `promoters`/`companies` docs), login, logout, `requireAuth()` route guard. |
| `db.js` | Promoter/company profile CRUD, portfolio subcollection, promoter directory search. |
| `events.js` | Post/list/watch events, the honest client-side 1-hour window reconciliation. |
| `booking.js` | **The core USP.** Atomic `runTransaction`-based instant booking (race-safe), normal-job applications, event completion. |
| `checkin.js` | Live check-in: photo upload, geolocation capture, timestamp, booking status flip. |
| `ratings.js` | Two-way ratings, eligibility checks (completed bookings only, one per side), running average. |
| `notifications.js` | Firestore-backed notification inbox + bell dropdown, real-time via `onSnapshot`. |
| `storage.js` | Image upload helper with type/size validation. |
| `render.js` | Shared job-card markup + live countdown ticking. |
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
- **Live check-in photo storage rules** are keyed by `bookingId`, not by uid — any
  signed-in user can write to a given `bookingId` path (there's no cheap way to
  cross-check Firestore booking ownership from Storage rules without a paid
  Blaze-plan `firestore.get()` call). Consider adding that check via the Blaze
  plan in production.

## Future Scope

AI-powered promoter–gig matching, location-based discovery, in-app chat, payment
gateway integration (the `paymentStatus`/`paymentAmount` fields are already in the
data model), company verification workflows, and analytics dashboards.

---

Built by a Promoter, for a Promoter. — Khushboo Yadav & Hiloni Shinde
