# Development tooling maintenance — v1.1.4

November 9, 2026. This follows the v1.1.3 review audit; application behavior is unchanged.

## Changes

- Updated `firebase-tools` from 13.29.1 to 15.35.0. This removes the vulnerable tar 6 and old proxy/FTP dependency chain.
- Added narrowly selected dependency overrides for the remaining patched tooling dependencies:
  - `glob@>=9 <14.0.2` → `^14.0.4`.
  - `minimatch@>=7 <11.0.1` → `^11.0.5`; older, unaffected minimatch majors stay on their parents' requested versions.
  - `uuid@>=9 <11.1.1` → `^11.1.1`, which retains CommonJS support for Gaxios.
  - Pub/Sub's direct `@opentelemetry/core` → `^2.10.0`. Its use of `W3CTraceContextPropagator` remains compatible, and the vulnerable 1.x copy is removed. This override is scoped to `@google-cloud/pubsub`; it does not override the application's telemetry packages.
- Kept the existing `@grpc/grpc-js` override. Remove individual overrides once the upstream parent dependencies select fixed versions themselves.
- Declared Node 22.12+ within major 22, or Node 24, as supported. `.nvmrc` selects Node 22, matching CI. The machine's default Node 26 is outside Superstatic's declared support range, so validation and deployment use Node 22.23.4 without changing the system default.
- Added `npm run audit:dependencies` to CI. It reports all findings and fails on moderate-or-higher severity; the remaining low-severity advisory remains visible.

## Audit result

| Severity | Before | After |
| --- | ---: | ---: |
| Critical | 1 | 0 |
| High | 5 | 0 |
| Moderate | 23 | 0 |
| Low | 2 | 4 |
| Total package reports | 31 | 4 |
| Runtime advisories (`--omit=dev`) | 0 | 0 |

The four remaining low-severity package reports are one underlying issue:
`deepmerge` → `@rollup/plugin-node-resolve` → `workbox-build` → `vite-plugin-pwa`.

[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) affects deepmerge 4.2.0 through 4.3.1 and has no published patched version. It concerns prototype poisoning through crafted merge input. Here the dependency is used while building the service worker, rather than by the deployed app. This release does not suppress the report, replace it with an old vulnerable/downgraded toolchain, or claim the issue is fixed. Revisit it when a patched release or supported replacement is available.

## Compatibility verification

- A fresh `npm ci` succeeds using Node 22.23.4 and the committed lockfile; `npm ls --all` reports no invalid dependencies.
- All 71 unit tests and 51 Firestore emulator tests pass. Typecheck, lint and production build pass. Existing lint warnings and the Firebase vendor bundle-size warning remain non-fatal.
- The CLI initializes and reads the configured Firebase Hosting site with current credentials.
- Pub/Sub constructs its client/topic using the patched telemetry propagator without making a Pub/Sub API request.
- Archiver creates a ZIP using a brace/glob pattern and selects the expected two files; this exercises the overridden glob implementation beyond the application's PWA build.
- Hosting and rules deployment and live release metadata are checked during the release.
