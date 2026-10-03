# Promoter Connect

Event staffing for agencies and promoters. Companies post an event and say how
many people they need; promoters apply, or book urgent spots directly. Promoters
check in from the venue with a photo, and both sides rate each other afterwards.

Live at [promoterconnect.site](https://promoterconnect.site).

## Stack

- Plain HTML, CSS and ES modules. No framework, no build step.
- Firebase Authentication (email/password) and Firestore.
- Supabase Storage for images (profile photos, portfolios, check-in photos).
- Vercel for hosting. Pushing to `main` deploys to production; other branches get a preview URL.

Every page is a standalone `.html` file that imports shared code from `/js`.

## Setup

### Firebase

1. Create a project in the [Firebase console](https://console.firebase.google.com).
2. Authentication → Sign-in method → enable Email/Password.
3. Firestore Database → Create database (production mode).
4. Project settings → Your apps → add a Web app and copy its config into
   [`js/firebase-config.js`](js/firebase-config.js).
5. Firestore → Rules → paste [`firestore.rules`](firestore.rules) → Publish.
   **Re-publish whenever that file changes**; it isn't deployed with the site.

### Supabase (images)

Firebase Storage now needs a billing account just to be enabled, so images live
on Supabase's free tier instead.

1. Create a project at [supabase.com](https://supabase.com). Only Storage is used.
2. Storage → New bucket → `promoter-connect-uploads`, public.
3. Add a policy on the bucket allowing select/insert/update for `anon` and
   `authenticated` (see the limitation about this below).
4. Settings → API → copy the project URL and `anon` key into
   [`js/supabase-config.js`](js/supabase-config.js).

### Admins

The admin dashboard (`/admin/dashboard.html`) shows sign-up numbers and the user
list. To make someone an admin, copy their User UID from Authentication → Users
and create a Firestore document at `admins/{uid}` (any fields). Admins see an
"Admin" link in the navbar.

## Running locally

Any static server works (modules need `http://`, not `file://`):

```bash
python3 -m http.server 5500
```

`/admin/seed.html` writes sample data (ids start with `demo_`) for testing. It's
admin-only, and the sample ratings are made up, so don't run it against the
production database.

## Layout

```
index.html              Landing page
auth/                   Sign up, log in, finish an interrupted sign-up
promoter/               Dashboard, find gigs, bookings, booking detail, profile, ratings
company/                Dashboard, post event, events list, event detail, find promoters, profile
shared/                 Public promoter and company profiles
admin/                  Admin dashboard, demo data seeder
css/main.css            Tokens, base styles, navbar, buttons, forms, landing page
css/components.css      Cards, badges, lists, modals, toasts, tabs, empty/loading states
css/dashboard.css       Logged-in page layouts and the admin dashboard
js/                     Shared modules (below)
firestore.rules         Security rules
```

| Module | What it does |
|---|---|
| `auth.js` | Sign-up (writes `users` plus `promoters` or `companies`), login, page guards, admin check |
| `events.js` | Post, list, watch, cancel and reopen events; expiring urgent windows |
| `booking.js` | Booking a spot (transaction), applications, completing an event |
| `checkin.js` | Check-in photo, optional location, notification to the company |
| `ratings.js` | Two-way ratings and running averages |
| `rating-form.js` | The star rating form used by both sides |
| `notifications.js` | Notification inbox and the navbar bell |
| `db.js` | Promoter and company profiles, portfolio, promoter search |
| `geo.js` | Location and rough travel-time estimates |
| `storage.js` | Image uploads to Supabase |
| `render.js` | Job cards, event details, booking rows, countdowns |
| `ui.js` | Escaping, formatting, toasts, modals, tabs, status pills, avatars |
| `icons.js` | Inline SVG icons |
| `layout.js` | Navbar, footer, mobile navigation, theme switch |

## How urgent hiring works

1. A company posts with hiring type "urgent". The event gets `urgentDeadlineMs = now + 60 min`.
2. Promoters see it at the top of their job list with a countdown.
3. Booking runs a Firestore transaction on a booking id of `${eventId}_${promoterId}`,
   so two promoters can't both take the last spot.
4. When the last spot fills, the same transaction sets the event to `fulfilled`.
5. If the hour runs out first, the next client to look at the event marks it
   `window_ended`. The company can reopen it for another hour or cancel.

Ratings unlock once the company marks the event done. Each side rates the other
once per booking. Badges are computed from real counts and ratings.

## Known limitations

There's no backend, so a few things a server would normally own are done by clients:

- **Expired urgent windows** are closed by whichever signed-in client sees them
  first, not a scheduled job.
- **Counters** (`eventsCompleted`, `ratingAvg`, `ratingCount`) on another user's
  profile are updated by the other party's client. The rules only allow a +1 step,
  but a scheduled Cloud Function would be the proper fix.
- **Notifications** can be created by any signed-in user. They're escaped wherever
  they're shown and only same-site links are followed.
- **Image storage** isn't scoped per user: anyone with the public Supabase key
  can write to the bucket, and with the original setup instructions, delete from
  it. A small server that checks the Firebase ID token before uploading would fix this.
- **Promoter and company profiles** (including contact details and rough location)
  are readable by any signed-in user, because search needs them.

---

Built by a promoter, for promoters. Khushboo Yadav & Hiloni Shinde
