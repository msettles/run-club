# Backup and restore

## Woodland status — November 13, 2026

A one-time typed Firestore backup was taken with maintenance enforced before the approved history replacement. All **4,988 documents**, including 54 routes, were restored into an isolated emulator and compared to that snapshot. A prior readiness snapshot contains 4,987 documents. These are dated cutover backups, not evidence that recurring backups are enabled today.

Private backups, manifests and verification evidence are under ignored `data/backups/` and `data/deployment-preparation/`. Do not commit them to the public repository. A fresh snapshot of later live activity needs its own backup; the cutover snapshot cannot recover future check-ins.

The one-time export contains Firestore documents and typed values, not Firebase Authentication accounts, deployed code/rules, all service configuration or billing settings. Keep the repository/release configuration and access to the club-owned deployment account as separate recovery requirements. No one-click backup/restore screen is implemented.

## Owner decision — no paid recurring backups

The owner explicitly declined recurring paid backups because of cost. Do not enable scheduled backups or PITR to close a checklist item. Preserve the existing one-time cutover backup. There is no automatic recovery copy for later attendance from this workflow; accepting that scope is the owner's recorded decision.

The owner separately approved billing alerts: a USD 2 monthly project budget, with actual-spend emails at USD 1, 1.80 and 2 to both approved addresses, is now configured and verified. No automatic shutdown or backups were enabled. A new backup strategy remains a future owner decision, not a current launch blocker.

If the owner revisits backups later, agree recovery goals, access/restore ownership, copy retention, Auth recovery and a dated isolated restore drill before implementation.

Firestore provides scheduled backups and point-in-time recovery. Scheduled backups require Blaze, charge for stored backup data and restore operations, and restore into a new database. Consult the current [official backup instructions](https://firebase.google.com/docs/firestore/backups), [PITR instructions](https://firebase.google.com/docs/firestore/pitr) and [pricing](https://firebase.google.com/docs/firestore/pricing) before enabling a service. Rates, command flags, region and project permissions must be checked for the actual project; this guide does not promise a monthly price or enable any service.

First inspect the project's configured schedules/PITR state in the console or current CLI. A working calendar function does not prove that backups are enabled. Billing-alert setup is a separate requested follow-up; paid recurring backups remain declined.

Backup-copy retention is separate from club-record retention. Nothing here schedules expiration or deletion of live users, runs, routes, check-ins or reward history. See [go-live-policy.md](go-live-policy.md).

## Imports and exports are migration tools

The three [attendance CSV formats](import-format.md) support importing names, runs and attendance. They omit routes, Auth accounts, existing claim ownership, much reward/gear evidence, push registrations and other project state. They are **not a complete disaster-recovery backup**. A CSV export also does not guarantee the corresponding Auth account can be restored.

The one-time deployment scripts in ignored `data/` were scoped to the completed cutover. Do not rerun a deletion/import phase to make a backup or restore routine. Before an actual restore, prepare a reviewed destination and scope, pause mutations if needed, preserve a fresh pre-restore copy, then verify the recovered data and owner access before resuming.
