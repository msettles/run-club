import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { assistedCheckIn } from './assistedCheckIn';
import { GUEST_USER } from '../../src/data/catalog';
import { clubYmd } from '../../src/utils/dateUtils';
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let app: App; let db: Firestore; let env: RulesTestEnvironment;
const email = 'runner@example.test', organizer = 'org@example.test', runId = 'table-run';
const input = { eventId: runId, userEmail: email, activity: 'running', distanceChoice: 'short', loops: 1, withPet: false };
const invoke = (data: unknown = input, actor = organizer, verified = true) => assistedCheckIn.run({ data, auth: { uid: actor, token: { email: actor, email_verified: verified } } } as Parameters<typeof assistedCheckIn.run>[0]);
beforeAll(async () => {
  if (!enabled) return;
  app = initializeApp({ projectId: 'demo-woodchuckers-assisted' }); db = getFirestore(app);
  env = await initializeTestEnvironment({ projectId: 'demo-woodchuckers-assisted' });
});
afterAll(async () => { if (enabled) { await env.cleanup(); await deleteApp(app); } });
beforeEach(async () => {
  if (!enabled) return;
  await env.clearFirestore();
  const now = Date.now(), date = clubYmd();
  const profile = { ...GUEST_USER, email, firstName: 'Test', lastName: 'Runner', displayName: 'Test Runner', role: 'member', totalRuns: 4, loggedRuns: 4, totalMiles: 12, runCount: 4 };
  await Promise.all([
    db.collection('users').doc(email).set(profile),
    db.collection('users').doc(organizer).set({ ...profile, email: organizer, role: 'organizer' }),
    db.collection('runs').doc(runId).set({ id: runId, date, title: 'Table run', attendees: [], attendeeIds: [] }),
    db.collection('meetup_events').doc(runId).set({ id: runId, date, title: 'Table run', time: '06:30 PM', codeWordSet: true, checkInOpensAt: Timestamp.fromMillis(now - 3600000), checkInClosesAt: Timestamp.fromMillis(now + 3600000), activeDistances: ['short'], routes: { short: { routeId: 'short', name: 'Patio loop', actualMiles: 1.19, baseMiles: 1.19, isLoop: true, maxLoops: 3 } } }),
    db.collection('meetup_secrets').doc(runId).set({ codeWord: 'PRIVATE' }),
    db.collection('milestones').doc('five').set({ runsRequired: 5, name: 'Five runs', reward: 'Club shirt', hasGear: true }),
  ]);
});
describe.skipIf(!enabled)('assisted check-in server with real Firestore transactions', () => {
  it('updates attendance, stats, RSVP, reward and private staff audit atomically', async () => {
    expect((await invoke({ ...input, activity: 'walking', loops: 2, withPet: true })).success).toBe(true);
    expect((await db.collection('users').doc(email).get()).data()).toMatchObject({ totalRuns: 5, loggedRuns: 5, totalMiles: 14.38, walkCount: 1, petRunCount: 1, streakProofWeek: Math.floor(Date.parse(`${clubYmd()}T00:00:00Z`) / 604800000 + 3 / 7) });
    expect((await db.collection('checkins').doc(`${runId}_${email}`).get()).data()).toMatchObject({ source: 'admin', actualMiles: 2.38, loops: 2, withPet: true });
    expect((await db.collection('runs').doc(runId).get()).data()?.attendees).toHaveLength(1);
    expect((await db.collection('milestone_alerts').doc(`m5_${email}`).get()).exists).toBe(true);
    expect((await db.collection('assisted_checkins').doc(`${runId}_${email}`).get()).data()).toMatchObject({ assistedBy: organizer, userEmail: email, actualMiles: 2.38 });
    expect(JSON.stringify((await db.collection('members').get()).docs.map((d) => d.data()))).not.toContain(email);
  });
  it('two simultaneous requests add one attendance and one reward', async () => {
    const results = await Promise.all([invoke(), invoke()]);
    expect(results.filter((r) => r.alreadyCheckedIn)).toHaveLength(1);
    expect((await db.collection('users').doc(email).get()).data()).toMatchObject({ totalRuns: 5, totalMiles: 13.19 });
    expect((await db.collection('assisted_checkins').get()).size).toBe(1);
    expect((await db.collection('milestone_alerts').get()).size).toBe(1);
  });
  it('refuses nonstaff, unverified callers, invalid routes and too many loops', async () => {
    await expect(invoke(input, email)).rejects.toThrow('organizers');
    await expect(invoke(input, organizer, false)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(invoke({ ...input, distanceChoice: 'invented' })).rejects.toThrow('route');
    await expect(invoke({ ...input, loops: 4 })).rejects.toThrow('3 loops');
    expect((await db.collection('checkins').get()).empty).toBe(true);
  });
  it('refuses maintenance and imports even for admin callers', async () => {
    await db.collection('users').doc(organizer).update({ role: 'admin' });
    await db.collection('settings').doc('maintenance').set({ active: true });
    await expect(invoke()).rejects.toThrow('paused');
    await db.collection('settings').doc('maintenance').set({ active: false });
    await db.collection('settings').doc('legacy_import').set({ active: true });
    await expect(invoke()).rejects.toThrow('paused');
  });
  it('does not bypass the window, edit existing attendance or overwrite a fulfilled handout', async () => {
    await db.collection('milestone_alerts').doc(`m5_${email}`).set({ fulfilled: true, fulfilledBy: 'Original organizer' });
    await invoke(); await invoke({ ...input, loops: 3, activity: 'walking' });
    expect((await db.collection('checkins').doc(`${runId}_${email}`).get()).data()?.actualMiles).toBe(1.19);
    expect((await db.collection('milestone_alerts').doc(`m5_${email}`).get()).data()).toEqual({ fulfilled: true, fulfilledBy: 'Original organizer' });
    await db.collection('meetup_events').doc(runId).update({ checkInClosesAt: Timestamp.fromMillis(Date.now() - 1000) });
    await expect(invoke()).rejects.toThrow('window');
  });
  it('deduplicates claimed historical attendance without discarding undated credits', async () => {
    await db.collection('users').doc(email).update({ totalRuns: 8, loggedRuns: 0, totalMiles: 0, runCount: 0, pre2021Runs: 7, legacyEventRuns: 1,
      legacyRunKeys: [`run:${runId}`], appRunKeys: [], linkedLegacyIds: ['first', 'alias'], linkedLegacyNames: ['FIRST', 'ALIAS'] });
    for (const id of ['first', 'alias']) await db.collection('legacy_history').doc(id).set({ events: [{ r: runId, d: clubYmd(), t: '18:00:00', c: 'OLD' }] });
    await invoke();
    expect((await db.collection('users').doc(email).get()).data()).toMatchObject({ totalRuns: 8, pre2021Runs: 7, loggedRuns: 1, legacyEventRuns: 0, totalMiles: 1.19 });
    expect((await db.collection('legacy_history').get()).size).toBe(2);
  });
  it('blocks deleting runners and pending claims before any attendance write', async () => {
    await db.collection('users').doc(email).update({ deleting: true });
    await expect(invoke()).rejects.toThrow('registration');
    await db.collection('users').doc(email).update({ deleting: false, pendingLegacyClaim: 'pending' });
    await expect(invoke()).rejects.toThrow('claim');
    expect((await db.collection('assisted_checkins').get()).empty).toBe(true);
  });
});
