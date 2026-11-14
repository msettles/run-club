# Woodland Woodchuckers Run Club — Product Roadmap & TODOs

> **Application Status:** Deployed PWA; launch readiness and owner acceptance complete November 13, 2026. Public site: [https://woodland-woodchuckers.web.app](https://woodland-woodchuckers.web.app)\
> **Infrastructure:** Firebase Hosting + Firestore/Auth/FCM, plus the calendar Cloud Function. Confirm billing/quotas; do not assume all features run on Spark or guarantee zero cost\
> **Design Philosophy:** Mobile-First for runners & organizers; responsive desktop/tablet tools for admins.\
> **Last Updated:** November 13, 2026 (launch work reconciled with implementation; [remaining documentation checks](docs/documentation-status.md))

---

## Completed launch preparation

- [x] **Maintenance cutover:** persist a pause for registrations and member/organizer mutations while admins retain the import and reward-proof rebuild path; resume explicitly after verification.
- [x] **Durable claim merchandise:** save pending delivery with the claim, retry on reload/repeated claim/admin recompute, and transactionally preserve existing/fulfilled alerts.
- [x] **Retained staff scope:** owner approved keeping the five real staff accounts and their eight claims; preserve all 54 routes. The next live run is created after historical replacement and verification.

- [x] **Deduplicate shared attendance across claimed historical names — implemented November 13, 2026.**
  - Combine dated attendance across all names claimed by a runner and count each shared run once. Example: Pat Runner and Pat L Runner checking in to the same canonical run must contribute one run after both names are claimed.
  - Use the canonical run identity after approved historical run consolidation; do not merge distinct runs solely because they share a week or a reused code word. Preserve separate runs, including approved holiday exceptions.
  - Preserve older credits without dated check-ins; do not infer overlap or discard those credits.
  - Apply consistent totals to runner claims, admin assignment/unclaiming, historical re-imports and recomputation, public standings, badges and milestone/gear calculations. Include reconciliation for already-claimed names without deleting original attendance, claim history or fulfilled gear records.
  - Verify overlapping and non-overlapping aliases, distinct runs in the same week, repeated code words in different weeks, mixed app/legacy attendance, undated credits, repeat claims/recomputation, and assignment/unclaim/re-import paths. Review necessary Firestore rule changes alongside the implementation.
- [x] **Roll out the attendance fix before launch:** deploy the app and Firestore rules together, import the approved full history, and run **Recompute rewards for everyone** as an admin. Confirm every member reconciles successfully. This preserves original attendance, undated credits and fulfilled gear records; it does not perform the go-live reset. See [attendance import and claim instructions](docs/import-format.md#claiming-multiple-names-shared-attendance).
  - November 13 progress: app/rules deployed and verified; maintenance enabled; fresh backup restored and verified; all 350 old runs and event/code records removed. Routes, staff accounts, claims and other records unchanged. Approved history imported and verified: 300 runs, 1,199 names, 6,231 dated sign-ins and 2,371 undated credits; rejected TEST names removed. All five accounts rebuilt with zero failures; totals, rewards, routes, eight claims and owner Admin access verified. Sign-in callback fix deployed in v1.5.14 and verified on both hosts. Completed import fence released. The owner created the November 18 real run and completed controlled attendance/mileage/reload and ordinary-runner signup/history-claim acceptance. Final read-only audit confirms TEST cleanup, expected totals, 301 runs, 54 routes and eight claims; maintenance is off. Launch readiness review is complete.

---

## Owner decisions and operational follow-up — November 13

- [x] Paid recurring backups deliberately declined because of cost; retain the verified one-time cutover backup. Do not enable a schedule/PITR without a new owner decision.
- [x] Billing alerts configured: USD 2 monthly for the club project, actual-spend thresholds at USD 1, 1.80 and 2, both approved email recipients verified in configuration. Alerts only; no automatic shutdown.
- [x] Phone push/GPS/accessibility/icon/update checks accepted by owner; installed-app calendar subscription verified by owner. Detailed device/case records were not supplied.
- [x] Review and package the deployed launch source, rules, tests, documentation and approved artwork as release 1.6.0, tagged `1.6.0`. Private `data/`, credentials and the account-specific cleanup script stay outside the public repository. Build/deploy from the release commit and verify its identity.
- [x] Keep unbuilt features labeled as proposals rather than completed launch behavior.

## 1. 🎽 Run Organizer (Run Host / Table Coordinator)

The Run Organizer runs the Wednesday night table on the patio at Blue Note Brewing Co. They need lightweight, high-speed mobile tools to oversee the event without requiring full administrative access to site settings.

### ✅ Completed & Implemented
- [x] **Data Model Role:** `role: 'organizer'` defined in user profiles and legacy models.
- [x] **Milestone Runner Alert Dispatch:** When a runner checks in for their 5th, 50th, 100th, or 200th run, an alert record is created with the runner's shirt size and reward perks.

### 📋 Pending TODOs

#### Deferred
- [ ] **Check-In Window Bypass:** The current check-in UI enforces the run window; it has no organizer bypass toggle. This is a future feature, not a launch blocker.

#### High Priority
- [ ] **Dedicated "Run Night / Table Mode" Mobile View**
  - Create a dedicated navigation view for users with `role: 'organizer'` (and `admin`) accessible directly from the navbar or mobile bottom nav on run days.
  - Features required on this screen:
    - **Live Check-In Feed:** Real-time stream of tonight's attendees as they check in (name, distance, run vs walk, pet icon).
    - **Live Milestone & Gear Pickup Queue:** Instant visual card whenever a runner checks in to a milestone (5th, 50th, 100th, 200th run). Shows their name, shirt size on file, and a one-tap button: `[Mark Handed Out & Delivered]`.
    - **Tonight's Codeword Card:** Display tonight's secret codeword in large font; option to set the word before check-in opens; a future table view must preserve the existing post-opening lock.
    - **Assisted / Table Check-In:** Quick runner lookup search bar allowing the organizer to manually check in members whose phone battery died or who forgot their device.

#### Medium Priority
- [ ] **Run Night Quick Announcements:**
  - Let organizers send quick local push alerts (e.g., *"Group photo on the patio in 5 minutes!"* or *"Course update: Watch for wet leaves on Main St"*).
- [ ] **Check-In Summary Headcount:**
  - Running counter on the organizer screen: Total Check-Ins, 1-Mile Walkers, 3-Mile Runners, 5-Mile Runners, Dogs/Pets attending.

---

## 2. 🏃 Runner (Logged-In Club Member)

Runners are the core members of the club. They check in on mobile at Blue Note, track their lifetime stats and streaks, and work toward milestone gear.

### ✅ Completed & Implemented
- [x] **Self-service profile editing:** profile menu → Edit Profile; name, shirt size (Youth/XS–2XL), birthday, city/ZIP, preferred pace and emergency contact.
- [x] **Authentication:** Passwordless Email Magic Link + Google Sign-In with automatic session persistence.
- [x] **Check-In Flow:**
  - 2-hour pre-event window lock.
  - Codeword entry validation.
  - Distance selection from the run’s saved route choices, with measured mileage and run-specific loop limits.
  - Activity selection (Running vs Walking).
  - Pet checkoff (*"Running or Walking with a Pet? 🐕"*).
  - Celebration dialog showcasing newly unlocked badges and milestone alerts.
- [x] **Badge System:**
  - Level-up multipliers (`x2`, `x3`, etc.).
  - Multiplier caps (e.g. `x10+` for the Woodchuck Hound pet badge).
  - Badges across Milestones, Distance Routes, Streaks, Special Events, and Walking.
- [x] **Milestones Page (`/milestones`):**
  - Visual progress bar toward next gear item (5, 50, 100, 200 runs).
  - Countdown indicator (*"X runs to go!"*).
  - Blue Note $1-off draft beer perk reminder.
- [x] **Leaderboard & Community Roster:**
  - Filter by Total Miles, Total Runs, Active Streaks, and Badges.
  - Full search by name.
- [x] **PWA & Offline Readiness:**
  - Installable home screen app with web manifest and service worker.
  - Web Push Notification subscription toggle.

### 📋 Pending TODOs

#### High Priority
- [ ] **Personal Check-In History ("My Past Runs")**
  - A tab or expandable drawer where a runner can view their own historical check-in logs:
    - Date & time.
    - Route name, measured mileage and loop choice.
    - Activity type (🏃 Run vs 🚶 Walk).
    - Pet flag (🐕 Ran with pet).
    - Badges earned on that run.

#### Medium Priority
- [ ] **Post-Registration Legacy Run Claiming**
  - Allow logged-in members who skipped legacy claiming during initial signup to search and claim their historical names from their profile. Claim/reconciliation operations and signup claiming already exist; a dedicated post-registration profile entry point is still pending.
- [ ] **Custom Profile Photo / Avatar Upload**
  - Allow runners to upload a custom profile picture or avatar instead of generated initials.
- [ ] **Club Strava / Garmin Club Link**
  - Optional profile link to member's Strava profile for external activity tracking.

---

## 3. 👤 Guest / Visitor (Not Logged In)

Guests are prospective runners, visitors, or first-time runners browsing the app before attending a Wednesday run.

### ✅ Completed & Implemented
- [x] **Schedule & Calendar Access:** View all upcoming group runs, locations, start times, and download `.ics` calendar invites.
- [x] **GPX Trail Library:** Interactive OpenStreetMap tracks, elevation gain profiles, surface types, and `.gpx` file downloads.
- [x] **Public Leaderboard & Milestone Gallery:** Public member projections and milestone/gear catalogs are readable; the Standings screen is offered to signed-in runners.
- [x] **24/7/365 Member Signup:** Standalone "Join Club (Free)" flow separated from run night check-in.
- [x] **Table QR Scan Support:** Instant check-in / onboarding detection when scanning table QR codes (`?checkin=true`).

### 📋 Pending TODOs

#### High Priority
- [ ] **Guest RSVP Experience**
  - Tapping "RSVP / I'm Going" as an unauthenticated guest should prompt:
    - *"Enter your name & email to RSVP and get a Wednesday calendar invite"*.
    - Automatically links to their account when they complete sign-in.
- [ ] **Club Welcome & "How It Works" FAQ Card**
  - Mobile-friendly welcome banner for first-time visitors:
    - **When & Where:** Blue Note Brewing Co. patio, Wednesdays at 6:30 PM.
    - **Cost:** 100% free, no membership fees ever.
    - **Paces:** Walkers, run-walkers, joggers, strollers, and dogs on leash all welcome!
    - **Beer Discounts:** $1 off draft beers after runs.
    - **Parking:** Free street and downtown lot parking information.

#### Medium Priority
- [ ] **Table-Side QR Kiosk Mode**
  - Dedicated landing page specifically tuned for table display with one giant button: *"First time here? Tap to Join & Check In in 30 seconds"*.

---

## 4. 🛡️ Club Admin (Leadership & Directors)

Admins oversee the entire club system, scheduling, route library, member rosters, badges, and push notifications.

### ✅ Completed & Implemented
- [x] **Event Management:** Create, edit, and delete runs; attach GPX routes; configure codewords; toggle "Special Event".
- [x] **Badges & Special Events Studio:**
  - Create custom badges across 6 categories (Milestones, Streaks, Distance, Activity, Special Events, Pet).
  - Curated emoji picker with categorized symbols.
  - Multiplier configuration (step intervals, capped multipliers like `10+`).
  - Dynamic "Is Special Event?" option creation and badge deletion.
- [x] **Milestone Fulfillment Queue:**
  - Real-time list of runners who unlocked rewards.
  - Highlights runner's shirt size on file.
  - One-click `[Mark Handed Out & Delivered]` action recording timestamp and fulfilling admin name.
  - Historical delivery table with search and filtering.
- [x] **Single-Entry Check-In Log:**
  - Table of all check-ins with filters for date, activity, and pet tags.
  - CSV export for record-keeping.
- [x] **Announcement publisher and notification device count:** admins post in-app announcements and inspect registered devices. Actual phone pushes use Firebase Console Messaging; in-app push broadcasting and automatic run reminders remain unimplemented ([Plan B](docs/push-notifications-plan-b.md)).
- [x] **Legacy Runner Claim Pool:** Complete audit roster of historical runs and tracking of claimed vs unclaimed aliases.
- [x] **User Role Management:** Admins promote/demote member, organizer and admin from the roster (not their own role); delete runners.
- [x] **GPX Route Library Management:** Route Studio edits routes (new immutable versions) and deletes them; routes referenced by runs are protected.
- [x] **Route creation and turn-by-turn directions:** In-browser engine, review studio, route map with GPS dot, concise/verbose directions (see `docs/route-creation-architecture-plan.md`).

### 📋 Pending TODOs

#### High Priority
- [ ] **Milestone Gear Photo Uploads / Image URLs**
  - Replace the placeholder mockup boxes in `MilestonesPage.tsx` with admin-configurable images:
    - 5-Run Woodchucker Shirt photo.
    - 50-Run Woodchucker Hat photo.
    - 100-Run Woodchucker Beer Mug photo.
    - 200-Run Custom Water Bottle photo.
  - Admin UI to upload images or paste hosted image URLs.

#### Medium Priority
- [ ] **One-Click Club Data Backup & Restore (JSON)**
  - Button in Admin dashboard to download a single JSON backup of all users, check-ins, custom badges, and runs.
  - Import button to restore or seed from backup, protecting against accidental data loss.
- [ ] **Batch Member Stat Adjuster**
  - Implement the UI controls for `onUpdateMemberStats` so admins can manually adjust a member's total runs or miles if a discrepancy is reported.

---

## 5. Suggested Sprint Roadmap

| Sprint | Focus Area | Deliverables |
| :--- | :--- | :--- |
| **Sprint 1** | **Run Night Organizer Experience** | • Dedicated Mobile Organizer View (`/organizer` or Table Mode)<br>• Live tonight's check-in stream & headcount<br>• Table milestone gear fulfillment queue with shirt sizes<br>• Assisted manual runner check-in |
| **Sprint 2** | **Runner Self-Service & History** | • Extend existing profile settings if needed<br>• "My Past Runs" personal log view<br>• Post-registration legacy run claim button |
| **Sprint 3** | **Admin Role & Asset Management** | • Milestone gear photo uploads / URL manager<br>• Additional admin tools as needed (role management and route edit/delete already implemented) |
| **Sprint 4** | **Guest Experience & Welcome** | • Guest RSVP with email collection<br>• "How Woodchuckers Works" welcome & FAQ guide<br>• Full JSON database backup / restore |
