// The test-runner seed must be acceptable to the Firestore rules when an admin writes it, so the records stay editable in the app.
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { buildTestRunnerSeed, pastWednesdays, TEST_EMAIL, TEST2_EMAIL } from '../scripts/lib/test-runner-seed.mjs';

let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-woodchuckers-seed', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
after(async () => env?.cleanup());

const adminDb = () => env.authenticatedContext('admin', { email: 'woodlandwoodchuckers@gmail.com', email_verified: true }).firestore();

test('past Wednesdays are Wednesdays, oldest first, all before today', () => {
  const dates = pastWednesdays(new Date('2026-11-11T20:00:00Z'), 5); // 11 Nov 2026 is itself a Wednesday
  assert(dates.length === 5);
  for (const d of dates) assert(new Date(`${d}T00:00:00Z`).getUTCDay() === 3 && d < '2026-11-11');
  assert(dates[4] === '2026-11-04' && dates[0] === '2026-10-07');
});

for (const [sixthRun, test2] of [[false, undefined], [true, undefined], [false, 49], [false, 50], [true, 51]]) {
  test(`seed documents are accepted by the rules for an admin (${sixthRun ? 'six' : 'five'} runs, test2 ${test2 ?? 'off'})`, async () => {
    await env.clearFirestore();
    const { docs } = buildTestRunnerSeed({ now: new Date('2026-11-11T20:00:00Z'), ts: (iso) => Timestamp.fromDate(new Date(iso)), sixthRun, test2 });
    const db = adminDb();
    // Parents before check-ins: the user and each run's check-in event must exist first.
    const order = ['users/', 'members/', 'runs/', 'meetup_events/', 'checkins/', 'milestone_alerts/'];
    for (const prefix of order) for (const { path, data } of docs.filter((d) => d.path.startsWith(prefix))) {
      try { await assertSucceeds(setDoc(doc(db, path), data)); } catch (error) { throw new Error(`${path}: ${error.message}`); }
    }
    assert(docs.some((d) => d.path === `milestone_alerts/m5_${TEST_EMAIL}` && d.data.fulfilled === false));
    const t2 = docs.find((d) => d.path === `users/${TEST2_EMAIL}`);
    if (test2) {
      assert(t2.data.totalRuns === test2 && t2.data.pre2021Runs + t2.data.loggedRuns === test2);
      assert(docs.filter((d) => d.path === `checkins/${d.data.runId}_${TEST2_EMAIL}`).length === test2 - 44);
      assert(docs.some((d) => d.path === `milestone_alerts/m50_${TEST2_EMAIL}`) === (test2 >= 50));
    } else assert(!t2);
  });
}

function assert(condition) { if (!condition) throw new Error('assertion failed'); }
