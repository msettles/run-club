# Documentation status and remaining checks

Reviewed November 13, 2026 against the current source, the completed launch review and the read-only production checks recorded that day. This document changes no live settings, sends no notifications, schedules no backups and authorizes no reset. See [go-live-readiness-review.md](go-live-readiness-review.md) for the dated operational result.

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
| Profile settings | Edit Profile implemented. Signup history claiming and admin assignment implemented; dedicated post-registration claiming from the profile remains a roadmap item. |

A public invitation or launch announcement is an owner action; documentation records readiness, not an announcement sent on the owner's behalf. Counts here are a dated baseline and will change with legitimate registrations and attendance.

## Checks still requiring evidence or an operational decision

| Priority | Check | What closes it |
| --- | --- | --- |
| Decided | Paid recurring backups | Owner declined because of cost. Keep the verified one-time copy; do not enable scheduled backups/PITR as an outstanding launch task. See [backup-and-restore.md](backup-and-restore.md). |
| Release 1.6.0 | Reproducible release | The owner authorized collecting the reviewed launch fixes, rules, tests, documentation and approved artwork into release 1.6.0 with tag `1.6.0`. Private `data/`, credentials, individual reconciliation and the one-off account-specific cleanup script remain excluded. Build after the commit so the deployed app reports that source checkpoint. |
| Completed | Billing alerts | Owner-approved USD 2 monthly project budget is configured and read back successfully. Actual-spend email thresholds: USD 1, 1.80 and 2, delivered to the two owner-approved addresses through enabled email channels. No spend cap or automatic service shutdown is configured; no backups were enabled. Full recipients/resource details are in the private verification record. |
| Owner-confirmed | Phone push, GPS, accessibility and installed updates | Owner reports all look good. Detailed device/OS/case records remain optional evidence, not an uncompleted launch requirement. No new test messages were sent. |
| Owner-confirmed | Calendar subscription inside the installed PWA | Owner explicitly verified it. Server feed response also passed the read-only check. |

These are operational/device follow-ups; they do not reopen the completed history replacement or negate the accepted core launch flow. If a check reveals a functional failure, record that failure and its impact separately.

## Roadmap items that remain proposals

- Post-registration profile entry point for claiming additional historical names; current signup claiming and admin assignment already work.
- Run-night/table mode, assisted check-in screen and any explicit window-bypass feature.
- In-app push sending and automatic run reminders; [Plan B](push-notifications-plan-b.md) is a design, not a deployed sender.
- One-click full backup/restore, gear image management and personal attendance-history screen.
- [Social preview metadata](social-sharing-enhancement.md), centralized [club configuration](club-extraction-plan.md), route print/report/mile-marker/privacy-trim extras.

A pending enhancement is not automatically a launch requirement. Do not enable services, create test attendance or send messages merely to complete a documentation checkbox.

## Document ownership and historical evidence

| Documents | How to read/update them |
| --- | --- |
| `README.md`, `setup.md`, `new-club-setup.md` | Current setup and deployment instructions. Rules/site deploy together; calendar server provisioning is separate. |
| `go-live-policy.md`, `go-live-readiness-review.md`, `todos.md` | Completed retained-staff launch scope, dated evidence and actual remaining roadmap. Do not treat original reset instructions as a new authorization. |
| `roles-and-permissions.md`, `import-format.md`, `backup-and-restore.md` | Current operational behavior and limits, including maintenance, deduplication, explicit tags and backup scope. |
| `browser-device-testing.md`, `real-device-test-plan.md` | Owner-reported acceptance, observed browser checks and unresolved per-device evidence must remain distinguishable. |
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
