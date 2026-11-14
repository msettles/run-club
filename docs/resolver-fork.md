# Removing deepmerge — v1.1.5

> Historical release evidence: version-specific findings, test totals and dependency advisories below are retained as recorded. They are not the current launch checklist. See [documentation status](documentation-status.md) and the [November 13 readiness review](go-live-readiness-review.md).

November 9, 2026. Follow-up to [tooling maintenance](tooling-maintenance.md).

## What changed

Workbox's `@rollup/plugin-node-resolve@16.0.3` dependency used deepmerge at a single call site: copying its own constant defaults before deep-freezing the exported DEFAULTS. No resolver options, app data, or uploaded route data were passed to this call.

This release replaces that operation with native `structuredClone(defaults)` in both the ESM and CommonJS distributions, removes the deepmerge imports and package dependency, and pins the result as `16.0.3-woodchuckers.1`. Resolver algorithms, package exports and type declarations are unchanged.

The fork is entirely local to this repository. Nothing is published under Rollup's npm namespace, and no install-time mutation of node_modules is used.

## Review and reproducibility

- `vendor/rollup-plugin-node-resolve/` contains the reviewed distribution, original MIT license, original README and types, plus FORK.md.
- `vendor/rollup-plugin-node-resolve.patch` records the exact changes from the published 16.0.3 distribution. The base archive's SHA-512 integrity is recorded in FORK.md and was verified against the npm registry artifact before applying the changes.
- `vendor/rollup-plugin-node-resolve-16.0.3-woodchuckers.1.tgz` is the pinned install artifact. Its checksum is recorded in package-lock.json.
- A direct dev dependency plus an npm override forces Workbox to use this same artifact. Deepmerge is absent from the dependency tree and lockfile, rather than suppressed from audit output.
- `npm run pack:resolver` rebuilds the tarball from committed files. After modifying it, explicitly install the tarball and regenerate the lockfile. Increment the fork version for subsequent published repository changes so a new artifact cannot be confused with an older one.
- `npm run test:resolver` verifies the actual installed artifact against every vendored file and exercises both module formats through Rollup. CI runs it after a clean install.
- Application code is unchanged apart from release metadata.

## Node toolchain correction

The already-installed Firebase SDK and rules-test packages declare Node >=24.12.0. This became visible during this follow-up install; the previous Node 22 toolchain ran the tests but did not satisfy those engine declarations. package.json, `.nvmrc`, README and CI now select Node 24.12+; release verification uses Node 24.22.2 without changing the machine's default Node installation.

## Verification

- Fresh `npm ci` succeeds; `npm ls --all` reports no invalid packages.
- Full dependency audit: zero vulnerabilities. Production-only audit: zero vulnerabilities.
- The CI audit now fails at low severity, so a future reintroduction is visible and fails checks.
- All 71 application unit tests, 7 resolver compatibility tests and 51 Firestore rules tests pass.
- Typecheck, lint and production/PWA build pass. Existing non-fatal lint and vendor chunk-size warnings remain.
- Release procedure rebuilds after commit, deploys hosting and Firestore rules together, then verifies the live index, application version/commit and service worker against the local release output.

## Removing the fork later

When an upstream resolver release removes deepmerge or provides a supported fix:

1. Remove the direct local resolver dependency and its override.
2. Update the parent dependency chain as needed, regenerate package-lock.json, and confirm Workbox uses the upstream resolver without a vulnerable deepmerge dependency.
3. Remove the vendored source, tarball, patch and packaging script. Keep/adapt the resolver behavior tests; remove only the fork-specific artifact/provenance assertions.
4. Run a clean install, full audit, resolver tests, app tests, rules tests and PWA build before deployment.

The upstream advisory itself is not claimed to be fixed: this project no longer installs the affected package. See [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
