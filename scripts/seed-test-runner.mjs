/**
 * Creates (or removes) a TEST runner who reached 5 runs but has not been handed the 5-run shirt.
 *
 *   node scripts/seed-test-runner.mjs                  dry run: lists what would be written
 *   node scripts/seed-test-runner.mjs --write          write it to Firestore
 *   node scripts/seed-test-runner.mjs --write --sixth-run   also add a 6th run she attended (shows the owed shirt raised again)
 *   node scripts/seed-test-runner.mjs --write --test2 49    also create "Test Runner 2" at 49 total runs (--test2 50: hat owed;
 *                                                           --test2 51: hat owed and checked in again)
 *   node scripts/seed-test-runner.mjs --remove         delete every document this script creates
 *
 * Needs admin access to the project: `gcloud auth application-default login` (as a project owner), or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a service account. Use --project to target another project.
 * With FIRESTORE_EMULATOR_HOST set it writes to the local emulator instead.
 */
import { createRequire } from 'node:module';
import { buildTestRunnerSeed, TEST_EMAIL, TEST2_EMAIL } from './lib/test-runner-seed.mjs';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const projectIndex = args.indexOf('--project');
const projectId = projectIndex >= 0 ? args[projectIndex + 1] : 'woodland-woodchuckers';
const write = flag('--write');
const remove = flag('--remove');

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
initializeApp({ projectId });
const db = getFirestore();

const test2Index = args.indexOf('--test2');
const test2 = test2Index >= 0 ? Number(args[test2Index + 1]) : undefined;
if (test2 !== undefined && ![49, 50, 51].includes(test2)) { console.error('--test2 must be 49, 50 or 51'); process.exit(1); }
// --remove builds the largest variant so it cleans up every document any variant could have created.
const seed = buildTestRunnerSeed({ ts: (iso) => Timestamp.fromDate(new Date(iso)), sixthRun: remove || flag('--sixth-run'), test2: remove ? 51 : test2 });
const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : `project ${projectId}`;

if (remove) {
  console.log(`Removing ${seed.docs.length} test documents from ${target}…`);
  for (const { path } of seed.docs) await db.doc(path).delete();
  console.log(`Done. (${TEST_EMAIL} and its runs, check-ins and alert are gone.)`);
} else if (!write) {
  console.log(`DRY RUN against ${target}. Would write ${seed.docs.length} documents:`);
  for (const { path } of seed.docs) console.log(`  ${path}`);
  console.log('\nAdd --write to create them, or --remove to delete them later.');
} else {
  console.log(`Writing ${seed.docs.length} test documents to ${target}…`);
  for (const { path, data } of seed.docs) await db.doc(path).set(data);
  console.log(`Done. Test runner: ${TEST_EMAIL}${test2 ? ` and ${TEST2_EMAIL} (${test2} runs)` : ''}\nShirt alert: milestone_alerts/${seed.alertId} (pending). Remove with: node scripts/seed-test-runner.mjs --remove`);
}
