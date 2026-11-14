# OpenStreetMap caching across route jobs

Route geometry still runs in an isolated worker per job. Workers now request raw Overpass data through the app session, allowing later jobs to reuse successful downloads after the original worker has terminated.

## Cache limits and coverage

- Results expire 15 minutes after download completion. Cache hits do not extend freshness.
- The cache retains at most six geographic regions and 8 MiB of serialized UTF-8 response data, evicting the least recently used entries. Oversized responses can serve the current job but are not retained.
- A region is reused only when it fully encloses the requested bounding box. Partial overlap requires another download; the app never treats incomplete coverage as complete.
- Simultaneous requests for an identical or already-pending enclosing region share a download. Each job has its own cancellation signal. Cancelling the final consumer aborts the network request; cancelling one consumer does not interrupt another.
- Empty/offline fallbacks, exceptions and partial Overpass responses containing a `remark` are not cached. Abandoned requests cannot populate the cache after cancellation or overwrite a newer request.
- The cache is memory-only and scoped to one app tab/session. Reloading clears it. It does not retain GPX tracks, account data or generated directions, and does not persist anything to Firestore or browser storage.

Per-mirror network deadlines still cover body parsing. Closing/replacing a route job or reaching its 60-second deadline now also releases its shared OSM request. Existing geometric-cue fallback and mirror retry behavior remain available. Supplied `prefetchedOsm` continues to bypass the download path.

## Validation

The counts below are the checks recorded when this feature shipped, not the current total test suite. Current launch evidence is in [go-live-readiness-review.md](go-live-readiness-review.md).

106 unit tests pass, including seven cache scenarios, two worker-broker scenarios and three Overpass cancellation/timeout scenarios. Type checking, production build, bundle boundaries and ESLint pass (48 existing warnings, zero errors).

A temporary localhost browser harness exercised two real workers with a simulated Overpass response: both produced identical directions and only one download occurred. The harness was removed afterward. No real OSM requests, production writes or deployment were needed for this verification.
