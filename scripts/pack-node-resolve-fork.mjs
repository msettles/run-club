// Package reviewed, committed distribution files; no download or node_modules patching.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
execFileSync('npm', ['pack', './vendor/rollup-plugin-node-resolve', '--pack-destination', './vendor', '--ignore-scripts'], {
  cwd: root,
  stdio: 'inherit',
});
