# Documentation status and roadmap

Updated November 15, 2026 for deployed app 1.6.4. The November 13 launch counts below are a dated baseline, not a fresh production inventory. Release 1.6.3 added the deployed `assistedCheckIn` function and self-service/table screens; 1.6.4 separated staff action groups. Both 1.6.4 CI jobs passed and both live hosts matched its built assets. This document changes no live settings, sends no notifications, schedules no backups and authorizes no reset. See [go-live-readiness-review.md](go-live-readiness-review.md) for the dated operational result.

## Known current state

| Area | Current evidence |
| --- | --- |
| Launch history | Imported and reconciled: 300 historical runs, 1,199 names, 6,231 dated attendance records and 2,371 undated credits. |
| Current run count | 301 after owner-created November 18 run and acceptance-test cleanup. The 350 old runs must not be deleted/imported again. |
| Routes and accounts | 54 routes, five retained staff accounts, eight retained claims. Route reference flags may change legitimately when scheduling; geometry/content was preserved. |
| Attendance and rewards | Shared claimed runs count once by run ID/date; code words validate check-in only. Explicit special-event tags govern credit; blank means none. No Thanksgiving event tags is intentional. |
| Acceptance | Owner confirmed signup/claims and attendance/mileage persistence after reload. Owner Google/Admin access observed on both production domains. Owner subsequently confirmed phone push, GPS, accessibility and icon/update checks all look good; this is owner-reported acceptance, not independently recorded case-by-case device evidence. |
| Controls | Maintenance and historical-import fence explicitly released. No pending claims or merchandise work in the final audit. |
| Calendar | Server `/calendar.ics` returned HTTP 200, `text/calendar` and valid calendar content containing the November 18 run during this review. Owner also verified calendar subscriptions from the installed app. Source: `functions/src/index.ts`. |
| Notifications | Device registration and in-app announcements implemented; actual pushes sent through Firebase Console. No app-side push trigger or automatic reminder scheduler in current functions source. |
| Backups | One-time 4,988-document paused cutover backup restored and compared in isolation. Owner deliberately declined paid recurring backups because of cost; retain the existing one-time cutover copy. Do not enable scheduled backups or PITR without a new owner decision. |
| Profile settings | Edit Profile, signup claiming and admin assignment implemented. Profile-based historical claiming and My Runs shipped in 1.6.3. See [self-service features](run-night-and-self-service.md). |

A public invitation or launch announcement is an owner action; documentation records readiness, not an announcement sent on the owner's behalf. Counts here are a dated baseline and will change with legitimate registrations and attendance.

## Completed release and owner decisions

| Status | Item | Recorded result |
| --- | --- | --- |
| Decided | Paid recurring backups | Owner declined because of cost. Keep the verified one-time copy; do not enable scheduled backups/PITR as an outstanding launch task. See [backup-and-restore.md](backup-and-restore.md). |
| Completed | Reproducible release 1.6.0 | Launch source, rules, tests, documentation and approved artwork are packaged in commit `2909f0a`, tagged `1.6.0`. The roadmap records build/deploy identity verification complete; see [release notes](releases/1.6.0.md). Private data and credentials remain excluded. |
| Completed | Billing alerts | Owner-approved USD 2 monthly project budget is configured and read back successfully. Actual-spend email thresholds: USD 1, 1.80 and 2, delivered to the two owner-approved addresses through enabled email channels. No spend cap or automatic service shutdown is configured; no backups were enabled. Full recipients/resource details are in the private verification record. |
| Owner-confirmed | Phone push, GPS, accessibility and installed updates | Owner reports all look good. Detailed device/OS/case records remain optional evidence, not an uncompleted launch requirement. No new test messages were sent. |
| Owner-confirmed | Calendar subscription inside the installed PWA | Owner explicitly verified it. Server feed response also passed the read-only check. |

These items are closed, accepted or explicitly declined; none is an outstanding launch task. Keep the dated evidence without requiring accepted device tests or the completed history replacement to be repeated.

## Roadmap items that remain proposals

- A check-in-window bypass remains deferred. Run Night, assisted check-in inside the normal window, My Runs and profile historical claiming shipped in 1.6.3; see [feature behavior](run-night-and-self-service.md).
- In-app push sending and automatic run reminders; [Plan B](push-notifications-plan-b.md) is a design, not a deployed sender.
- One-click full backup/restore and gear image management.
- [Social preview metadata](social-sharing-enhancement.md), centralized [club configuration](club-extraction-plan.md), route print/report/mile-marker/privacy-trim extras.

A pending enhancement is not automatically a launch requirement. Do not enable services, create test attendance or send messages merely to complete a documentation checkbox.

## Document ownership and historical evidence

| Documents | How to read/update them |
| --- | --- |
| `docs/README.md`, `docs/help/`, `README.md`, `setup.md`, `new-club-setup.md` | Documentation index, user help and setup/deployment instructions. Rules/site deploy together; calendar and assisted-check-in server provisioning is selective. |
| `go-live-policy.md`, `go-live-readiness-review.md`, `todos.md` | Completed retained-staff launch scope, dated evidence and actual remaining roadmap. Do not treat original reset instructions as a new authorization. |
| `roles-and-permissions.md`, `import-format.md`, `backup-and-restore.md` | Current operational behavior and limits, including maintenance, deduplication, explicit tags and backup scope. |
| `browser-device-testing.md`, `real-device-test-plan.md` | Owner-reported acceptance, observed browser checks and optional per-device evidence templates must remain distinguishable. |
| `audit-fixes-2026-11-09.md`, `independent-code-review-2026-11-09.md`, `review-round-2-audit.md`, `tooling-maintenance.md`, `resolver-fork.md` | Historical findings and release-time counts/advisories. Preserve them; read their supersession notes rather than interpreting them as today's status. |
| `staff-pagination.md`, `performance-loading.md`, `run-sharing.md`, `osm-caching.md`, `modal-accessibility.md` | Implemented feature behavior. Test totals are historical release evidence unless explicitly rerun and dated. |
| `route-import.md`, `route-creation-architecture-plan.md`, `route-resources-plan.md` | Implemented route import/engine plus separately identified unbuilt extras. The removed Python prototype is not a current dependency. |
| `push-notifications-plan-b.md`, `social-sharing-enhancement.md`, `club-extraction-plan.md` | Proposals; do not describe their planned behavior as available features. |
| `BRANDING.md` | Current approved artwork alongside historical implementation notes. Deployed HTML/manifest references determine active assets; a file merely present in `public/` is not necessarily in use. |

## Documentation-review validation

All 30 top-level/documentation Markdown files were included in the November 13 consistency pass. Local link targets and fenced code blocks were checked, and npm commands in current operational guides were compared with `package.json`. The live calendar server response passed. No app code, service configuration, account, attendance, permission or billing changes were made by this documentation review. No new runtime test suite is claimed for documentation-only edits.

The second pass also corrected the club's proposed configuration default to Wednesday 6:30 PM, marked old route type/UX examples as historical proposals, linked current staff pagination behavior, removed the claim that retained old proofs occupy no storage, and restricted any future push rollback to its own functions so it cannot silently remove the existing calendar. Old push cost/delivery assumptions were removed; actual costs and device receipt must be measured if that proposal is implemented.

## Owner follow-up decisions — November 13, 2026

Paid recurring backups are declined because of cost. Phone push, GPS, accessibility and icon/update categories are owner-accepted, and installed-app calendar subscription is owner-verified. Proposed features remain labeled proposals.

The separate owner-authorized billing-alert setup enabled the Billing Budget API, reused/created email notification channels and created a project-scoped USD 2 monthly alert-only budget. Thresholds are 50%, 90% and 100% of actual spend (USD 1, 1.80 and 2). Both approved recipient channels and the budget were read back and verified. Recipient details remain private in `data/deployment-preparation/billing-alert-verification.json`. Alerts do not cap spending or shut down the app. No backups or app/database changes were made by this setup.

The owner subsequently authorized the 1.6.0 commit, exact `1.6.0` tag and deployment. The release records source changes without importing, deleting or modifying club attendance. Deployment verification is kept separately; a Git commit/tag alone does not deploy the app.

## Roadmap priority — November 14, 2026

The owner selected run publishing to Instagram/Facebook as the next feature: save a run, review a generated post, then explicitly publish to the selected club accounts. The preview UI is deployed; Meta server exports remain inactive. Account access, secret configuration, server activation and live acceptance remain outstanding. See [social-publishing.md](social-publishing.md). This is separate from link-preview metadata. Push automation was verified November 14: source contains no push sender/reminder scheduler, and a read-only `firebase functions:list` on the club project lists only `calendar`. Announcements currently write to the in-app feed. Social publishing remains the selected implementation priority.

## Table and self-service implementation — November 14, 2026

While Meta login setup is pending, the owner requested Run Night/Table Mode, My Runs, profile-based historical claiming and assisted check-in. All four were implemented and validated locally, then deployed in 1.6.3. The active callable is `assistedCheckIn`; Meta functions remain inactive. See [behavior, safeguards and activation](run-night-and-self-service.md). The existing accepted launch state and production data are unchanged.

## Release authorization — November 14, 2026

The owner subsequently authorized committing, pushing and deploying the table/self-service update as app version 1.6.3. Earlier local-only statements record the pre-release stage. See [release scope](releases/1.6.3.md); the deployment receipt identifies the live commit. The existing 1.6.2 artwork tag is not moved, and Meta sender activation remains separate.


## Current release and help — November 15, 2026

Release **1.6.4**, commit `a561efa`, is deployed. The 54-case browser suite covers all four roles on desktop/mobile, including absence of staff controls for guests/members and separate Organizer tools rows. Its unit, integration, rules, build and browser CI jobs passed. Both hosting domains served the exact release assets; the calendar feed remained available.

Start with the [documentation index](README.md), [runner guide](help/runner-guide.md), [organizer/admin guide](help/organizer-guide.md) or [troubleshooting](help/troubleshooting.md). The documentation refresh updates current guidance without reinterpreting old review-time counts as new tests. Facebook/Instagram access and service activation remain pending. Push sending/reminders remain unimplemented. Paid recurring backups stay declined; per-device evidence stays optional after owner acceptance.


## Public project documentation — November 15, 2026

A standalone GitHub Pages website introduces Run Club, current features, help, setup and the gradual generalization roadmap. It renders an explicit selection of the existing Markdown guides. The full repository, audit records, private data and Firebase app build are excluded from the published artifact. Pages deployment is independent of the live Woodland application. See [site maintenance instructions](../website/README.md).

Ko-fi is an outstanding account/link setup task; no funding account, payment link or sponsorship benefits are configured. The next platform steps are small configuration changes, an eventual dedicated Woodland fork and an isolated fictional demonstration club. They are proposals, not delivered behavior.
