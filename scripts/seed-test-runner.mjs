/**
 * Creates (or removes) a TEST runner who reached 5 runs but has not been handed the 5-run shirt.
 *
 *   node scripts/seed-test-runner.mjs                  dry run: lists what would be written
 *   node scripts/seed-test-runner.mjs --write          write it to Firestore
 *   node scripts/seed-test-runner.mjs --write --sixth-run   also add a 6th run she attended (shows the owed shirt raised again)
 *   node scripts/seed-test-runner.mjs --write --test2 49    also create "Test Runner 2" at 49 total runs (--test2 50: hat owed;
 *                                                           --test2 51: hat owed and checked in again)
 *   node scripts/seed-test-runner.mjs --checkin-tonight   check both test runners into TONIGHT's run (even though check-in isn't open yet)
 *                                                         [--run <runId>] to pick the run, [--distance <key>] to pick the route choice
 *   node scripts/seed-test-runner.mjs --remove         delete every document this script creates, including their check-ins at real runs
 *
 * Needs admin access to the project: `gcloud auth application-default login` (as a project owner), or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a service account. Use --project to target another project.
 * With FIRESTORE_EMULATOR_HOST set it writes to the local emulator instead.
 */
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { buildTestRunnerSeed, memberKeyFor, TEST_EMAIL, TEST2_EMAIL } from './lib/test-runner-seed.mjs';

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
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const checkInTonight = flag('--checkin-tonight');
const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : `project ${projectId}`;
const TEST_EMAILS = [TEST_EMAIL, TEST2_EMAIL];

/** Today's date in the club's time zone (YYYY-MM-DD). */
const clubToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** The app's own check-in rules, bundled so the script credits runs, miles, streaks, badges and milestone alerts exactly as a real check-in does. */
async function loadAppLogic() {
  const root = new URL('..', import.meta.url).pathname;
  const out = await build({
    stdin: {
      contents: "export { calculateCheckIn } from './src/services/store/checkInModel.ts'; export { INITIAL_BADGES, CLUB_MILESTONES } from './src/data/catalog.ts'; export { isBadge } from './src/services/store/helpers.ts';",
      resolveDir: root, loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
    external: ['firebase/*', '../firebase', '../firebase.ts'],
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

const withCatalog = (remote, builtIn) => { const ids = new Set(remote.map((x) => x.id)); return [...builtIn.filter((x) => !ids.has(x.id)), ...remote]; };
const clean = (value) => JSON.parse(JSON.stringify(value)); // drop undefined fields for Firestore

async function checkInTestRunners() {
  const { calculateCheckIn, INITIAL_BADGES, CLUB_MILESTONES, isBadge } = await loadAppLogic();
  // Find tonight's run.
  let runId = option('--run');
  if (!runId) {
    const today = clubToday();
    const found = await db.collection('runs').where('date', '==', today).get();
    if (found.size !== 1) {
      console.error(found.empty ? `No run is scheduled for today (${today}). Pass --run <runId>.` : `Several runs are scheduled for ${today} (${found.docs.map((d) => d.id).join(', ')}). Pass --run <runId>.`);
      process.exit(1);
    }
    runId = found.docs[0].id;
  }
  const [runSnap, eventSnap] = await Promise.all([db.doc(`runs/${runId}`).get(), db.doc(`meetup_events/${runId}`).get()]);
  if (!runSnap.exists || !eventSnap.exists) { console.error(`Run ${runId} (or its check-in event) was not found.`); process.exit(1); }
  const event = { ...eventSnap.data(), id: runId, codeWord: '' };
  const distanceChoice = option('--distance') || (event.activeDistances || Object.keys(event.routes))[0];
  const [badgeDocs, milestoneDocs] = await Promise.all([db.collection('badges').get(), db.collection('milestones').get()]);
  const badges = withCatalog(badgeDocs.docs.map((d) => ({ ...d.data(), id: d.id })), INITIAL_BADGES).filter(isBadge);
  const milestones = withCatalog(milestoneDocs.docs.map((d) => ({ ...d.data(), id: d.id })), CLUB_MILESTONES);
  console.log(`Checking test runners into ${runId} ("${event.title}", ${event.date}) on ${target}, route choice "${distanceChoice}"…`);
  for (const email of TEST_EMAILS) {
    const userSnap = await db.doc(`users/${email}`).get();
    if (!userSnap.exists) { console.log(`  ${email}: not created yet (run with --write first) - skipped`); continue; }
    if ((await db.doc(`checkins/${runId}_${email}`).get()).exists) { console.log(`  ${email}: already checked in - skipped`); continue; }
    const user = userSnap.data();
    const history = (await db.collection('checkins').where('userEmail', '==', email).get()).docs.map((d) => d.data());
    const eventDocs = await Promise.all([...new Set(history.map((c) => c.runId).filter(Boolean))].map((id) => db.doc(`meetup_events/${id}`).get()));
    const meetupEvents = eventDocs.filter((d) => d.exists).map((d) => ({ ...d.data(), id: d.id }));
    const result = calculateCheckIn({ eventId: runId, userEmail: email, codeWordEntered: 'ADMIN', activity: 'running', distanceChoice }, user, event, undefined, history, [], badges, meetupEvents, milestones);
    const key = memberKeyFor(email);
    const u = result.updatedUser;
    const checkin = clean({ ...result.newCheckIn, source: 'admin', codeWord: undefined });
    const attendee = { memberId: key, name: u.displayName, checkedIn: true, checkedInAt: result.newCheckIn.createdAt, rsvpDate: result.newCheckIn.createdAt };
    await db.runTransaction(async (tx) => {
      const run = (await tx.get(db.doc(`runs/${runId}`))).data();
      tx.set(db.doc(`checkins/${runId}_${email}`), checkin);
      tx.set(db.doc(`users/${email}`), clean(u));
      tx.set(db.doc(`members/${key}`), clean({ id: key, name: u.displayName, totalRuns: u.totalRuns, totalMiles: u.totalMiles, runCount: u.runCount, walkCount: u.walkCount, petRunCount: u.petRunCount || 0, streak: u.currentStreakWeeks || 0, favoritePace: u.preferredPace || '9:00 min/mi', unlockedBadgeIds: u.unlockedBadgeIds, badgeCounts: u.badgeCounts, joinedDate: u.firstRunDate, lastCheckInDate: u.lastCheckInDate }));
      tx.update(db.doc(`runs/${runId}`), { attendees: [...(run.attendees || []).filter((a) => a.memberId !== key), attendee], attendeeIds: [...new Set([...(run.attendeeIds || []), key])] });
      for (const alert of result.unlockedMilestones) tx.set(db.doc(`milestone_alerts/${alert.id}`), clean(alert));
    });
    const alerts = result.unlockedMilestones.map((a) => `${a.milestoneName} (${a.reward})`).join(', ');
    console.log(`  ${email}: checked in, now at ${u.totalRuns} runs${alerts ? `. Milestone alert: ${alerts}` : ''}`);
  }
  console.log('Done. Open the run\'s Check-ins window as an organizer.');
}

/** Delete the seed documents, then sweep up anything the test runners did at real runs (check-ins, attendee entries, alerts). */
async function removeAll() {
  const seed = buildTestRunnerSeed({ ts: (iso) => Timestamp.fromDate(new Date(iso)), sixthRun: true, test2: 51 });
  const seedPaths = new Set(seed.docs.map((d) => d.path));
  console.log(`Removing test data from ${target}…`);
  for (const email of TEST_EMAILS) {
    const key = memberKeyFor(email);
    for (const c of (await db.collection('checkins').where('userEmail', '==', email).get()).docs) {
      const runId = c.data().runId;
      if (runId && !seedPaths.has(`runs/${runId}`)) {
        await db.runTransaction(async (tx) => {
          const ref = db.doc(`runs/${runId}`);
          const run = await tx.get(ref);
          if (run.exists) tx.update(ref, { attendees: (run.data().attendees || []).filter((a) => a.memberId !== key), attendeeIds: (run.data().attendeeIds || []).filter((id) => id !== key) });
        });
        console.log(`  removed ${email} from real run ${runId}`);
      }
    }
    for (const a of (await db.collection('milestone_alerts').where('userEmail', '==', email).get()).docs) await a.ref.delete();
  }
  for (const { path } of seed.docs) await db.doc(path).delete();
  for (const email of TEST_EMAILS) for (const c of (await db.collection('checkins').where('userEmail', '==', email).get()).docs) await c.ref.delete();
  console.log(`Done. (${TEST_EMAILS.join(' and ')}, their runs, check-ins and alerts are gone.)`);
}

if (remove) {
  await removeAll();
} else if (checkInTonight) {
  await checkInTestRunners();
} else {
  const seed = buildTestRunnerSeed({ ts: (iso) => Timestamp.fromDate(new Date(iso)), sixthRun: flag('--sixth-run'), test2 });
  if (!write) {
    console.log(`DRY RUN against ${target}. Would write ${seed.docs.length} documents:`);
    for (const { path } of seed.docs) console.log(`  ${path}`);
    console.log('\nAdd --write to create them, or --remove to delete them later.');
  } else {
    console.log(`Writing ${seed.docs.length} test documents to ${target}…`);
    for (const { path, data } of seed.docs) await db.doc(path).set(data);
    console.log(`Done. Test runner: ${TEST_EMAIL}${test2 ? ` and ${TEST2_EMAIL} (${test2} runs)` : ''}\nShirt alert: milestone_alerts/${seed.alertId} (pending). Check them into tonight's run with --checkin-tonight, or remove with --remove.`);
  }
}
