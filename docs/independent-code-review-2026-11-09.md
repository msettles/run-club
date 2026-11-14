# Independent application code review

> Historical release evidence: version-specific findings, test totals and dependency advisories below are retained as recorded. They are not the current launch checklist. See [documentation status](documentation-status.md) and the [November 13 readiness review](go-live-readiness-review.md).

Implementation follow-up: [repair details and verification](audit-fixes-2026-11-09.md). The findings below describe the reviewed v1.1.5 behavior.

Reviewed November 9, 2026, at commit `757a961` (v1.1.5). This is a new review of the current implementation, rather than a check of the earlier review's completion list. Application code, rules and deployment were not changed.

Scope: authentication/onboarding, store operations and synchronization, Firestore authorization/data invariants, check-in/RSVP/rewards, run and route editing, legacy imports, route generation/maps, notifications/install/service workers, bundle output and test coverage. Static route fixtures and the upstream resolver distribution were treated as data/vendor code rather than rewritten.

P1 = fix soon because it can block normal check-in or corrupt records. P2 = normal-priority correctness, security or reliability work. Performance/refactoring opportunities appear separately. No P0 emergency was identified.

Evidence labels distinguish emulator reproductions, deterministic code paths and concurrency analysis. Concurrency findings describe reachable interleavings; no production race or production write was attempted.

## Findings, ordered by impact

### 1. P1 — Firestore accepts fabricated mileage and repeated edit increments

**Emulator-confirmed.** [Rules](../firestore.rules#L335), [stats validation](../firestore.rules#L487).

A normal member with a valid code word inside the check-in window can submit a nonexistent route and 50 miles. Rules bound `actualMiles` but do not derive it from the event's active route/loop selection. Separately, editing an unchanged 3.1-mile check-in can repeatedly add 3.1 to lifetime miles because validation only checks an upper bound against the *new* distance; it does not require the exact new-minus-old delta. A probe moved a profile from 15.1 to 21.3 miles by editing the same unchanged record twice.

**Fix:** validate active route IDs, integer loops and route-derived credited mileage; enforce exact creation/edit deltas against before/after check-in documents. Require the profile and public projection to remain consistent with the accepted record.

### 2. P1 — Previously earned milestones can block later valid check-ins

**Emulator-confirmed.** [Alert write](../src/services/store/checkIn.ts#L268), [alert update permission](../firestore.rules#L659).

Deleting an earlier run can move a runner back below a milestone while leaving the existing milestone alert in place—especially a fulfilled alert, which deletion intentionally retains. On the next crossing, the client writes the same deterministic alert ID. Ordinary runners cannot update an existing alert, so the entire otherwise valid check-in transaction is rejected. Non-staff private sync does not load their milestone alerts, so the local `some()` guard does not solve this. Admin check-ins can instead overwrite an existing fulfilled alert as unfulfilled.

**Fix:** read the milestone document inside the transaction and create only if absent; never use the in-memory alert list as the existence/fulfillment authority.

### 3. P1 — Check-in transactions do not protect the records used to calculate totals

**Concurrency analysis.** [Profile snapshot](../src/services/store/checkIn.ts#L122), [transaction](../src/services/store/checkIn.ts#L255).

The profile, prior check-in, history, totals and badges are calculated before the transaction. The transaction reads only the run. Another device's check-in/profile update therefore does not trigger a recomputation. An ordinary runner can get a misleading code-word/permission rejection from a stale profile; admin writes can overwrite newer totals because admin rules allow those writes. Transaction retries caused by concurrent RSVPs still reuse the precomputed profile.

**Fix:** transactionally read the profile and target check-in, compute deltas from those documents, and define a consistent method for derived history/badge refresh. Apply the same discipline to admin legacy reassignment and leaderboard repair, which also write projections from earlier snapshots.

### 4. P1 — Run/runner deletion is not fenced against new writes

**Concurrency analysis.** [Run deletion scan](../src/services/store/runs.ts#L227), [late cleanup](../src/services/store/runs.ts#L261), [runner deletion](../src/services/store/members.ts#L167).

Run deletion scans check-ins, rolls back runners individually, then removes the run/event last. A new check-in can commit between the scan and final cleanup, leaving a credited orphan check-in. Rollbacks read a profile and later overwrite it with an ordinary batch, so another run's check-in can be lost; overlapping deletes can subtract twice if they hold the same old check-in snapshot. Runner deletion has a similar query-then-delete window.

**Fix:** mark a run/profile as deleting first and have rules reject new related writes. Make each rollback transactionally conditional on the check-in still existing, support resumable cleanup, and only finalize after no related records remain.

### 5. P2 — The edit button cannot leave the fresh check-in success screen

**Deterministic code path.** [Success branch](../src/components/CheckInModal.tsx#L516), [edit button](../src/components/CheckInModal.tsx#L558).

After a successful save, `successResult` remains truthy. Clicking Change Distance sets `isEditingCheckIn`, but the outer condition still selects the success view. Closing/reopening the modal works around it because that discards the success result.

**Fix:** gate both forms of success on `!isEditingCheckIn`, while retaining the saved result for display/cancel. Also hydrate activity/route/loop/pet form state when an existing check-in arrives asynchronously; the current useState initializers run only once.

### 6. P2 — Run-night dashboards do not receive other devices' changes

**Code-path confirmed.** [Public reads](../src/services/storage.ts#L60), [private reads](../src/services/store/privateSync.ts#L82).

Only announcements have a live listener. Schedules, RSVPs, leaderboard rows, check-ins and milestone queues are snapshots. A runner's milestone alert therefore does not appear on an organizer's already-open screen until it reloads/signs in again. Run edits/code-word changes and RSVPs on other devices are similarly stale.

**Fix:** use scoped listeners for the active run, recent check-ins and unfulfilled alerts; update public schedule/RSVP data live or provide deliberate revalidation. Unsubscribe with the existing auth/session lifecycle. Avoid listening to the entire historical database.

### 7. P2 — Badges and public streaks can be self-awarded

**Emulator-confirmed.** [Badge refresh permission](../firestore.rules#L468), [partial public/profile mirror](../firestore.rules#L327).

A member can change badge IDs, badge counts and streaks without attendance. The public-row mirror checks only name, run count, mileage and badge IDs, so a member can also directly set a public 9,999-week streak independently of their profile/history. The displayed live-streak helper cannot make a fabricated projection authoritative.

**Fix:** decide which fields are trusted rewards/rankings, then enforce them at a trusted calculation boundary or validate their allowed transitions. Mirror all authoritative public fields, not just a subset. Label any intentionally self-reported fields accordingly.

### 8. P2 — Choosing “None” does not persist removal of a special event

**Deterministic code path.** [Form sends undefined](../src/components/EditRunModal.tsx#L87), [persistence](../src/services/store/events.ts#L61).

The form sets `specialEvent: undefined`; `cleanFirestoreData` removes it. Both the run update and merged meetup write consequently leave the old server field untouched. The local state shows None, but refresh restores the special event and future badge calculations can still count it. Merged route maps likewise retain removed route keys/aliases.

**Fix:** use explicit deleteField operations for cleared optional fields and replace the route-choice map as a field rather than recursively merging old entries into it.

### 9. P2 — Run times use the device's time zone instead of the club's

**Utility reproduction.** [Event date construction](../src/utils/checkInWindow.ts#L24), [calendar export](../src/utils/calendar.ts#L42).

The same November 11, 6 PM run produced opening times of November 12 00:00 UTC in Los Angeles and November 11 21:00 UTC in New York. A traveling organizer can save shifted server windows; a runner elsewhere can export the wrong calendar start. `NewRunModal` also still defaults its date with UTC `toISOString()` and starts at 8 AM despite the club's Wednesday 6 PM convention.

**Fix:** persist/derive event instants using an explicit club/event zone such as America/Los_Angeles, including DST. Keep birthday calculations device-local. Replace the remaining UTC date-picker default with the appropriate calendar-date helper and use shared scheduling defaults.

### 10. P2 — Authenticated and registered are conflated

**Deterministic code paths.** [Registration button](../src/App.tsx#L270), [onboarding close](../src/App.tsx#L1050), [QR effect](../src/App.tsx#L299).

A first-time user who dismisses onboarding stays Firebase-authenticated but has no club profile. Join Club then says they are already registered (as Guest), while check-in points them back to sign-in. There is no direct way to resume the profile form. Separately, QR handling waits for the schedule but not auth restoration; on a slow restore it can open the sign-in modal for an already-signed-in runner, which is not closed by the restoration path. Failed email-link completion is only logged to the console.

**Fix:** model restoring / signed out / signed in without profile / profile ready explicitly. Allow profile setup to resume and defer QR routing until auth is resolved. Surface email-link failure with an actionable retry state.

### 11. P2 — Route library edits diverge from scheduled check-in choices

**Code-path confirmed.** [Route update/delete](../src/services/store/runs.ts#L154), [copied option](../src/utils/runChoices.ts#L57), [map lookup](../src/components/CheckInModal.tsx#L177).

Scheduled meetup options copy a route's mileage/directions at scheduling time, while run previews and check-in maps resolve the current route library. Editing a route's distance/geometry can leave the displayed map different from credited mileage. Deleting an in-use route removes it from previews but leaves copied meetup choices available for check-in.

**Fix:** choose explicit immutable route versions per run, or update dependent future runs atomically and protect historical check-ins. Reject deletion of referenced routes unless references are deliberately migrated.

### 12. P2 — Overlapping GPX jobs can mix one track with another track's directions

**Async interleaving analysis.** [Upload flow](../src/components/RouteStudioModal.tsx#L187), [result publication](../src/components/RouteStudioModal.tsx#L210).

Each upload publishes new points before waiting on directions. An older upload can finish later and overwrite directions/GeoJSON for the newer points; its completion can also clear `isProcessing` while the newer job is running. A failed replacement leaves previous directions alongside the new points. There is no generation ID or abort signal covering the whole job.

**Fix:** use one request identity/AbortController, clear or retain the entire previous route consistently, and publish a coherent result only for the latest request. Cancel work when the modal closes.

### 13. P2 — Re-importing legacy data can erase a concurrent claim

**Concurrency analysis.** [Claim snapshot](../src/services/store/legacy.ts#L211), [profile replacement](../src/services/store/legacy.ts#L227), [chunking](../src/services/store/legacy.ts#L258).

The importer snapshots claim locks once and later replaces legacy profile documents. A runner who claims an unclaimed name in between can have that lock overwritten with null, while their user still holds the imported run credit. A second runner can then claim it. Admin reassignment similarly trusts a stale roster for the previous owner and writes whole user profiles. The public index is written in the first chunk before all referenced documents finish, so partial imports can publish incomplete data.

**Fix:** preserve/revalidate claims transactionally, calculate from current profiles, stage imports by version, and switch the index only after a successful import. Test interrupted imports and concurrent claim/check-in operations.

### 14. P2 — Turning notifications off can report success without turning them off

**Deterministic failure path.** [Swallowed failures](../src/services/push.ts#L86), [UI reports Off](../src/components/NotificationsToggle.tsx#L32).

Token retrieval/deletion failures are swallowed and the enabled flag is removed regardless. The toggle then displays Off even if the browser still has a live subscription. Enabling while signed out also sets the flag without recording a push device; later sign-in does not bind that token to the account. Shared-device ownership/deletion can therefore leave stale device records and inaccurate admin counts.

**Fix:** distinguish local subscription state from account registration, propagate unsubscribe failures, verify the resulting state, and reconcile the current token when account identity changes.

### 15. P2 — GPS errors leave an active watch behind

**Deterministic cleanup omission.** [Error callback](../src/components/MapViewer.tsx#L153).

The error callback marks tracking false without clearing the watch ID. A timeout/unavailable-position error can leave that watch alive; another tap starts a second watch and overwrites the only stored ID. Later cleanup can then clear only the newest one.

**Fix:** clear the watch and marker state on terminal errors, or retain the same watch and clearly indicate retrying. Test timeout → retry → stop/unmount with a fake geolocation API.

### 16. P2 — Several supported UI inputs exceed server limits or document size

**Size reproduction plus code inspection.** [Repeated route payloads](../src/utils/runChoices.ts#L67), [loop control](../src/components/CheckInModal.tsx#L977), [route validation](../firestore.rules#L282).

Meetup documents embed direction lists multiple times under ID and distance aliases. A synthetic set of 20 routes with 190 steps each serialized to 1,298,068 JSON bytes, before Firestore overhead, beyond the 1 MiB limit. The UI has no aggregate meetup-size guard. The loop stepper also permits more than the rules' 20 loops, and GPX files can exceed the rules' 5,000 points while remaining below the byte guard. These valid-looking forms fail late with misleading connection/code-word errors. GPX coordinates are not checked for finite, in-range values before expensive geometry processing.

**Fix:** share input constraints with the UI, validate coordinates/counts before processing, bound loops, check serialized meetup size, and store each route option once. Use route IDs/references instead of duplicating long directions under aliases.

### 17. P2 — A failed startup collection read looks like an empty club

**Deterministic failure path.** [All-or-nothing fetch](../src/services/storage.ts#L60), [loaded flag on failure](../src/services/storage.ts#L86).

One rejection from the six-collection Promise.all discards every result. The failure is logged and scheduleLoaded is set true anyway. Users see no runs rather than a loading failure; QR handling consumes its one-shot attempt against empty state. There is no visible retry/revalidation path.

**Fix:** track load/error/empty separately, retry appropriately, retain independently successful results, and let QR routing retry after data recovery. Clearly distinguish an offline cached shell from available offline club data.

### 18. P2 — “Checked in” headcounts do not follow check-ins

**Code-path confirmed.** [Auto-RSVP entry](../src/services/store/checkIn.ts#L249), [headcount](../src/components/RunCard.tsx#L36).

Auto-RSVP creates `checkedIn: false`; an existing RSVP is also left unchanged, and no application operation sets it true. RunCard counts this obsolete flag, so it never displays the true headcount for check-ins made through the current flow. Live listeners alone will not fix this.

**Fix:** derive attendance counts from authoritative check-ins or atomically maintain a validated summary/attendee status. Keep RSVP intent separate from actual attendance.

### 19. P2 — Rescheduling can defeat the advertised code-word lock

**Emulator-confirmed.** [Mutable window](../firestore.rules#L666), [lock predicate](../firestore.rules#L175).

An organizer is initially denied a code-word change once check-in opens. Moving the meetup's opening time into the future makes the next code-word change pass. The edit UI permits start-time changes, so this does not require privilege escalation. The current lock is based on a mutable window rather than an immutable “opened” state.

**Fix:** define whether rescheduling after opening should be allowed. If the lock is permanent once opened, persist/enforce an immutable lock condition and restrict window changes, rather than recalculating it from newly editable values.

## Performance and maintainability opportunities

1. **Leaflet is still an initial download.** The production manifest's entry has static imports for the 149,699-byte Leaflet chunk and 734,964-byte Firebase chunk, plus a 338,495-byte entry: about 1.22 MB uncompressed JavaScript before CSS. Although MapViewer is lazy, Rollup placed a shared CommonJS interop helper in the Leaflet chunk and the entry imports that helper. Move shared helpers to an independent chunk or revise manualChunks; verify the result using the manifest/network graph, not the presence of React.lazy alone. [Chunk config](../vite.config.ts#L74).
2. **Local sample data is bundled into production.** The entry still contains the sample routes and people because catalog/state imports share initialData and its large route fixtures. Split immutable badge/milestone catalogs from local-mode seeds and load the latter only in local mode. [State imports](../src/services/store/state.ts#L20).
3. **Read volume grows without bounds.** Startup loads every historical run, every meetup, every route's full geometry/directions and every leaderboard row. Staff load all users, all gear alerts and all secrets; every admin sign-in also scans all public rows. Use upcoming/active-run queries, cursor pagination, route summaries plus on-demand detail, unfulfilled-alert listeners and an explicit repair job for leaderboard reconciliation.
4. **Expensive geometry stays on the main thread.** GPX XML is parsed twice; smoothing/resampling/spatial matching runs synchronously. Use a worker, validate resource limits early, cache OSM results and reuse the parsed track. Overpass clears its timeout after headers rather than after body parsing, and failed fetch timers are not always cleared. The fallback can add sequential reverse-geocoding delays for every turn. Give the whole job a bounded deadline/abort signal. [Overpass](../src/utils/routeEngine/osm.ts#L64), [pipeline](../src/utils/routeEngine/index.ts#L38).
5. **Consolidate duplicated route/event state.** Distance aliases, copied directions/links and route-library references drift independently. Define one versioned per-run route contract. Consolidate form validators and deadline/time-zone handling with it.
6. **Make async UI state consistent.** Acquire submission guards before code-word lookup, not after; disable repeated mutations while pending. Reuse a modal component with focus trapping, Escape handling, focus restoration, accessible labels and an error boundary for lazy-load failures. Several modal roots currently have neither dialog semantics nor keyboard management.
7. **Use stable IDs and honest statuses.** EventsTab keys meetups by date even though several runs can share a date; key by event ID. Do not present failed push-device counts as zero. Clear consumed installation prompts after dismissal as well as acceptance; don't keep offering an already-consumed prompt.
8. **Target test gaps rather than more happy-path mocks.** Add actual store+emulator integration tests for concurrent updates, rerender tests for check-in edit/onboarding, interrupted imports/deletes, subscription failures, invalid/large GPX, cross-time-zone calendars, and a PWA upgrade while a form is dirty. Current unit tests mostly cannot detect these cross-layer failures.

## Verification performed

- Current 71 Vitest tests, 7 resolver compatibility tests, typecheck and lint pass. Lint reports 49 non-fatal warnings.
- Existing 51 Firestore rules tests passed in the same disposable harness as the initial six review probes.
- Eight targeted emulator probes then passed their expected-behavior assertions: six demonstrate the mileage/streak/badge/lock/milestone issues above; two controls check the organizer permission boundary and a production-shaped valid profile/RSVP batch. These probes document current behavior, not fixes. Temporary probe source was removed from the workspace afterward.
- Reproduced the three-hour event-window shift with identical input in Los Angeles and New York processes.
- Measured the oversized synthetic meetup payload and inspected a fresh production build's static/dynamic import graph. PWA build succeeds.
- No production data writes, real-device push/GPS permission tests or application changes were made. This review is not a guarantee that every possible issue has been found.

## Suggested implementation order

1. Exact server-side check-in invariants and transactional profile/check-in updates; existing-milestone handling.
2. Fenced/idempotent deletes and race-safe legacy claims/imports.
3. Working check-in edit/onboarding flows, explicit time zones and optional-field clearing.
4. Live active-run/gear synchronization, authoritative headcounts, error/retry states and push/GPS cleanup.
5. Route versioning/input bounds/payload reduction, then bundle and geometry optimizations.

Keep changes reviewable in these groups. Turn each demonstrated case into a regression test before changing its implementation.
