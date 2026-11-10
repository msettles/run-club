# 🦫 Woodland Woodchuckers Run Club

> *"Pounding trails & pavement — one burrow at a time!"*

The club's installable web app (PWA): run schedule, code-word check-ins, leaderboards, milestones and badges, GPX routes with turn-by-turn directions, old-app history claims, announcements and phone notifications.

**Live:** https://woodland-woodchuckers.web.app · **Stack:** React 18 · TypeScript · Vite 6 · Tailwind 3 · Firebase 13 (Spark plan: Auth, Firestore, Hosting, Cloud Messaging) · Leaflet / OpenStreetMap

![CI](https://github.com/msettles/woodland_woodchuckers/actions/workflows/ci.yml/badge.svg)

---

## What it does

**Runners**
- **Schedule:** upcoming runs, soonest first, with **Show prior runs** for past ones. Includes routes, distances, pace groups, RSVP and **Add to calendar** (.ics).
- **Check-in:** by the run's **code word**, one check-in per runner per run.
  - Check-in opens **2 hours before the start** and closes at **midnight**.
  - The table QR code (`/?checkin=true`) opens whichever run is open right now. If two runs are open, the code word decides which.
- **Totals:** runs, miles (from the route chosen at check-in), weekly streaks, milestone gear and badges.
- **Old-app history:** at sign-up, runners claim their old sign-in names (typo-tolerant search). Each name can only be claimed once.
- **Bell:** club announcements and received push notifications, with read/unread and **Mark all as read**.
- **Phone notifications:** turned on per device, from **Enable Alerts** or the profile menu. iPhones need the Home Screen app.
- **Install app:** from the banner or the footer link.

**Organizers** (event-night tools)
- Create and edit runs, including the code word. A run isn't live until its code word is saved, and the code word locks once check-in opens.
- Route Studio and the check-in log.

**Admins** (Admin dashboard)
- **Runners & Claims:** promote or demote roles, delete runners, assign or unclaim old-app names, and import the old app's CSV exports.
- **Check-In Log** (last 60 days), **Milestones & Gear** queue, **Badges & Special Events**.
- **Push Alerts:** post announcements, and see how many devices have notifications on.
- **Delete a run:** rolls back each runner's runs, miles, badges and streaks.

## Getting started

Use Node.js 24.12+ (`nvm use` reads `.nvmrc`). Rules tests also need Java 21+.

```bash
npm install
cp .env.example .env    # fill in Firebase web config (or leave blank for local mode)
npm run dev             # http://localhost:5173
```

- **Without Firebase values**, the app runs in **local mode** with sample data in browser storage. There's no sign-in in that mode.
- **With them**, it uses the live Firebase project, so take care: that's real data.

| `.env` variable | Where it comes from |
|---|---|
| `VITE_FIREBASE_API_KEY` … `VITE_FIREBASE_APP_ID` | Firebase console → Project settings → Your apps (web) |
| `VITE_FIREBASE_VAPID_KEY` | Project settings → Cloud Messaging → Web Push certificates (public key) |

`.env` is git-ignored. Never commit real member data either: `data/` (the old-app exports) is git-ignored too.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | TypeScript, no output |
| `npm run audit:dependencies` | Report dependency advisories; any severity fails |
| `npm run lint` | ESLint (errors fail; `any` is a warning for now) |
| `npm run build` | Type-check + production build into `dist/` |
| `npm test` | Unit tests for club logic (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:resolver` | Verify the pinned resolver fork and Workbox compatibility |
| `npm run test:rules` | Firestore security-rules tests in the emulator (needs Java 21+) |
| `npx firebase deploy --only firestore:rules,hosting` | Deploy rules + site (**always deploy both together**) |

**CI** (`.github/workflows/ci.yml`) runs a dependency audit, type-check, lint, unit tests, resolver compatibility tests, build and the rules tests on every PR and every push to `main`.

## How it's put together

```
src/
  App.tsx                    tabs, check-in routing (QR / Quick Check-in), bell
  services/
    storage.ts               app data + Firestore reads/writes (useClubStore)
    firebase.ts              Firebase init (env-driven; local mode if unset)
    authService.ts           Google + email-link sign-in
    push.ts                  phone notifications (FCM sign-up, received pushes)
    install.ts               "Install app" prompt (banner + footer)
  components/                screens and modals (AdminDashboard, CheckInModal, RunCard, …)
  utils/
    checkInWindow.ts         check-in windows, upcoming/prior runs
    legacy.ts                old-app CSV import, fuzzy name match, streaks, badge recompute
    routeEngine/             GPX → turn-by-turn directions (OpenStreetMap / Overpass)
    calendar.ts              .ics export
    memberKey.ts             hashed IDs (leaderboard key, code-word lookup key)
    roles.ts                 owner account + admin/organizer checks
public/push-sw.js            push-only service worker (scope /push/)
firestore.rules              security rules (see the summary at the top of the file)
tests/firestore.rules.test.mjs
docs/                        plans (route engine, push notifications Plan B)
```

**Firestore, in short** (details at the top of `firestore.rules`):

| Who can read | Collections |
|---|---|
| Public | `runs`, `routes`, `members` (leaderboard, keyed by hashed email, no emails), `meetup_events` (one per run: window, routes, no code word), `announcements`, badges, settings |
| Owner + staff | `users` (profiles), `checkins` (`{runId}_{email}`), `milestone_alerts` |
| Staff only | `meetup_secrets` (code words) |
| Signed-in, get only | `meetup_codes` (code-word lookup, unique per day) |
| Signed-in | `legacy_index`, `legacy_profiles` (old-app names and claim locks) |
| Claimer + staff | `legacy_history` |
| Admins | `push_devices` |

**Roles:** `woodlandwoodchuckers@gmail.com` is the only hardcoded owner (always admin). Everyone else's role (`member` / `organizer` / `admin`) is set by an admin in Runners & Claims.

## Push notifications

Today (**Plan A**, free): devices sign up in the app, and admins send from **Firebase console → Messaging → New campaign → Notifications**, targeting the web app.

Sending straight from **Post Announcement** needs Cloud Functions (Blaze plan, expected $0/month). That's scoped in [`docs/push-notifications-plan-b.md`](docs/push-notifications-plan-b.md).

## More

- [`docs/tooling-maintenance.md`](docs/tooling-maintenance.md): dependency override history.
- [`docs/resolver-fork.md`](docs/resolver-fork.md): pinned resolver fork, Node requirement and zero-advisory follow-up.

- [`setup.md`](setup.md): Firebase project setup
- [`BRANDING.md`](BRANDING.md): logos and colours
- [`docs/route-creation-architecture-plan.md`](docs/route-creation-architecture-plan.md): route engine design. The original Python prototype has been removed; `src/utils/routeEngine/` is the source of truth.

MIT License. Made for the Woodland Woodchuckers community.

### Browser regression tests

Run `npx playwright install chromium webkit` once, then `npm run test:browser`. Use Node 24 as required above. `npm run typecheck:browser` checks the suite and its fixtures. CI installs the browsers and runs the suite separately.

These tests use synthetic local data with Firebase disabled and external requests blocked. They cover check-in/onboarding interactions in Chromium and mobile WebKit; they do not replace real-device push, GPS, OAuth or installed-PWA upgrade checks. See [the browser and device checklist](docs/browser-device-testing.md).

### Go-live data policy

The app is currently in testing. The [go-live reset policy](docs/go-live-policy.md) preserves routes, removes test users/runs and related records, reloads the approved name-based historical database, and establishes the first real club run. A deployment does not trigger this reset.

Records are retained indefinitely. There is no automatic deletion: users and check-ins are admin-only deletions; organizers or admins may delete runs and routes, subject to existing integrity safeguards.
