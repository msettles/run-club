# Staff data scaling and pagination

## Read-volume assessment

| Dataset | Before | This change |
| --- | --- | --- |
| Private runner profiles | Live listener reads the full collection at every staff sign-in | Signed-in profile stays live; opening the roster requests 50 profiles plus one lookahead. Further pages are explicit. |
| Pending milestone gear | Arrives with every historical alert | A dedicated live `fulfilled == false` query retains the complete operational queue. |
| Fulfilled milestone gear | Full history at staff sign-in | Explicit pages of 50, plus one lookahead, when staff request history. |
| Name/email search | Filters only loaded profiles; separate exact-email lookup | Partial name/email search across the complete roster, on demand; results page in groups of 50. |
| Profile CSV export | Uses the already-downloaded full roster | Explicit export reads all profiles in pages of 50 and does not populate the interactive roster. |

Roster and history queries use document-snapshot cursors, ordered by document ID. Lookahead documents are not skipped. IDs deduplicate records loaded via lookup or overlapping pages. Cursor state changes only after successful reads; errors leave a retryable page. No schema migration, new index or Firestore rules change is needed.

## Staff behavior

- Typing in the roster search searches every registered profile by partial name or email. Matching is case/accent insensitive and accepts words in either order. Role filters apply across all matching profiles. Previous/Next controls page matches in groups of 50.
- Without a search, roster role counts, legacy-assignment choices and profile-mile totals apply to loaded profiles, with visible scope labels. Matches are added to the loaded profiles so staff actions and legacy assignment remain available.
- The first search scans the full private roster in batches of 50. The complete result is cached in memory for two minutes and shared by concurrent searches; it is not saved to localStorage. Typing is debounced by 300 ms. This trades an on-demand full scan for complete substring matching without a new service, index migration or per-keystroke network scan. At much larger scale, a dedicated maintained search index would be preferable.
- Refresh invalidates the search cache; registration, deletion and role changes also invalidate it. Session cleanup and revoked access clear it. Results arriving for an obsolete query are ignored. Search errors show Retry rather than a false no-results message.
- The current runner's own live profile remains authoritative; roster pages cannot overwrite it with a snapshot.
- Roster and fulfilled-history pages are snapshots. Refresh reloads the first page; pending gear remains live. Dates sort within the loaded history, not across unread pages.
- Fulfilling gear retains the completed alert locally even when the pending listener removes it before the transaction resolves. A session change prevents a late completion from restoring private state.
- Sign-out, private-session changes and permission failures reset pagination. Old requests cannot repopulate the new session. Exact-email lookup and complete CSV export also validate the session before returning data.

## Validation

- 110 unit tests, including no full-roster subscription at sign-in and the handout/listener race.
- 15 emulator integration tests, including staff paging with 125 synthetic runners and 123 fulfilled awards, exact lookup, global name/partial-email search beyond the first page, complete export, pending-row preservation, cache expiry/shared scans, session cleanup and permission-error retry.
- 20 browser checks across Chromium and WebKit, including staff lookup/export and pending-to-fulfilled handouts.
- Type checking (app and browser suite), lint, production build and lazy bundle boundaries pass. Existing lint warnings: 48; errors: zero.

## Remaining scale limits

Pending gear intentionally remains a complete live queue. Member leaderboard data is still complete when opened to preserve accurate global rankings. Staff recent check-ins are time-bounded, while each runner's own attendance history remains complete for totals/rewards. The legacy index/claimed-name pool and staff code-word collection retain their existing loading behavior. Large CSV exports intentionally read the full roster and may need a streaming/server job at much larger scale.

The agreed pre-launch reset policy is in [go-live-policy.md](go-live-policy.md): remove test users/runs, retain routes, re-import approved named history, then create the first real run. Retention is indefinite, with no automatic deletion. Users/check-ins may be deleted only by admins; runs/routes by organizers or admins, subject to existing integrity safeguards. This pagination change does not delete or archive records. Real-device checks remain in `browser-device-testing.md`. Pagination shipped in v1.2.4; global roster search is included in v1.2.5.
