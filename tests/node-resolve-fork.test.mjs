import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { nodeResolve, DEFAULTS } from '@rollup/plugin-node-resolve';

const require = createRequire(import.meta.url);
const commonjs = require('@rollup/plugin-node-resolve');
const installed = resolve(dirname(require.resolve('@rollup/plugin-node-resolve')), '../..');
const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'vendor/rollup-plugin-node-resolve');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

// Check the installed artifact, not just the copy in vendor/.
test('Workbox and both module formats use the same pinned fork without deepmerge', async () => {
  const manifest = await json(join(installed, 'package.json'));
  assert.equal(manifest.version, '16.0.3-woodchuckers.1');
  assert.equal(manifest.dependencies.deepmerge, undefined);
  assert.equal(typeof commonjs, 'function');
  assert.equal(typeof commonjs.nodeResolve, 'function');
  assert.equal(typeof nodeResolve, 'function');
  const workboxRequire = createRequire(require.resolve('workbox-build'));
  assert.equal(workboxRequire.resolve('@rollup/plugin-node-resolve'), require.resolve('@rollup/plugin-node-resolve'));
  const lock = await json(join(root, 'package-lock.json'));
  assert.equal(Object.keys(lock.packages).some((key) => /(^|\/)node_modules\/deepmerge$/.test(key)), false);
  assert.match(lock.packages['node_modules/@rollup/plugin-node-resolve'].resolved, /^file:vendor\//);
});

test('installed tarball matches all reviewed vendor files', async () => {
  for (const file of ['package.json', 'LICENSE', 'README.md', 'FORK.md', 'types/index.d.ts', 'dist/es/package.json', 'dist/es/index.js', 'dist/cjs/index.js']) {
    assert.equal(await readFile(join(installed, file), 'utf8'), await readFile(join(source, file), 'utf8'), file);
  }
});

test('ESM and CJS keep equivalent deeply frozen DEFAULTS and mutable caller options', () => {
  assert.deepEqual(DEFAULTS, commonjs.DEFAULTS);
  assert.deepEqual(DEFAULTS.extensions, ['.mjs', '.js', '.json', '.node']);
  assert.deepEqual(DEFAULTS.dedupe, []);
  for (const defaults of [DEFAULTS, commonjs.DEFAULTS]) {
    assert.equal(Object.isFrozen(defaults), true);
    for (const value of Object.values(defaults)) {
      if (Array.isArray(value)) assert.equal(Object.isFrozen(value), true);
    }
    assert.throws(() => defaults.extensions.push('.unexpected'), TypeError);
  }
  const extensions = ['.js', '.custom'];
  nodeResolve({ extensions });
  commonjs({ extensions });
  extensions.push('.another');
  assert.equal(DEFAULTS.extensions.includes('.another'), false);
});

for (const [format, factory] of [['ESM', nodeResolve], ['CJS', commonjs.nodeResolve]]) {
  for (const browser of [false, true]) {
    test(`${format} resolves package exports, subpaths and browser=${browser}`, async () => {
      const temp = await mkdtemp(join(tmpdir(), 'woodchuckers-resolver-'));
      let bundle;
      try {
        const pkg = join(temp, 'node_modules/fixture');
        await mkdir(pkg, { recursive: true });
        await writeFile(join(pkg, 'package.json'), JSON.stringify({
          name: 'fixture', type: 'module', sideEffects: false,
          exports: { '.': { browser: './browser.js', import: './esm.js', default: './fallback.js' }, './feature': './feature.js' },
        }));
        for (const name of ['browser', 'esm', 'fallback']) await writeFile(join(pkg, `${name}.js`), `export const platform = '${name}';`);
        await writeFile(join(pkg, 'feature.js'), "export default 'feature';");
        await writeFile(join(temp, 'entry.js'), "import { platform } from 'fixture'; import feature from 'fixture/feature'; export default platform + '-' + feature;");
        bundle = await rollup({ input: join(temp, 'entry.js'), plugins: [factory({ browser })], onwarn: (warning) => { throw new Error(warning.message); } });
        const { output } = await bundle.generate({ format: 'es' });
        const loaded = await import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);
        assert.equal(loaded.default, `${browser ? 'browser' : 'esm'}-feature`);
        assert.ok(bundle.watchFiles.includes(await realpath(join(pkg, browser ? 'browser.js' : 'esm.js'))));
      } finally {
        await bundle?.close();
        await rm(temp, { recursive: true, force: true });
      }
    });
  }
}
