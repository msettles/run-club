# Go-live reset and historical-data policy

Agreed November 10, 2026. The club app is currently in testing and has not launched. A deployed Firebase site does not by itself mean the club has gone live.

## Rule

When the owner explicitly requests the go-live reset:

1. Remove all test users and their related app records.
2. Remove all test runs and their related records.
3. **Keep all routes.** Preserve the route library, including route IDs, geometry, directions and external links.
4. Re-upload the approved prior club database listed by runner name, with its historical attendance/counts. Import these as unclaimed legacy names for runners to claim during registration; do not invent email accounts from names or retain test claims.
5. Create the first real club run using the retained routes and the owner's approved date, time, meeting details and code word.

This is a one-time transition from testing to live operation, not a recurring archival rule. Do not delete anything merely because a release is deployed or testing continues. The policy itself is **not an instruction to execute the reset now**.

## Reset preparation and scope

Before executing, prepare a concrete reset plan identifying the Firebase project, the approved historical source files and the first-run details. The current importer expects the old app's totals and attendance CSV exports. Verify the selected files are the owner's intended source rather than sample/test fixtures.

Take a recoverable backup before deletion. Record route IDs and a content manifest so the retained library can be compared after cleanup. Pause test writes during the reset so sign-ins/check-ins do not recreate records while cleanup is in progress.

Include the dependent records that would otherwise leave test totals, claims or run configuration behind: private profiles, public member projections, check-ins, milestone alerts, reward proofs, RSVPs, meetup events, code words and code lookup records. Remove test claims from the legacy data before the approved historical import. Account for test Firebase Authentication users and push-device registrations as part of the plan; ensure club-owner administrative access is retained or re-established rather than leaving the app unmanageable. Do not treat a profile deletion alone as an Authentication-account deletion.

Do not clear the entire Firestore database: the route library must survive. Unrelated catalogs and settings are outside this reset unless separately requested.

After cleanup and import, verify that no test users, test runs or derived participation remain; the route manifest is unchanged; historical names/counts reconcile to the approved source; and the first real run has the correct check-in configuration. Verify owner access and complete a controlled registration/check-in before opening the club to runners.

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

The planned pre-launch reset above remains a separate, explicitly requested admin operation: remove test users and runs with related data, keep every route, re-import approved named history, then create the first real club run. Do not run it automatically.
