# Run Night, My Runs and historical claiming

Implemented November 14, 2026 at the owner's request. The owner subsequently authorized commit, push and deployment as app version 1.6.3; see [release scope and verification](releases/1.6.3.md). The local validation below records the pre-deployment evidence, not live attendance changes. Social publishing and Meta account setup remain separate work.

## Run Night / Table Mode

Organizers/admins open **Run Night / Table Mode** from the Runs page or profile menu. The mobile bottom navigation offers **Run Night** for staff; Standings remains available in the profile menu and desktop navigation. Guests and ordinary members do not get table controls.

The table selects an available published run from today onward, preferring one whose window is currently open. When none is open it prefers the next run rather than an earlier closed event. Staff can choose another loaded upcoming run. It shows:

- Live checked-in total, running/walking totals, and the number of attendees marked as bringing a pet. The pet checkbox counts participating runners with a pet, not the number of individual animals.
- Headcounts by actual saved route/loop choice, with measured mileage and running/walking breakdowns. No fixed 1/3/5-mile tiers are invented.
- A searchable attendance feed showing recorded name, activity, mileage, route, check-in time and pet participation.
- Tonight's private code word. Before opening, the existing Edit Run screen can change it; existing server locks still apply after opening.
- Milestones and gear for this run's attendees, including earlier gear still owed to someone attending again, shirt sizes and **Mark delivered**. Recognition-only milestones have no delivery button. Fulfilled records are preserved.
- **Runner details**, opening the existing run roster/emergency-contact view.

Attendance and pending gear reuse the existing staff live subscriptions. Table readiness waits for attendance and gear snapshots, and stale-session callbacks cannot restore readiness after sign-out. Today's attendance is within the existing recent-staff query window; no new retention rule or broad historical subscription is introduced. Loading/error states remain visible.

## Assisted check-in

Staff open **Assist check-in**, search all registered profiles by name/email, select a runner, then choose a saved route, valid loops, running/walking and pet participation. A final confirmation states the runner, activity and credited mileage. Unregistered visitors must join first.

The deployed path is the authenticated callable **assistedCheckIn**, in `us-central1`. It verifies the actor's current staff profile using the server, reads the runner/run/event/code word, and uses the server clock to enforce the normal check-in window. There is no organizer or admin window bypass. Maintenance or an active historical import pauses this workflow for every role. Deleting profiles/runs, incomplete registrations, pending historical claims and invalid route/loop choices are refused.

A Firestore transaction reuses the existing check-in/reward calculator and atomically writes the check-in, attendance counters/mileage, public standings projection, RSVP and new milestone alerts. Prior attendance and claimed history are read inside the transaction. Shared canonical attendance remains deduplicated; undated credits are retained. Streak freshness uses the same Monday-based weeks as reward proofs. Fulfilled milestone alerts are never overwritten.

An existing check-in is an idempotent success: no counters, mileage, choices or awards are changed. This first version creates missing attendance only; the runner uses normal check-in editing for changes. Competing requests cannot add attendance twice. If the result cannot be confirmed, staff can retry safely.

`checkins.source` is `admin` for assisted attendance. A separate **server-only `assisted_checkins/{runId}_{email}` audit** records actor email, server time, runner, run and choices. Existing catch-all rules deny client reads/writes to this audit, including admin clients. Administrators with authorized Firebase Console access can inspect it. No broader client profile-edit permission is granted. Ordinary profile/role management remains unchanged.

Local mode uses the same calculator and window policy with synthetic browser data; its staff audit is retained in `woodchuckers-assisted-checkins` in localStorage. Local mode is not a substitute for server authorization testing.

## My Runs

Signed-in members open **My Runs** from their profile menu. It shows only their own attendance, with the existing private rules still enforcing access.

The view combines app attendance with the histories of names they have claimed. Shared dated runs appear once, with app details preferred when both sources describe the same canonical run. Distinct runs on the same date remain distinct. A separate summary shows `pre2021Runs` undated/imported credits; these remain additive and are not assigned invented dates or mileage.

Rows show the recorded date/time, title where available, route, credited mileage, loops, activity and pet participation. Source labels distinguish app, organizer-assisted and historical attendance. Missing historical details are stated explicitly. No per-run badge award history is inferred; current badge totals remain on Milestones.

Run links use the existing shared-run URL. Saved route links resolve the recorded route choice, including older aliases, through that run's meetup on demand. Unavailable/deleted content reports an error instead of substituting another route.

The screen renders pages of 25 without deleting anything. The underlying own-attendance query remains complete, as already required for totals/rewards; this is display pagination, not a new cursor-paged database query. Refresh reloads the view. Corrections remain an admin workflow; this screen is read-only.

## Claim historical runs from the profile

Signed-in members open **Claim historical runs** from their profile menu or My Runs. The dialog shows linked names and searches the available historical-name pool. A member selects one name, reviews its dated/undated counts and confirms that it is their own history.

Unclaimed private attendance cannot be read before reservation. The preview therefore states the undated credit and an upper bound on dated additions, rather than promising an exact deduplicated total. The existing transactional claim/reconciliation path computes the exact total after confirmation, handles competing claims and shared attendance, and retains claim/reward evidence.

Saved interrupted claims expose **Finish interrupted claim**. If the claim is saved but a secondary reward refresh fails, the UI reports that distinction and allows reload/retry without duplicate credit. Already claimed names cannot be claimed again. Names owned by somebody else require an admin; the dialog provides no self-service transfer, unclaim or deletion.

The history loader guards account changes, and private page/dialog state is keyed by signed-in email. Existing maintenance/import fences continue to govern claiming.

## Activation and validation

Deploy updated hosting and the new **assistedCheckIn** function together for full functionality. Existing Firestore authorization already supports the history/claim reads and existing claim operations; no rules expansion is needed. Preserve the deployed calendar and social functions when selecting deployment targets. No database reset, migration, history replacement, account cleanup or synthetic production check-in is required.

Validation uses synthetic local/emulator data. The server integration suite covers atomic attendance/rewards/audit writes, simultaneous requests, actual authorization/window checks, maintenance/import refusal, fulfilled-gear preservation, alias deduplication and pending/deleting profiles. Rules tests verify private audit collections remain inaccessible to browser clients. Browser checks cover My Runs privacy/pagination, profile claiming and reload, assisted table check-in, live totals, gear delivery and closed windows in Chromium/mobile WebKit. Live production device acceptance of these new paths remains separate from the completed November 13 launch acceptance.

Final local checks: 250 unit tests, 54 emulator integration tests and 78 rules/seed checks passed. The full browser suite passed all 46 cases; the eight new self-service/table cases were rerun successfully after the final UI/recorded-route changes. App/browser/function type checks, production/function builds and lazy bundle checks pass. Lint has zero errors and 46 existing warnings. Unit/build checks used Node 24.22.2. Desktop and mobile screenshots of the table, claim confirmation and personal history were inspected. Local validation performed no live check-ins, claims, messages or cleanup; authorized deployment is tracked separately from these tests.
