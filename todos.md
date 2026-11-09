# Woodland Woodchuckers Run Club — Product Roadmap & TODOs

> **Application Status:** Production PWA live at [https://woodland-woodchuckers.web.app](https://woodland-woodchuckers.web.app)  
> **Infrastructure:** Firebase Hosting + Firestore (100% Free Spark Tier, zero monthly cost)  
> **Design Philosophy:** Mobile-First for runners & organizers; responsive desktop/tablet tools for admins.  
> **Last Updated:** November 7, 2026

---

## 1. 🎽 Run Organizer (Run Host / Table Coordinator)

The Run Organizer runs the Wednesday night table on the patio at Blue Note Brewing Co. They need lightweight, high-speed mobile tools to oversee the event without requiring full administrative access to site settings.

### ✅ Completed & Implemented
- [x] **Data Model Role:** `role: 'organizer'` defined in user profiles and legacy models.
- [ ] **Check-In Window Bypass:** Deferred. The current check-in UI enforces the run window; it has no organizer bypass toggle.
- [x] **Milestone Runner Alert Dispatch:** When a runner checks in for their 5th, 50th, 100th, or 200th run, an alert record is created with the runner's shirt size and reward perks.

### 📋 Pending TODOs

#### High Priority
- [ ] **Dedicated "Run Night / Table Mode" Mobile View**
  - Create a dedicated navigation view for users with `role: 'organizer'` (and `admin`) accessible directly from the navbar or mobile bottom nav on run days.
  - Features required on this screen:
    - **Live Check-In Feed:** Real-time stream of tonight's attendees as they check in (name, distance, run vs walk, pet icon).
    - **Live Milestone & Gear Pickup Queue:** Instant visual card whenever a runner checks in to a milestone (5th, 50th, 100th, 200th run). Shows their name, shirt size on file, and a one-tap button: `[Mark Handed Out & Delivered]`.
    - **Tonight's Codeword Card:** Display tonight's secret codeword in large font; option to set or rotate the word on the fly.
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
- [x] **Authentication:** Passwordless Email Magic Link + Google Sign-In with automatic session persistence.
- [x] **Check-In Flow:**
  - 2-hour pre-event window lock.
  - Codeword entry validation.
  - Distance selection (1, 3, or 5 miles with GPX route names).
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
- [ ] **Self-Service "Edit My Profile" Modal**
  - Give runners a settings modal or button on the Leaderboard / Navbar to edit:
    - **Shirt Size:** Crucial so runners can update their size (XS - 3XL) before hitting their 5-run shirt milestone.
    - **Emergency Contact:** Name and phone number for safety.
    - **Display Name & Preferred Pace:** (e.g. "9:30 min/mi", "Walker", etc.).
    - **Home City / ZIP Code**.
- [ ] **Personal Check-In History ("My Past Runs")**
  - A tab or expandable drawer where a runner can view their own historical check-in logs:
    - Date & time.
    - Route name & distance choice (1, 3, or 5 miles).
    - Activity type (🏃 Run vs 🚶 Walk).
    - Pet flag (🐕 Ran with pet).
    - Badges earned on that run.

#### Medium Priority
- [ ] **Post-Registration Legacy Run Claiming**
  - Allow logged-in members who skipped legacy claiming during initial signup to search and claim their pre-2026 historical runs from their profile.
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
- [x] **Public Leaderboard & Milestone Gallery:** Unrestricted read access to club leaderboards and milestone gear rewards.
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
    - **When & Where:** Blue Note Brewing Co. patio, Wednesdays at 6:00 PM.
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
- [x] **Push Notification Broadcaster:** Send instant notifications to all subscribed mobile and desktop PWAs.
- [x] **Legacy Runner Claim Pool:** Complete audit roster of pre-2026 runs and tracking of claimed vs unclaimed aliases.

### 📋 Pending TODOs

#### High Priority
- [ ] **User Role Management (Promote / Demote from UI)**
  - Add a role dropdown in the Admin Roster table (`Active User Profiles`) allowing admins to change a user's role:
    - `member` (standard runner)
    - `organizer` (run host with table access)
    - `admin` (full permissions)
  - Prevents needing to manually update database documents.
- [ ] **Milestone Gear Photo Uploads / Image URLs**
  - Replace the placeholder mockup boxes in `MilestonesPage.tsx` with admin-configurable images:
    - 5-Run Woodchucker Shirt photo.
    - 50-Run Woodchucker Hat photo.
    - 100-Run Woodchucker Beer Mug photo.
    - 200-Run Custom Water Bottle photo.
  - Admin UI to upload images or paste hosted image URLs.

#### Medium Priority
- [ ] **GPX Route Library Management (Edit & Delete)**
  - Currently admins can upload new GPX files via `GpxUploader`, but cannot edit names, descriptions, or delete obsolete routes from the library.
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
| **Sprint 2** | **Runner Self-Service & History** | • "Edit My Profile" modal (shirt size, emergency contact, pace)<br>• "My Past Runs" personal log view<br>• Post-registration legacy run claim button |
| **Sprint 3** | **Admin Role & Asset Management** | • Member role promotion (`member` ➔ `organizer` ➔ `admin`)<br>• Milestone gear photo uploads / URL manager<br>• Route library edit / delete tools |
| **Sprint 4** | **Guest Experience & Welcome** | • Guest RSVP with email collection<br>• "How Woodchuckers Works" welcome & FAQ guide<br>• Full JSON database backup / restore |
