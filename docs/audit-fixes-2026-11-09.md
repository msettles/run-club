# Independent review implementation — November 9, 2026

> Historical release evidence: version-specific findings, test totals and dependency advisories below are retained as recorded. They are not the current launch checklist. See [documentation status](documentation-status.md) and the [November 13 readiness review](go-live-readiness-review.md).

This implements the numbered findings in [the independent review](independent-code-review-2026-11-09.md), following its five repair groups. These changes are included in v1.2.0, following v1.1.5. Hosting and Firestore rules must be deployed together; the version/merge does not itself deploy the application.

## Implemented findings

| Review findings | Change |
| --- | --- |
| 1, 3 | Check-in transactions read the current profile, check-in, run and meetup. Rules validate an active route, integer loop bounds, cent-precision mileage and exact attendance/activity/pet/distance-counter deltas. A check-in nonce binds the record to its profile update. Concurrent conflicts recalculate rather than overwrite totals. |
| 2 | Existing milestone alerts are read and preserved, including fulfillment. Fulfillment updates require an existing alert, and run deletion re-reads fulfillment inside each rollback transaction. |
| 4 | Run/profile deletion fences participation first. Run rollbacks re-read both check-in and profile transactionally and skip already-removed records. Concurrent deletion therefore subtracts once. Organizers receive an explicit error before fencing an already-open or attended run that requires an admin. |
| 5 | A fresh successful check-in can enter edit mode. Entering edit restores the saved route, activity, loops, pet selection and code word, including records loaded after the modal mounted. |
| 6, 18 | Schedule, public members, catalogs, private profiles/check-ins, gear and staff code words have subscriptions with cleanup. Check-in atomically creates or updates the runner's attendee status to checked in, preserving their original RSVP date. Role changes replace private subscriptions. |
| 7 | Private reward proofs validate attendance sources. Weekly proofs extend a consecutive-week chain; special-event proofs reject reused attendance. Badge levels must match trusted counters, configuration or proofs; new attendance records snapshot their event classification. History removal/re-import invalidates old proofs using a profile epoch. Public reward/streak fields mirror the profile, including an attendance-week witness so legacy-only streaks expire. |
| 8 | Meetup documents are replaced rather than recursively merged, removing deleted choices and cleared optional fields. Run updates explicitly delete a cleared special event. |
| 9 | Event windows, calendar instants, opening labels, streak dates and default scheduling use Woodland's time zone. The default is the next Wednesday at 6 PM. |
| 10 | Auth restoration gates QR handling. Dismissed setup can resume; email-link failures are visible. Registration is idempotent and preserves an existing profile. Session changes invalidate delayed private state updates. |
| 11 | Route edits create new immutable library versions with visible update labels. Scheduled runs retain their original route. New schedule writes mark referenced routes; referenced routes cannot be mutated/deleted, and deletion also checks older run references. |
| 12 | Each GPX job has an abort controller and an isolated worker. Replacement/close terminates the old job, and only a complete current result replaces the route. Late worker progress is ignored. |
| 13 | Claims/reassignments read current profiles transactionally. Imports preserve current claims and adjust current totals by the imported delta. Omitted names lose their old contribution. A leased, fingerprinted import prevents overlap, keeps check-in/claims paused after interruption, and publishes discovery only when complete. |
| 14 | Push disabling propagates errors and verifies subscription removal. Cached On status checks the actual subscription. Account restoration rebinds the token; push mutations are serialized. Device-count failures display unavailable rather than zero, and counts are labeled registrations. |
| 15 | GPS errors clear the active watch, location marker and accuracy circle before another attempt. |
| 16 | GPX byte/point/coordinate/elevation bounds are checked before route processing; loops and scheduling inputs match server limits. Meetup options are stored once by route ID without copied direction arrays. Document-size guards run before saves/import fencing. |
| 17 | Public collections load independently. Errors retain successful data, expose a global retry action, and do not mark failed schedule/catalog reads ready. Retry also restarts private data/reward work. |
| 19 | Once check-in opens, organizers cannot move its window/date or disable/delete the event to unlock its code word. Admin deletion remains available. |

## Transaction and reward boundaries

The attendance commit contains the check-in, profile counters, checked-in RSVP and any new milestone alert. Route information and reward screens are optional. Confirmation returns after this commit; leaderboard projection and proof-backed reward refresh run in the background and can be retried independently.

`reward_proofs` is private. Proofs reference an owned check-in or an actually claimed legacy attendance entry. A special-event proof keeps a unique source list, while a weekly proof must extend the previous week's count. Profiles cannot change their own reward epoch. Admin history removal/replacement advances that epoch, preventing reuse of evidence from deleted or reassigned history. This uses the existing Firebase plan and adds no runtime dependency or Cloud Function.

Built-in eligibility defaults must match the app catalog. After changing built-in trigger configuration, run `npm run sync:reward-rules`; a unit test detects drift. Firestore catalog overrides still take precedence.

An interrupted import intentionally stays fenced. Resume with the same two CSV files. A caught failure releases its lease immediately; a closed browser's lease expires after 60 seconds. The active fence is cleared only with the completed index publication. Do not manually clear it to expose partially imported data.

## Performance changes

- Shared CommonJS helpers have their own chunk, so Leaflet is no longer a static import of the entry.
- Local sample routes/people load through a separate dynamic import; the real catalog is independent.
- Analytics and Messaging remain dynamically loaded. CI inspects the production manifest to protect these boundaries.
- Geometry/directions run in a worker. The complete job has a deadline; Overpass timeouts cover response-body parsing and are cleared on every exit.
- The automatic all-member repair on every admin sign-in was removed. Projection repair reads the current profile and compares normalized JSON before writing.

The last measured production entry and its static JavaScript dependencies total approximately 1.06 MB uncompressed, compared with approximately 1.22 MB in the review. The service worker still precaches lazy assets in the background; this measurement is the static module graph, not total offline storage.

## Verification

- Typecheck, lint and production build pass. Lint has 48 existing warnings and no errors.
- 82 unit tests, 55 rules tests, 6 store/emulator integration tests and 7 resolver compatibility tests pass. The integration file is skipped in the ordinary unit command and run explicitly by `npm run test:integration` and CI.
- Integration scenarios cover concurrent stale clients, legitimate and forged rewards, duplicate special-event evidence, two admins deleting the same run, interrupted/competing imports, omitted legacy history, idempotent onboarding and session-change cleanup.
- Worker tests cover coherent completion, cancellation, late progress and whole-job timeout. A synthetic 20-route/190-directions-per-route meetup remains below the document limit.
- New York-process winter/summer checks produce the expected Woodland instants. Calendar generation uses the same helper.
- Production bundle boundary checks pass. `npm audit --audit-level=low` reports zero vulnerabilities; resolver compatibility tests pass.
- No production data was changed. Real-device GPS permissions, iPhone/Android push delivery and installed-PWA upgrades still need device smoke testing before release. Existing installed clients must load the new app when the stricter rules are released.

## Separate larger follow-ups

These review opportunities were not presented as completed fixes: pagination/archiving of historical data, route summaries with on-demand geometry, cross-job OSM caching, and a shared modal component with focus trapping/restoration and lazy-load error recovery. They remain architectural/accessibility work beyond the numbered defect repairs.
