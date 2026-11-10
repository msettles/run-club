# Woodland Woodchuckers local fork

Base: `@rollup/plugin-node-resolve@16.0.3` from the npm registry.
Upstream tarball: https://registry.npmjs.org/@rollup/plugin-node-resolve/-/plugin-node-resolve-16.0.3.tgz
Verified SHA-512 integrity: `sha512-lUYM3UBGuM93CnMPG1YocWu7X802BrNF3jW2zny5gQyLQgRFJhV1Sq0Zi74+dh/6NBx1DxFC4b4GXg9wUCG5Qg==`.
The original MIT license and attribution are preserved in LICENSE.

Local version: `16.0.3-woodchuckers.1`. Private; never publish this package to npm.

## Patch

In both `dist/es/index.js` and `dist/cjs/index.js`:

1. Remove the deepmerge import/require.
2. Replace `deepFreeze(deepMerge({}, defaults))` with
   `deepFreeze(structuredClone(defaults))`.

Remove deepmerge from package dependencies. No resolver algorithm, exports,
options or type declarations change. The defaults consist solely of arrays of
strings and primitive values, so structuredClone preserves their values and
keeps the exported frozen DEFAULTS separate from mutable internal defaults.
Native structuredClone is available in Node 22/24; the application itself
requires Node 24.12+ because of its Firebase tooling.

## Packaging and replacement

From the repository root, run `npm run pack:resolver` on Node 24.12+.
The committed tarball is used as a direct dev dependency and an npm override,
so Workbox also gets this exact fork. The lockfile pins its integrity.
Do not edit node_modules or apply an install-time patch.

Tests in tests/node-resolve-fork.test.mjs check both CJS and ESM exports,
frozen defaults, mutable options, package exports/browser resolution, the
installed Workbox dependency path and tarball/source agreement.

When an upstream resolver release removes deepmerge or adopts a supported
fix, delete the direct fork dependency, override, vendored files and packaging
script, then regenerate the lockfile and rerun the resolver and PWA tests.
