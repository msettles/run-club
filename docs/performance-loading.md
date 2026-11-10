# Pagination and route loading

Released in v1.2.1: paginated history, metadata-only route loading and deferred member reads.

## Loading behavior

- The live schedule initially reads 20 upcoming runs, plus one lookahead document to determine whether more exist. “Show more” expands the live query by 20. Only the corresponding public meetup documents are subscribed to.
- Prior runs load only when requested, in pages of 20. Firestore document cursors preserve runs with identical dates. A page advances only after its meetup metadata has loaded successfully.
- The route library loads 20 metadata records per page using Firestore REST field masks. Routes referenced by loaded runs are resolved separately, even if they are outside the current library page.
- Coordinates, directions, GeoJSON and GPX source are omitted from catalog reads. Full route documents load when opening a map, exporting GPX or editing a route. Concurrent opens share a request; a 12-entry least-recently-used cache bounds retained full routes.
- Check-in is completed before optional route information loads. Legacy attendance without event snapshots resolves only the missing meetup metadata needed for rewards.
- Public member reads begin when the Members tab opens. The full ranking dataset is retained there for accurate global rankings; the list renders 25 rows at a time.
- Loading failures expose retry controls. Empty cached schedule results do not prematurely mark the schedule ready. The schedule follows the club's calendar date across midnight.

## Compatibility and limits

No document migration, new collection, rules change or composite index is required. Existing route documents remain compatible with older clients. Route metadata is refreshed explicitly through “Refresh route library”; the upcoming schedule remains live. Field masks reduce transferred route data, but do not reduce the number of billed document reads.

Historical pages are snapshots rather than live subscriptions. Opening the Members tab still reads the full public member collection. Staff rosters and gear administration retain their existing loading behavior. Those are separate opportunities if club scale warrants further work.

## Validation

- 90 unit tests, including masked route decoding, opaque page tokens, cache eviction/retry and schedule subscription lifecycle.
- Nine Firestore emulator integration tests, including 25 routes with 5,000 points each, historical pages with identical dates, and legacy reward metadata. The metadata fixture's first page is under 30 KB and contains no geometry.
- 55 Firestore rules tests and seven resolver tests pass.
- Type checking, production build and bundle limits pass. ESLint reports zero errors and 48 existing warnings.
- Read-only browser smoke checks verified deferred map and prior-run loading. No production data was written and no deployment was performed.
