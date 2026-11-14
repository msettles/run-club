# Repository rules

## Testing, go-live reset and retention

Read [docs/go-live-policy.md](docs/go-live-policy.md) before any data cleanup, archiving, reset or go-live work.

Launch preparation and owner acceptance completed November 13, 2026 under the retained-staff scope in `docs/go-live-policy.md`. The historical replacement is complete; do not repeat it. A public launch announcement is not inferred from readiness. Deployments do not constitute launch or permission to purge data. When the owner explicitly requests the go-live reset, remove test users and runs with their dependent data, **keep all routes**, re-import the approved name-based historical database as unclaimed legacy records, then create the first real club run using the owner's details. Preserve or re-establish owner administrative access.

Do not execute this reset solely because this rule exists.

Retain records indefinitely: no automatic expiration, scheduled purge or deletion as part of pagination. Only admins may explicitly delete users or check-ins. Organizers or admins may explicitly delete runs or routes, subject to existing integrity safeguards (including referenced routes and attendance rollback). Preserve unrelated historical and reward data.
