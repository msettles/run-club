# Go-live readiness review — November 13, 2026

The owner authorized and completed rollout steps 1–4 on November 13, 2026: app/rules deployment, paused backup and run replacement, approved import, then account/reward rebuilding and verification. The completed work is packaged as release **1.6.0**; the app version and deployment receipt identify the active build. The owner explicitly authorized resuming club changes for controlled acceptance on November 13; maintenance is now off and the completed historical-import fence is released. This is the approved retained-staff run/history refresh, not a broader account reset or permission to open check-ins.

Verified live: **300 historical runs, 1,199 historical names, 6,231 dated check-ins, 2,371 undated credits, 54 unchanged routes, five staff accounts and eight unchanged claims**. All five accounts recomputed with zero failures and no pending claims or merchandise delivery. The rebuild added 765 current reward proofs and retained all 1,101 prior proofs and unrelated records.

All five retained accounts were reconciled against their claimed run identities and undated credits. Shared attendance was counted once, and profile/standings totals agree. Individual runner names, totals and claim reconciliation remain in private ignored verification artifacts rather than this public release document.

The historical tags match the reviewed file, including no Thanksgiving events. Owner Google sign-in and Admin access passed on both production domains after fixing the service worker's interception of Firebase's sign-in callback in v1.5.14. Production build and 219 unit tests passed for that correction. The full imported dataset also passed the application's rebuild under the deployed security rules in an isolated emulator as the authenticated owner.

The fresh paused backup contains 4,988 documents, all restored and compared in isolation before deletion. Cutover, import, reconciliation, authentication and preservation evidence remains private under `data/deployment-preparation/`; the backup remains immutable. A no-op historical migration was verified in one snapshot for the live rebuild after the full 1,199-name migration had passed under rules in isolation; the application account/reward calculations were reused unchanged.

**Final review — ready for launch:** owner confirmed that attendance and correct mileage persisted after reload and that ordinary-runner signup and historical-name claiming both passed. The designated TEST run, its event/secret/lookup and attendance are now absent; there are 301 runs and no app check-ins or gear alerts. All five profiles have returned to their verified pre-test totals, with no pending claims or gear work. Maintenance and the import fence are off. No remaining launch blocker was identified. The final pre-1.6.0 live audit verified v1.5.17; release 1.6.0 preserves the accepted behavior. This review records readiness; it does not send invitations or announce launch.

The read-only final audit compared every historical run, name and dated attendance record to the frozen approved inputs, checked all run/code lookup relationships, all five standings projections and totals, all 765 current reward-proof sources, all eight retained claims and all 54 route contents (allowing expected reference markers). It found no mismatches or active test leftovers. Private evidence: `data/deployment-preparation/final-go-live-review.json`.

**Owner decisions and follow-up:** paid recurring backups were deliberately declined because of cost; preserve the verified one-time cutover copy and do not enable a schedule/PITR without a new decision. Owner-approved USD 2 monthly project billing alerts are now configured and verified for both approved recipients, at USD 1, 1.80 and 2 of actual spend; no automatic shutdown is configured. The owner also accepted phone push, GPS, accessibility and icon/update checks and verified installed-app calendar subscriptions. Detailed device/case records were not supplied. Release 1.6.0 collects the reviewed launch source, rules, tests and documentation in Git; private verification files remain excluded.

Current documentation follow-ups and proposal status are tracked in [documentation-status.md](documentation-status.md). The calendar feed server response was also verified during the November 13 documentation review; installed-PWA subscription behavior has since been explicitly verified by the owner.

## Verified foundations

- The live database, route CSV and GPX folder each contain **54 routes**. All 54 Garmin-derived IDs match; there are no extra/missing IDs or GPX files. Every saved route has geometry and a positive distance. The CSV has 54 data records plus its header, not 55 routes.
- Approved files: `data/approved-history-2026-11-13/profiles.csv`, `runs.csv`, `checkins.csv`. They contain **1,199 historical names, 300 runs, 6,231 dated check-ins and 2,371 undated credits**. The TEST run and TEST/TEST2/TEST3 profiles are excluded. COOLDOWN on October 6, 2021 retains 19 check-ins. Distinct YOLOSPCA/CLYDESDALE runs and the three approved Tuesday holiday runs remain.
- The attendance/maintenance/recovery changes have 221 unit tests, 47 integration tests and 77 rules/seed checks passing; the production build passes. The new identity model preserves separate canonical runs, combines shared claimed attendance, excludes overlapping app attendance, and keeps undated credits additive. Tests cover paused import/rebuild, blocked non-admin writes and interrupted merchandise delivery with a fulfilled item preserved.
- Pre-cutover inventory: 350 existing runs, zero app check-ins, five registered profiles, eight historical-name claims, 54 routes, seven badges, five milestones, three special-event definitions, zero gear alerts and two push-device records. One profile is an admin; four are organizers. There are no scheduled upcoming runs or configured live check-in windows.
- The readiness backup contains 4,987 Firestore documents. This review restored all 4,987 into an isolated local Firestore emulator and compared every restored document, including all 54 routes and preserved Firestore value types, with the backup. Verification evidence is in `data/go-live-review/restore-verification.json`. Firebase Authentication is not part of that backup and is not modified by the proposed run/history refresh.
- Projected totals for all retained accounts were independently calculated from the approved aliases and shared-run identities. Under the current merchandise baseline rule, none of these already-linked accounts owes an additional claim-merchandise item. Private reconciliation evidence stays in `data/go-live-review/` and is excluded from source control.

## Findings to resolve before opening to runners

### 1. Account/claim scope — resolved by owner approval

The owner confirmed keeping all five real staff accounts (one admin, four organizers) and all eight historical claims for launch. The go-live policy now records that scope explicitly. Preserve Auth accounts, roles and push registrations. Remove only the rejected TEST/TEST2/TEST3 historical aliases and run/history records already identified for replacement. Unexpected accounts/claims discovered at cutover require classification rather than automatic deletion.

### 2. Maintenance/reward-rebuild conflict — implemented and tested

A dedicated `settings/maintenance.active` switch now gates all client mutation rules. Members and organizers cannot register profiles, check in, edit data or release the pause. Public browsing and sign-in remain available. Admins retain the validated import/repair path, including reward-proof writes while the separate legacy import lease is active. The admin dashboard has an explicit pause/resume control and the app displays a maintenance notice.

Use this maintenance switch for cutover, not the legacy import lease as a substitute for a global pause. Keep it enabled after any failed or interrupted step. Record the execution stage: finish run deletion before starting the new import, and never restart deletion once import has begun. The three-file importer can safely be repeated to resume partial writes. Capture the final backup only after server rules enforce the pause.

### 3. Claim merchandise recovery — implemented and tested

Claims now atomically save `claimGearPending` with the reservation. The flag survives an interrupted alert write and is cleared only after every owed alert is saved or already exists. Reload/reward refresh, repeating the claim and admin recomputation retry this saved work. Alert creation is transactional, so a second tab/retry cannot reset a fulfilled item. Tests interrupt delivery after the first of several alerts, simulate a reload, fulfill the first item, and verify that only the missing items are added.

Ordinary history imports/recomputation without pending claim work still do not issue a historical gear backlog. The agreed largest-name baseline and additive undated-credit policy are unchanged.

### 4. Historical special-event classification — owner reviewed

The owner reviewed and corrected the tags in the approved `runs.csv`. No Thanksgiving runs is intentional. Import and reward rebuilding use only these explicit tags; a blank tag gives no special-event credit. Code words validate check-in only and do not identify, merge or classify attendance. The approved input already consolidates historical attendance to one run per date; importing does not repeat that consolidation.

### 5. First real run — owner created and verified

The owner created **Wed 11/18 Run**, November 18, 2026 at 6:30 PM, Blue Note Brewing Company. There are now **301 runs: 300 historical plus this new event**. The event, saved code-word credential and lookup agree. Check-in opens November 18 at 4:30 PM Pacific and closes at 11:59:59 PM Pacific.

The two Cleveland Rock choices credit their measured **1.19 and 3.28 miles**, while showing rounded 1.2/3.3-mile labels. Both references are protected; all 54 routes retain their original content apart from expected reference markers. No attendance was inserted for this future run. Controlled acceptance used the owner-created TEST event; the owner confirmed success, the test event and attendance are gone, and maintenance is now off. The next real run remains scheduled for November 18.

### 6. Release acceptance — reuse prior testing, verify the changed paths

The owner Auth account was verified to exist, be enabled and have a verified email and Google provider, using a read-only lookup. Its admin Firestore role remains intact. Live owner sign-in and Admin access were observed on both production domains after the v1.5.14 service-worker correction. This is an owner-account check, not an enumeration of all Authentication users; no Auth records were changed.

The owner reports most prior phone/sign-in checks have already been completed. Reuse those accepted results. For this release, focus the remaining live checks on maintenance enforcement, the new one/two-name deduplication flow, interrupted merchandise retry, owner Admin access and the installed app's updated release. Use an ordinary member for member-only paths. The old per-device matrix has not yet been reconciled case-by-case with the owner's report; do not claim new release paths passed solely because older flows or emulator tests passed. See [the device plan](real-device-test-plan.md) and [verification status](browser-device-testing.md).

## Corrected execution outline

1. Keep the approved staff accounts/claims. Use the owner-reviewed historical tags and freeze the three approved CSVs and hashes.
2. Coordinate a maintenance release: enable the maintenance switch and deploy its enforcing rules and app. Verify the pause actually blocks ordinary/staff writes before touching data; keep admin recovery access.
3. Take a fresh recoverable backup and route manifest with the server-side pause enforced. Record cleanup/import/rebuild/verification stages so an interrupted operation resumes the correct stage.
4. Replace the old run/event/secret/code records and import the approved history. Preserve the five accounts, eight valid claims, routes, unrelated catalogs/settings and legitimate fulfilled rewards. Remove only the rejected test aliases and explicitly authorized dependent data.
5. Reconcile every retained profile, standings, shared attendance, badges and reward proofs. Retry any saved pending merchandise work. Keep maintenance on until there are zero failed members or pending migration/claim work.
6. Verify historical counts, exception dates, every route ID/content hash and owner access. At this stage there should be 300 historical runs.
7. Create the next real run using owner-approved details. It is intentionally created after the run deletion/import, yielding 301 total runs when one new event is added.
8. Explicitly resume at the controlled acceptance stage, reuse prior phone testing and verify the changed member flow with an approved identity. Pause again if it fails. Invite runners after acceptance; account explicitly for any designated test records introduced during that check.

After launch, keep a named owner and a repeatable backup/restore procedure. The current backup is a verified one-time readiness snapshot, not a scheduled ongoing backup service. No retention purge or automatic deletion is introduced.

## Publishing during maintenance — clarified November 13

An organizer's failed publish was incorrectly described as a locked code word because the app mapped every permission refusal to that message. Maintenance correctly blocks organizer writes. v1.5.15 checks the maintenance status before organizer scheduling and explains that the club admin must publish while paused. Generic permission refusals no longer claim the word is locked. Verified in integration: an organizer cannot publish while paused and an admin can atomically publish the run, event, secret, lookup and route-reference marker. No security rules were loosened, no maintenance pause was released and no real run was invented by this fix. Validation: 221 unit tests, 47 integration tests and production build pass.

## Controlled acceptance — opened by owner November 13

The owner created a designated TEST run for November 13 at 6:30 PM. Its check-in window was verified open (4:30 PM through 11:59:59 PM Pacific). After the owner explicitly approved resuming club changes for testing, maintenance was turned off and read back as false. During the test there were 302 runs: 300 curated historical runs, the November 18 real run, and the designated test event. After test cleanup the final count is 301. Final result: the owner confirmed attendance and correct mileage persisted after reload, and ordinary-runner signup/history claiming passed. A later read-only inventory confirms the designated test event and attendance are gone and totals/mileage are restored. The final review performed no deletions or other live changes. Do not repeat historical replacement.
