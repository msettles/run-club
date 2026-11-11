# Backup and restore

**FYI: backups are not set up by default, because they aren't free.** A new club starts with none. This page says what the options are and what to do if you want them.

There are two separate jobs.

## 1. Disaster recovery: the database is lost or damaged

Use Firestore's own backups: **scheduled backups** and **point-in-time recovery (PITR)**. They are complete and exact (everything in the database, including things like RSVPs, claims and gear handouts), and they are the right tool if you can't afford to lose data.

- They need the **Blaze** (pay-as-you-go) plan. The platform's calendar feed already needs Blaze, so a club running this app is normally on it.
- They **bill for storage**. We found no free quota for backup storage. Third-party figures put it at a few cents per GB per month, and a club's database is small (a few megabytes), so expect **cents a month**, but it is **not zero**. PITR also has a small minimum charge. We could not confirm the exact official rates, so check the current pricing before turning it on:
  - [Firestore backups](https://firebase.google.com/docs/firestore/backups)
  - [Point-in-time recovery](https://firebase.google.com/docs/firestore/pitr)
- **Restoring** a backup creates a **new database** (it does not overwrite the live one); you then point the app at it or copy data across. Restores are billed by the size of the backup.

### If you want them: what to do

In the Firebase console, open **Firestore Database → Disaster recovery** and use the screens there. Or, from a terminal signed in as a project owner (`gcloud auth login`), the commands look like this. The exact flags change over time, so check `gcloud firestore --help` and the docs above if one is rejected:

```bash
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d --project YOUR_PROJECT_ID
```

```bash
gcloud firestore databases update --database='(default)' --enable-pitr --project YOUR_PROJECT_ID
```

To restore from a backup into a new database:

```bash
gcloud firestore backups list --project YOUR_PROJECT_ID
```

```bash
gcloud firestore databases restore --source-backup=BACKUP_RESOURCE_NAME --destination-database=restored-db --project YOUR_PROJECT_ID
```

Keep an eye on the project's billing page for the first month or two so the cost is what you expect, and set a small **budget alert** (Google Cloud console → Billing → Budgets & alerts) so a surprise can't grow unnoticed.

Tell the club's other admins whether backups are on, and who can run a restore.

## 2. Moving data in or out

For migrating from another system, correcting data in a spreadsheet, or starting a fresh club from old records, use the three CSV import formats in [import-format.md](import-format.md). They are free. A one-click "club backup" bundle (profiles, runs, check-ins, routes, the milestone and badge catalog, gear handouts) is planned, and would be the free way to keep your own copy of the club's records.

Logins live in Firebase Auth, not in the database. A runner re-links to their profile by signing in with the same email.
