# Second-round review audit — v1.1.3

> Historical release evidence: version-specific findings, test totals and dependency advisories below are retained as recorded. They are not the current launch checklist. See [documentation status](documentation-status.md) and the [November 13 readiness review](go-live-readiness-review.md).

Audited November 9, 2026 against the supplied second-round review, including the earlier v1.1.1 and v1.1.2 fixes. This is a repository and release audit, not an independent penetration test.

## Original findings

| Review item | Status and evidence |
| --- | --- |
| 1. Sample people, check-ins and gear in production | Fixed. Firebase state starts empty for private collections; private sync replaces remote data and localStorage persistence is local-mode only. Routes now also come exclusively from Firestore in production. |
| 2. Special events not loaded | Fixed. Public startup fetch includes `special_events`; built-in catalog definitions and saved custom events are combined. |
| 3. Deleted badges return | Fixed for admin-created badges. Remote data replaces cached custom badges; Firebase mode never restores browser badge caches. Built-in badges are intentionally non-deletable (`isDefault`). |
| 4. Turn zoom and GPS reset | Fixed. Map creation depends on route changes; turn selection redraws pins without recreating the map. Route Studio removes its map on close. Local browser smoke check exercised route rendering and turn selection without console errors. |
| 5. Google sign-in sync runs twice | Fixed. AuthModal only closes on success; the auth listener owns profile loading. Added cancellation guards so old profile/private-data responses cannot restore data after sign-out/account changes. |
| 6. Same-date special-event confusion | Fixed. Check-ins resolve their event by run ID; date fallback is reserved for older records without a run ID. Unit coverage includes two runs on one date. |
| 7. Staff-assisted check-in truncates history | Fixed. Each check-in fetches that runner's complete app and legacy history before calculating totals, streaks and badges. |
| 8. Run edits overwrite RSVPs | Fixed. Run details exclude attendees. Schedule, choices, code-word secret and lookup-key edits now commit atomically. Unit tests and emulator tests cover preserved RSVPs and rejected code-word changes. Runner deletion also uses array removal rather than replacing stale attendee lists. |
| 9. GPX limits and hidden save failures | Fixed. Firestore route serialization omits raw GPX and checks a conservative 900 KiB limit. Route and badge operations persist before updating UI and propagate failures. Complete route replacement also removes cleared external links and historical raw GPX fields instead of retaining them through a nested merge. |
| 10. UTC/local date errors | Fixed. Member first-run dates, streak defaults, recent-check-in cutoff and birthday input maximum use local calendar dates. Pacific evening/UTC-next-day behavior has unit coverage. |
| 11. CSV escaping and repeated code | Fixed. Shared CSV escaping doubles quotes and neutralizes formula prefixes; both exports use the shared downloader, which releases its object URL. Route IDs are no longer mislabeled as miles. Unit tests cover quoted/newline cells, formula text and numeric cells. |
| 12. Streaks never expire | Fixed. Leaderboard computes live streaks before display and sorting. Run deletion also recomputes the remaining last-check-in date and totals, including in local mode. |

## Dead code and duplication

- Removed unreachable check-in registration/window-bypass code in earlier changes. Corrected the stale completed bypass entry in `todos.md`: an organizer bypass remains a deferred feature, not current behavior.
- Removed unused notification permission exports, `AuthState`, `CheckInPayload`, the unused CARTO URL and duplicate `images/` assets. Kept the public assets used by the app/PWA.
- Removed sign-in migrations and automatic route re-seeding. A deleted Firestore route is no longer restored from bundled sample data.
- Removed the unused second special-event object; special-event badge/option IDs are saved together.
- Removed remaining invented 1/3/5-mile check-in choices and approximate-distance map matching. An unconfigured run shows an explanation and cannot check in with fictitious mileage.
- Consolidated badge recomputation, special-event detection, distance-count adjustments, SHA-256 hashing, route map layers, milestone progress, confetti and miles formatting. Admin role display uses the shared role checks.
- Repeated member-email hashes reuse a bounded in-memory promise cache.
- Removed stale season text and redundant comments. Store operation groups extend one context in dependency order rather than copying it repeatedly; their closures still use each render's current state.
- Turn tooltip text is inserted as text rather than interpreted as HTML.

## Loading and persistence

- Heavy modals render only while open; MapViewer is lazy-loaded.
- Firebase Analytics imports after page load/idle time. Messaging imports only when enabling/disabling device notifications; startup status checks do not import its SDK. Unit tests exercise both behaviors. The production build manifest confirms separate dynamic chunks outside the entry's static import graph.
- Public and private independent reads run concurrently. Staff sign-in no longer re-reads/re-seeds routes.
- Admin leaderboard synchronization compares public projections and writes only changed rows.
- Firebase mode does not continually serialize club/route data to localStorage; old cached club data is cleared.
- Optional confetti respects reduced motion and cannot fail a saved check-in.

## Validation and practical limits

- Added Vitest scripts and a CI unit-test step. Unit coverage includes check-in save/RSVP semantics, rejection behavior, loop credit, run-edit atomicity, stale private sync after sign-out, badge rules, rollback, streaks, CSV, route choices, calendar escaping/folding, local dates, hashing, milestone progress and deferred Firebase SDKs.
- Release validation: 71 unit tests and 51 Firestore emulator tests pass, together with typecheck, lint and the production build. Lint still reports existing non-fatal type/fast-refresh warnings; Firebase Auth/Firestore still produce a large vendor-chunk warning.
- Browser smoke testing covers the route library, map turn selection and milestones. Device-level FCM delivery and real Google/email sign-in were not exercised with a live account; SDK behavior is unit-tested and access rules are emulator-tested.
- Dependency audit at v1.1.3 (superseded by the [v1.1.4 tooling maintenance](tooling-maintenance.md)): `npm audit --omit=dev` reports zero runtime advisories. The existing development toolchain reports 31 advisories (2 low, 23 moderate, 5 high, 1 critical), including transitive Firebase CLI archive/proxy dependencies. Those require a separate CLI/dependency maintenance pass; no forced dependency downgrade or broad toolchain migration is included in this release.
- Production data already saved in Firestore is preserved. This release stops injecting sample routes; it does not delete existing route documents or member records.
