# Go-live reset and historical-data policy

Agreed November 10, 2026. The November 13 retained-staff refresh and owner acceptance are complete; the club is ready for launch. A public launch announcement/date has not been recorded in this checklist. A deployed Firebase site does not by itself mean the club has gone live.

## Rule

### Approved scope for this launch — November 13, 2026

The owner explicitly approved retaining the **five current real staff accounts** (one club admin and four organizers) and their **eight historical-name claims**. These are approved real registrations, not test accounts/claims to clear. Preserve their Firebase Authentication accounts, roles, profiles and push registrations. Recompute their totals from the curated history while retaining the claims.

For this rollout, replace all existing run/event/code-word records with the approved historical files, remove only the explicitly rejected TEST/TEST2/TEST3 historical aliases and their data, and preserve all **54 routes**. The approved history currently contains 1,199 names, 300 historical runs, 6,231 dated check-ins and 2,371 undated credits. Unclaimed names remain available to claim. Reconfirm the manifest after any owner-approved special-event edits.

Create the next real run **after** the historical upload and count verification, before opening live check-in. This keeps it out of the run deletion step. While maintenance is enabled, create this run using the club admin account; organizer publishing remains paused until club changes resume. The count is 300 historical runs before creating that event, and 301 total runs after creating one new event.

If an unexpected account or claim appears in the final inventory, stop and classify it with the owner instead of silently adding it to the retained staff list or deleting it.

### Completed cutover status — November 13, 2026

The approved history is imported and reconciled. The owner created the November 18 real run and confirmed ordinary signup/claim and attendance/mileage/reload acceptance. The designated TEST event and its attendance are gone. Maintenance and the import fence are off. Expected current count: 301 runs (300 historical plus the next real run). Preserve this state; do not rerun run deletion or the broader reset below. The [readiness review](go-live-readiness-review.md) records verification.

### Separate full test-account reset

When the owner explicitly requests the go-live reset:

1. Remove all test users and their related app records.
2. Remove all test runs and their related records.
3. **Keep all routes.** Preserve the route library, including route IDs, geometry, directions and external links.
4. Re-upload the approved prior club database listed by runner name, with its historical attendance/counts. Import these as unclaimed legacy names for runners to claim during registration; do not invent email accounts from names or retain test claims.
5. Create the first real club run using the retained routes and the owner's approved date, time, meeting details and code word.

This is a one-time transition from testing to live operation, not a recurring archival rule. Do not delete anything merely because a release is deployed or testing continues. The policy itself is **not an instruction to execute the reset now**.

## Reset preparation and scope

Before replacing history, prepare a concrete plan identifying the Firebase project, approved historical files and retained accounts/claims. The next run's details can be supplied after historical verification; they must be owner-approved before that new run is created and live check-in opens. The current unified importer accepts three approved CSVs: Profiles, Run history and Check-ins; totals are derived from attendance plus undated credits. The old two-export importer remains a separate compatibility path. Verify the selected files are the owner's intended source rather than sample/test fixtures.

Take a recoverable backup before deletion. Record route IDs and a content manifest so the retained library can be compared after cleanup. Pause test writes during the reset so sign-ins/check-ins do not recreate records while cleanup is in progress.

Include the dependent records that would otherwise leave test totals, claims or run configuration behind: private profiles, public member projections, check-ins, milestone alerts, reward proofs, RSVPs, meetup events, code words and code lookup records. Remove test claims from the legacy data before the approved historical import. Account for test Firebase Authentication users and push-device registrations as part of the plan; ensure club-owner administrative access is retained or re-established rather than leaving the app unmanageable. Do not treat a profile deletion alone as an Authentication-account deletion.

Do not clear the entire Firestore database: the route library must survive. Unrelated catalogs and settings are outside this reset unless separately requested.

After cleanup and import, verify that no test users, test runs or derived participation remain; the route manifest is unchanged; historical names/counts reconcile to the approved source; and the first real run has the correct check-in configuration. Verify owner access and complete a controlled registration/check-in before opening the club to runners.

Use **Admin → Club maintenance → Pause club changes** for cutover. This persists in `settings/maintenance`: members and organizers cannot create or modify club data, while admins can import, reconcile and verify. Public browsing and sign-in remain available. Keep maintenance enabled if any step fails; the legacy import lease is a separate lock and must not be manually cleared to expose a partial import. Admin reward rebuilding remains available while either lock is active.

Take the final backup and route manifest after the server-side maintenance rules are in place and writes are paused. Keep a stage record for cleanup, upload, reconciliation and verification. If upload is interrupted, leave maintenance on and re-import the same three files; existing records are updated idempotently. Do not restart the deletion phase after the new import has begun. Only resume club changes explicitly after all verification succeeds.

The [November 13 readiness review](go-live-readiness-review.md) records the resolved scope/implementation issues and owner-reviewed event tags and remaining release checks. That review itself authorizes no deployment or deletion.

## Indefinite retention and deletion permissions

Keep club records indefinitely. There is no age-based expiration, automatic deletion, scheduled purge or recurring archival deletion.

| Record | Who may explicitly delete it |
| --- | --- |
| User / runner account and profile | Admin only |
| Check-in / attendance record | Admin only |
| Run | Organizer or admin |
| Route | Organizer or admin |

These permissions do not override existing integrity safeguards, such as retaining routes referenced by scheduled or historical runs and requiring admin authority for run deletion when attendance rollback or an opened check-in requires it. Ordinary runners cannot delete these records. Authorized edits and corrections remain available under the existing rules.

Pagination limits what is loaded on screen; it must never delete older records. Preserve attendance, claims, reward evidence and fulfilled milestone history unless an authorized person explicitly deletes the relevant record. Any cleanup of dependent records must stay within that authorized operation and preserve unrelated records.

The current launch uses the explicitly approved retained-staff scope above. A broader test-account reset remains a separate owner-requested operation. Neither deployment nor pagination authorizes an automatic reset or deletion.
