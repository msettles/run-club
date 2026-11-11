# Backup and restore

Two separate jobs:

1. **Disaster recovery** (the database is lost or damaged): use Firestore's own backups (scheduled backups and point-in-time recovery). They are complete and exact. They need the Blaze plan, and **their storage is billed** (cents a month for a database this small, but it is not covered by the free quota), so they are **not enabled**. Turn them on if the cost is acceptable.
2. **Moving data in or out** (migrating from another system, correcting data in a spreadsheet, starting a fresh club from old records): the three CSV import formats in [import-format.md](import-format.md). They are free. A one-click "club backup" bundle (profiles, runs, check-ins, routes, the milestone and badge catalog, gear handouts) is planned.

Logins live in Firebase Auth; a runner re-links to their profile by signing in with the same email.
