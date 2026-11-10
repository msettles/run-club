import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'));
const entry = Object.keys(manifest).find((key) => manifest[key].isEntry && key.endsWith('.html'));
assert(entry, 'Missing application entry');
const initial = new Set();
function visit(key) {
  if (initial.has(key)) return;
  initial.add(key);
  for (const child of manifest[key].imports || []) visit(child);
}
visit(entry);
let bytes = 0;
for (const key of initial) {
  const chunk = manifest[key];
  assert(!/leaflet|initialData/.test(key + chunk.file), `Lazy content became an initial import: ${key}`);
  const path = new URL(`../dist/${chunk.file}`, import.meta.url);
  const source = readFileSync(path, 'utf8');
  assert(!source.includes('Wrap initialization of analytics in analytics.isSupported()'), 'Analytics became an initial download');
  assert(!source.includes('firebase-messaging-database'), 'Messaging became an initial download');
  assert(!/firebase\/(analytics|messaging)/.test(key), `Optional Firebase SDK became an initial import: ${key}`);
  bytes += statSync(path).size;
}
console.log(`Initial JavaScript: ${bytes.toLocaleString()} bytes; maps, sample fixtures, Analytics and Messaging remain lazy.`);
