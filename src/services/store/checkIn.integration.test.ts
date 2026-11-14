import { cleanFirestoreData } from './helpers';
import { buildMeetupFromRun } from '../../utils/runChoices';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collection, doc, deleteDoc, getDoc, getDocs, query, setDoc, updateDoc, Timestamp, where, type Firestore } from 'firebase/firestore';
import { GUEST_USER, INITIAL_BADGES, CLUB_MILESTONES } from '../../data/catalog';
import { codeKeyFor, memberKeyFor } from '../../utils/memberKey';
import { clubYmd } from '../../utils/dateUtils';
import { createMemberOps } from './members';
import { createRunOps } from './runs';
import { createLegacyOps } from './legacy';
import { createCheckInOps } from './checkIn';
import type { CheckInRecord, MeetupEvent, UserProfile, GPXRoute } from '../../types';

const backend = vi.hoisted(() => ({ current: null as Firestore | null }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, get db() { return backend.current; } }));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let env: RulesTestEnvironment;
const email = 'transaction-runner@example.com';
const user: UserProfile = { ...GUEST_USER, email, firstName: 'Transaction', lastName: 'Runner', displayName: 'Transaction Runner', role: 'member' };
const date = clubYmd();
const events: MeetupEvent[] = ['first', 'second'].map((id) => ({ id, runId: id, date, title: id, time: '18:00', codeWord: id.toUpperCase(), codeWordSet: true, specialEvent: id === 'first' ? 'turkey_trot' : 'none',
  routes: { route: { name: 'Route', actualMiles: 3.1, baseMiles: 3.1, isLoop: false } }, activeDistances: ['route'] }));

it.skipIf(!enabled)('an app check-in to a claimed historical run replaces its run credit instead of adding another', async () => {
  const key=await memberKeyFor(email);
  await env.withSecurityRulesDisabled(async context => {
    const store=context.firestore() as unknown as Firestore;
    await setDoc(doc(store,'users',email),{...user,pre2021Runs:5,legacyEventRuns:1,totalRuns:6,legacyRunKeys:['run:first'],appRunKeys:[],linkedLegacyIds:['old'],linkedLegacyNames:['OLD']});
    await setDoc(doc(store,'legacy_profiles','old'),{id:'old',name:'OLD',oldCount:5,newCount:1,totalRuns:6,attendanceKeys:['run:first'],claimedBy:key,claimedAt:date});
    await setDoc(doc(store,'legacy_history','old'),{events:[{r:'first',d:date,t:'18:00:00',c:'FIRST',s:'turkey_trot'}]});
  });
  const go=(activity: 'running' | 'walking')=>operations().checkInRunner({eventId:'first',userEmail:email,codeWordEntered:'FIRST',activity,distanceChoice:'route'});
  const result=await go('running');
  expect(result.success).toBe(true);
  await result.rewardsReady;
  expect((await getDoc(doc(backend.current!,'users',email))).data()).toMatchObject({pre2021Runs:5,legacyEventRuns:0,loggedRuns:1,totalRuns:6});
  const edit=await go('walking');
  expect(edit.success).toBe(true);
  expect((await getDoc(doc(backend.current!,'users',email))).data()).toMatchObject({legacyEventRuns:0,loggedRuns:1,totalRuns:6});
});

beforeAll(async () => {
  if (!enabled) return;
  env = await initializeTestEnvironment({ projectId: 'demo-woodchuckers-store', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  if (!enabled) return;
  await env.clearFirestore();
  backend.current = env.authenticatedContext('runner', { email, email_verified: true }).firestore() as unknown as Firestore;
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', email), user);
    for (const event of events) {
      const { codeWord, ...publicEvent } = event;
      await setDoc(doc(db, 'runs', event.id), { id: event.id, title: event.title, date, time: '18:00', locationName: 'Club', address: '',
        distanceMiles: 3.1, surface: 'Pavement', elevationGainFt: 0, description: '', paceGroups: [], attendees: [], organizerName: 'Club' });
      await setDoc(doc(db, 'meetup_events', event.id), { ...publicEvent, checkInOpensAt: Timestamp.fromMillis(Date.now() - 3600000), checkInClosesAt: Timestamp.fromMillis(Date.now() + 3600000) });
      await setDoc(doc(db, 'meetup_codes', await codeKeyFor(date, codeWord)), { runId: event.id, date });
    }
  });
});
afterAll(async () => { if (enabled) await env.cleanup(); });

function operations(overrides: Record<string, unknown> = {}) {
  const ctx = { privateSyncEpoch: { current: 0 }, users: [user], currentUser: user, currentUserEmail: email, meetupEvents: events, badges: INITIAL_BADGES, milestones: CLUB_MILESTONES, ...overrides, checkins: [], milestoneAlerts: [],
    setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(), setRuns: vi.fn(), setCheckins: vi.fn(), setMilestoneAlerts: vi.fn(),
    fetchLegacyEvents: async () => [],
    fetchRunnerCheckins: async () => (await getDocs(query(collection(backend.current!, 'checkins'), where('userEmail', '==', email)))).docs.map((d) => d.data() as CheckInRecord) };
  const context = ctx as unknown as Parameters<typeof createCheckInOps>[0];
  const legacy = createLegacyOps(context);
  return createCheckInOps(Object.assign(context, { refreshDerivedStats: legacy.refreshDerivedStats, syncMemberProjection: legacy.syncMemberProjection }));
}

it.skipIf(!enabled)('concurrent check-ins from stale clients preserve both runs, miles and real headcounts', async () => {
  const results = await Promise.all(events.map((event) => operations().checkInRunner({ eventId: event.id, userEmail: email, codeWordEntered: event.codeWord, activity: 'running', distanceChoice: 'route' })));
  expect(results.map((result) => result.success)).toEqual([true, true]);
  await Promise.all(results.map((result) => result.rewardsReady));
  const saved = (await getDoc(doc(backend.current!, 'users', email))).data()!;
  expect(saved.totalRuns).toBe(2);
  expect(saved.totalMiles).toBe(6.2);
  // Finish any refresh which lost the race against the other valid check-in.

  const key = await memberKeyFor(email);
  for (const event of events) {
    expect((await getDoc(doc(backend.current!, 'runs', event.id))).data()!.attendees).toEqual([expect.objectContaining({ memberId: key, checkedIn: true })]);
  }
});

it.skipIf(!enabled)('a member can edit their own check-in, alone or among other attendees', async () => {
  const go = (activity: 'running' | 'walking') => operations().checkInRunner({ eventId: 'first', userEmail: email, codeWordEntered: 'FIRST', activity, distanceChoice: 'route' });
  const first = await go('running');
  expect(first.success).toBe(true);
  await first.rewardsReady;
  const edited = await go('walking');
  expect(edited).toMatchObject({ success: true, message: 'Check-in updated!' });
  await edited.rewardsReady;
  // Someone else joins after this runner, then the runner renames and edits again.
  const other = { memberId: 'other-runner', name: 'Other Runner', checkedIn: false, rsvpDate: date };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    const run = (await getDoc(doc(db, 'runs', 'first'))).data()!;
    await updateDoc(doc(db, 'runs', 'first'), { attendees: [...run.attendees, other] });
  });
  const again = await go('running');
  expect(again.success).toBe(true);
  await again.rewardsReady;
  await updateDoc(doc(backend.current!, 'users', email), { displayName: 'Renamed Runner' });
  const renamed = await go('walking');
  expect(renamed.success).toBe(true);
  await renamed.rewardsReady;
  const key = await memberKeyFor(email);
  expect((await getDoc(doc(backend.current!, 'runs', 'first'))).data()!.attendees).toEqual([expect.objectContaining({ memberId: key, name: 'Renamed Runner', checkedIn: true }), other]);
  expect((await getDoc(doc(backend.current!, 'users', email))).data()).toMatchObject({ totalRuns: 1, totalMiles: 3.1, runCount: 0, walkCount: 1 });
});

it.skipIf(!enabled)('an RSVP, the check-in that follows and leaving all keep one entry per runner', async () => {
  const key = await memberKeyFor(email);
  const runOps = (attendees: unknown[]) => createRunOps({ runs: [{ id: 'second', attendees }], currentUserEmail: email, currentMember: { id: key, name: user.displayName },
    setRuns: vi.fn(), meetupEvents: events, routes: [] } as unknown as Parameters<typeof createRunOps>[0]);
  const saved = async () => (await getDoc(doc(backend.current!, 'runs', 'second'))).data()!;
  await runOps([]).toggleRSVP('second');
  expect(await saved()).toMatchObject({ attendees: [expect.objectContaining({ memberId: key, checkedIn: false })], attendeeIds: [key] });
  // A hand-made second entry is refused.
  const extra = { memberId: key, name: 'Again', checkedIn: false, rsvpDate: 'later' };
  await expect(updateDoc(doc(backend.current!, 'runs', 'second'), { attendees: [...(await saved()).attendees, extra], attendeeIds: [key, key] })).rejects.toHaveProperty('code', 'permission-denied');
  await runOps((await saved()).attendees).toggleRSVP('second');
  expect(await saved()).toMatchObject({ attendees: [], attendeeIds: [] });
  await runOps([]).toggleRSVP('second');
  const checked = await operations().checkInRunner({ eventId: 'second', userEmail: email, codeWordEntered: 'SECOND', activity: 'running', distanceChoice: 'route' });
  expect(checked.success).toBe(true);
  await checked.rewardsReady;
  expect(await saved()).toMatchObject({ attendees: [expect.objectContaining({ memberId: key, checkedIn: true })], attendeeIds: [key] });
});

it.skipIf(!enabled)('attendance-backed rewards work and arbitrary badge/streak grants fail', async () => {
  const checkin = await operations().checkInRunner({ eventId: 'first', userEmail: email, codeWordEntered: 'FIRST', activity: 'running', distanceChoice: 'route' });
  expect(checkin.success).toBe(true);
  await checkin.rewardsReady;
  const ctx = { privateSyncEpoch: { current: 0 }, currentUserEmail: email, meetupEvents: events, badges: INITIAL_BADGES,
    setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(),
    fetchRunnerCheckins: async () => (await getDocs(query(collection(backend.current!, 'checkins'), where('userEmail', '==', email)))).docs.map((d) => d.data() as CheckInRecord) };
  const ops = createLegacyOps(ctx as unknown as Parameters<typeof createLegacyOps>[0]);
  const current = (await getDoc(doc(backend.current!, 'users', email))).data() as UserProfile;
  const refreshed = await ops.refreshDerivedStats(current);
  expect(refreshed.currentStreakWeeks).toBe(1);
  expect(refreshed.longestStreakWeeks).toBe(1);
  expect(refreshed.badgeCounts?.['special-turkey']).toBe(1);
  const specialRef = doc(backend.current!, 'reward_proofs', `${email}_0_special_turkey_trot`);
  const special = (await getDoc(specialRef)).data()!;
  await expect(updateDoc(specialRef, { count: 2, sources: [...special.sources, special.sourceId] })).rejects.toHaveProperty('code', 'permission-denied');
  const anonymous = env.unauthenticatedContext().firestore() as unknown as Firestore;
  await expect(getDocs(collection(anonymous, 'reward_proofs'))).rejects.toHaveProperty('code', 'permission-denied');
  await expect(updateDoc(doc(backend.current!, 'users', email), { currentStreakWeeks: 9999, longestStreakWeeks: 9999 })).rejects.toHaveProperty('code', 'permission-denied');
  await expect(updateDoc(doc(backend.current!, 'users', email), { unlockedBadgeIds: [...refreshed.unlockedBadgeIds, 'milestone-200'], badgeCounts: { ...refreshed.badgeCounts, 'milestone-200': 100 }, rewardChanges: ['milestone-200'] })).rejects.toHaveProperty('code', 'permission-denied');
});

it.skipIf(!enabled)('incremental badges are verified by the rules: Power Walker every 10 walks, Woodchuck Hound every pet check-in', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, 'users', email), { ...user, totalRuns: 25, walkCount: 25, runCount: 0, petRunCount: 3 });
  });
  const ctx = { privateSyncEpoch: { current: 0 }, currentUserEmail: email, meetupEvents: events, badges: INITIAL_BADGES, checkins: [],
    setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(), setMeetupEvents: vi.fn(), fetchRunnerCheckins: async () => [] };
  const ops = createLegacyOps(ctx as unknown as Parameters<typeof createLegacyOps>[0]);
  const current = (await getDoc(doc(backend.current!, 'users', email))).data() as UserProfile;
  const refreshed = await ops.refreshDerivedStats(current);
  expect(refreshed.badgeCounts).toMatchObject({ 'power-walker': 2, 'pet-runner': 3 });
  // A forged level is refused.
  await expect(updateDoc(doc(backend.current!, 'users', email), { badgeCounts: { ...refreshed.badgeCounts, 'power-walker': 9 }, rewardChanges: ['power-walker'] })).rejects.toHaveProperty('code', 'permission-denied');
});

it.skipIf(!enabled)('a first reward sync proves several separate streaks, ignores superseded proofs and writes nothing the second time', async () => {
  const key = await memberKeyFor(email);
  const dates = ['2024-01-03', '2024-01-10', '2024-01-17', '2024-02-07', '2024-02-14', '2024-03-06', '2024-04-03'];
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', email), { ...user, rewardEpoch: 1, totalRuns: 7, legacyEventRuns: 7, linkedLegacyIds: ['old-name'], linkedLegacyNames: ['OLD NAME'] });
    await setDoc(doc(db, 'legacy_profiles', 'old-name'), { id: 'old-name', name: 'OLD NAME', oldCount: 0, newCount: 7, totalRuns: 7, claimedBy: key, claimedAt: date });
    await setDoc(doc(db, 'legacy_history', 'old-name'), { id: 'old-name', events: dates.map((d) => ({ d, t: '18:00', c: 'ACORN' })) });
    // Left over from before an attendance change: a different epoch, never read again.
    await setDoc(doc(db, 'reward_proofs', `${email}_0_week_1`), { userEmail: email, epoch: 0, kind: 'week', week: 1, count: 99, source: {} });
  });
  const ctx = { privateSyncEpoch: { current: 0 }, currentUserEmail: email, meetupEvents: events, badges: INITIAL_BADGES, checkins: [],
    setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(), setMeetupEvents: vi.fn() };
  const ops = createLegacyOps(ctx as unknown as Parameters<typeof createLegacyOps>[0]);
  const profile = async () => (await getDoc(doc(backend.current!, 'users', email))).data() as UserProfile;
  const refreshed = await ops.refreshDerivedStats(await profile());
  expect(refreshed).toMatchObject({ longestStreakWeeks: 3, currentStreakWeeks: 0 });
  // Milestones (like the 5-run shirt) are not badges, so reaching them awards no badge.
  expect(refreshed.badgeCounts?.['milestone-5']).toBeUndefined();
  expect(refreshed.badgeCounts?.['first-chuck']).toBeUndefined();
  const proofs = async () => (await getDocs(query(collection(backend.current!, 'reward_proofs'), where('userEmail', '==', email), where('epoch', '==', 1)))).docs.map((d) => d.data());
  expect((await proofs()).filter((proof) => proof.kind === 'week').map((proof) => proof.count).sort()).toEqual([1, 1, 1, 1, 2, 2, 3]);
  const before = JSON.stringify(await proofs());
  expect(await ops.refreshDerivedStats(await profile())).toMatchObject({ longestStreakWeeks: 3 });
  expect(JSON.stringify(await proofs())).toBe(before);
});

it.skipIf(!enabled)('two administrators deleting the same run subtract its attendance once', async () => {
  const checked = await Promise.all(events.map((event) => operations().checkInRunner({ eventId: event.id, userEmail: email, codeWordEntered: event.codeWord, activity: 'running', distanceChoice: 'route' })));
  expect(checked.every((result) => result.success)).toBe(true);
  await Promise.all(checked.map((result) => result.rewardsReady));
  const adminEmail = 'woodlandwoodchuckers@gmail.com';
  backend.current = env.authenticatedContext('admin', { email: adminEmail, email_verified: true }).firestore() as unknown as Firestore;
  const context = { privateSyncEpoch: { current: 0 }, users: [], currentUser: { ...user, email: adminEmail, role: 'admin' }, currentUserEmail: adminEmail,
    runs: [], routes: [], badges: INITIAL_BADGES, meetupEvents: events, checkins: [],
    setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(), setRuns: vi.fn(), setRoutes: vi.fn(), setCheckins: vi.fn(), setMilestoneAlerts: vi.fn(), setMeetupEvents: vi.fn(), saveMeetupEvent: vi.fn() };
  const ctx = context as unknown as Parameters<typeof createRunOps>[0];
  Object.assign(ctx, createLegacyOps(ctx));
  const ops = createRunOps(ctx);
  await Promise.all([ops.deleteRun('first'), ops.deleteRun('first')]);
  const saved = (await getDoc(doc(backend.current!, 'users', email))).data()!;
  expect(saved.totalRuns).toBe(1);
  expect(saved.totalMiles).toBe(3.1);
  expect((await getDoc(doc(backend.current!, 'checkins', `first_${email}`))).exists()).toBe(false);
  expect((await getDoc(doc(backend.current!, 'runs', 'first'))).exists()).toBe(false);
  expect((await getDoc(doc(backend.current!, 'checkins', `second_${email}`))).exists()).toBe(true);
});

it.skipIf(!enabled)('an interrupted import keeps claims locked, resumes without double credit, and removes omitted history', async () => {
  const key = await memberKeyFor(email);
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', email), { ...user, pre2021Runs: 4, legacyEventRuns: 1, totalRuns: 5, linkedLegacyIds: ['transaction-runner'], linkedLegacyNames: ['TRANSACTION RUNNER'] });
    await setDoc(doc(db, 'legacy_profiles', 'transaction-runner'), { id: 'transaction-runner', name: 'TRANSACTION RUNNER', oldCount: 4, newCount: 1, totalRuns: 5, claimedBy: key, claimedAt: date });
    await setDoc(doc(db, 'legacy_history', 'transaction-runner'), { id: 'transaction-runner', events: [{ d: date, t: '18:00', c: 'TURKEY' }] });
    await setDoc(doc(db, 'legacy_index', 'pool'), { entries: [{ id: 'transaction-runner', name: 'TRANSACTION RUNNER', oldCount: 4, newCount: 1 }] });
  });
  const adminEmail = 'woodlandwoodchuckers@gmail.com';
  const adminDb = env.authenticatedContext('admin', { email: adminEmail, email_verified: true }).firestore() as unknown as Firestore;
  backend.current = adminDb;
  const context = { privateSyncEpoch: { current: 0 }, currentUserEmail: adminEmail, meetupEvents: events, badges: INITIAL_BADGES,
    users: [], checkins: [], legacyPool: [], legacyMembers: [], setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(), setLegacyMembers: vi.fn() };
  const ops = createLegacyOps(context as unknown as Parameters<typeof createLegacyOps>[0]);
  const totals = 'Name,OldCounts\nTRANSACTION RUNNER,8\nOTHER RUNNER,2\n';
  const previousWeek = new Date(Date.parse(`${date}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10);
  const attendance = `Name,Date,Time,Code Name\nTRANSACTION RUNNER,${previousWeek},18:00,ACORN\nTRANSACTION RUNNER,${date},18:00,TURKEY\nOTHER RUNNER,${date},18:00,ACORN\n`;
  await expect(ops.importLegacyData(totals, attendance, () => { throw new Error('Interrupted upload'); })).rejects.toThrow('remains paused');
  expect((await getDoc(doc(adminDb, 'legacy_index', 'pool'))).data()!.entries).toHaveLength(1);
  expect((await getDoc(doc(adminDb, 'settings', 'legacy_import'))).data()!.active).toBe(true);
  backend.current = env.authenticatedContext('runner', { email, email_verified: true }).firestore() as unknown as Firestore;
  await expect(ops.claimLegacyProfile(user, 'other-runner')).rejects.toThrow('being updated');
  backend.current = adminDb;
  // Hold the first upload mid-import so the second genuinely overlaps it.
  let reached!: () => void;
  let release!: () => void;
  const atProgress = new Promise<void>((resolve) => { reached = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const resumed = ops.importLegacyData(totals, attendance, async () => { reached(); await gate; });
  await Promise.race([atProgress, resumed.then(() => { throw new Error('Import finished before the concurrency barrier'); })]);
  try { await expect(ops.importLegacyData(totals, attendance)).rejects.toThrow('Another historical import is running'); }
  finally { release(); }
  await resumed;
  expect((await getDoc(doc(adminDb, 'users', email))).data()).toMatchObject({ totalRuns: 10, pre2021Runs: 8, legacyEventRuns: 2, longestStreakWeeks: 2 });
  expect((await getDoc(doc(adminDb, 'legacy_profiles', 'transaction-runner'))).data()!.claimedBy).toBe(key);
  expect((await getDoc(doc(adminDb, 'legacy_index', 'pool'))).data()!.entries).toHaveLength(2);
  expect((await getDoc(doc(adminDb, 'settings', 'legacy_import'))).data()!.active).toBe(false);
  await ops.importLegacyData('Name,OldCounts\nOTHER RUNNER,2\n', `Name,Date,Time,Code Name\nOTHER RUNNER,${date},18:00,ACORN\n`);
  expect((await getDoc(doc(adminDb, 'users', email))).data()).toMatchObject({ totalRuns: 0, pre2021Runs: 0, legacyEventRuns: 0, linkedLegacyIds: [] });
  expect((await getDoc(doc(adminDb, 'legacy_profiles', 'transaction-runner'))).exists()).toBe(false);
});

it.skipIf(!enabled)('resuming onboarding preserves an existing profile and account changes cannot restore stale data', async () => {
  const checked = await operations().checkInRunner({ eventId: 'first', userEmail: email, codeWordEntered: 'FIRST', activity: 'running', distanceChoice: 'route' });
  expect(checked.success).toBe(true);
  await checked.rewardsReady;
  const context = { privateSessionEpoch: { current: 0 }, currentUserEmail: email, users: [], legacyPool: [],
    setUsers: vi.fn(), setMembers: vi.fn(), setCurrentUserEmail: vi.fn() };
  const ops = createMemberOps(context as unknown as Parameters<typeof createMemberOps>[0]);
  const data = { email, firstName: 'Replacement', lastName: 'Name', shirtSize: 'S' };
  const resumed = await ops.registerUser(data);
  expect(resumed.displayName).toBe('Transaction Runner');
  expect(resumed.totalRuns).toBe(1);
  expect(resumed.totalMiles).toBe(3.1);
  context.setUsers.mockClear(); context.setCurrentUserEmail.mockClear();
  const interrupted = ops.registerUser(data);
  context.privateSessionEpoch.current++;
  await expect(interrupted).rejects.toThrow('signed-in account changed');
  expect(context.setUsers).not.toHaveBeenCalled();
  expect(context.setCurrentUserEmail).not.toHaveBeenCalled();
});

it.skipIf(!enabled)('a full fifth check-in creates gear once and preserves fulfillment when earned again', async () => {
  const before = { ...user, totalRuns: 4, loggedRuns: 4, runCount: 4, totalMiles: 12,
    distanceCounts: { '3': 4, '3.1': 4, '3.1 mi': 4 } };
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore() as unknown as Firestore, 'users', email), before); });
  const first = await operations().checkInRunner({ eventId: 'first', userEmail: email, codeWordEntered: 'FIRST', activity: 'running', distanceChoice: 'route' });
  expect(first.success).toBe(true);
  await first.rewardsReady;
  const alertId = `m5_${email}`;
  expect((await getDoc(doc(backend.current!, 'milestone_alerts', alertId))).data()!.fulfilled).toBe(false);
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await updateDoc(doc(db, 'milestone_alerts', alertId), { fulfilled: true, fulfilledBy: 'Organizer' });
    await deleteDoc(doc(db, 'checkins', `first_${email}`));
    await setDoc(doc(db, 'users', email), { ...before, rewardEpoch: 1 });
  });
  const second = await operations().checkInRunner({ eventId: 'second', userEmail: email, codeWordEntered: 'SECOND', activity: 'running', distanceChoice: 'route' });
  expect(second.success).toBe(true);
  await second.rewardsReady;
  expect((await getDoc(doc(backend.current!, 'milestone_alerts', alertId))).data()).toMatchObject({ fulfilled: true, fulfilledBy: 'Organizer' });
});

it.skipIf(!enabled)('a first-ever check-in creates the First Chuck Run alert through the rules', async () => {
  const fresh = { ...user, totalRuns: 0, loggedRuns: 0, runCount: 0, totalMiles: 0, distanceCounts: {} };
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore() as unknown as Firestore, 'users', email), fresh); });
  const result = await operations().checkInRunner({ eventId: 'first', userEmail: email, codeWordEntered: 'FIRST', activity: 'running', distanceChoice: 'route' });
  expect(result.success, result.message).toBe(true);
  await result.rewardsReady;
  expect((await getDoc(doc(backend.current!, 'milestone_alerts', `m1_${email}`))).data()).toMatchObject({ milestoneRuns: 1, milestoneName: 'First Chuck Run', fulfilled: false });
});

it.skipIf(!enabled)('credits each run using its own loop-choice limit rather than the library default', async () => {
  const loop: GPXRoute = { id: 'route', name: 'Club loop', description: '', distanceMiles: 1.2, elevationGainFt: 0, surface: 'Pavement', difficulty: 'Easy', points: [], isLoop: true, maxLoops: 4, createdAt: '' };
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'routes', loop.id), loop);
    for (const [index, event] of events.entries()) {
      const choices = [{ routeId: loop.id, maxLoops: index === 0 ? 3 : 5 }];
      const { codeWord: _word, ...meetup } = buildMeetupFromRun({ ...event, time: event.time || '18:00', routeChoices: choices }, [loop], event.codeWord);
      await updateDoc(doc(db, 'runs', event.id), { routeChoices: choices, distanceMiles: 1.2 });
      await setDoc(doc(db, 'meetup_events', event.id), { ...cleanFirestoreData(meetup), checkInOpensAt: Timestamp.fromMillis(Date.now() - 3600000), checkInClosesAt: Timestamp.fromMillis(Date.now() + 3600000) });
    }
  });
  for (const [index, event] of events.entries()) {
    const result = await operations().checkInRunner({ eventId: event.id, userEmail: email, codeWordEntered: event.codeWord, activity: 'running', distanceChoice: 'route', loops: index === 0 ? 3 : 5 });
    expect(result.success, `${event.id}: ${result.message || ""}`).toBe(true);
    expect(result.checkIn?.actualMiles).toBe(index === 0 ? 3.6 : 6);
    await result.rewardsReady;
  }
  expect((await getDoc(doc(backend.current!, 'users', email))).data()?.totalMiles).toBe(9.6);
  expect((await getDoc(doc(backend.current!, 'routes', loop.id))).data()?.maxLoops).toBe(4);
});

it.skipIf(!enabled)('a mileage milestone alert goes through the rules in the check-in that crosses it', async () => {
  const before = { ...user, totalRuns: 4, loggedRuns: 4, runCount: 4, totalMiles: 98, distanceCounts: { '3': 4, '3.1': 4, '3.1 mi': 4 } };
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore() as unknown as Firestore, 'users', email), before); });
  const miles = [{ id: 'milestone-miles-100', measure: 'miles' as const, milesRequired: 100, name: '100 Miles', reward: 'Club Pin', perks: '', icon: '📏', description: '', hasGear: true }];
  const ops = operations({ milestones: [...CLUB_MILESTONES, ...miles] });
  const result = await ops.checkInRunner({ eventId: 'first', userEmail: email, codeWordEntered: 'FIRST', activity: 'running', distanceChoice: 'route' });
  expect(result.success, result.message).toBe(true);
  await result.rewardsReady;
  expect((await getDoc(doc(backend.current!, 'milestone_alerts', `mi100_${email}`))).data()).toMatchObject({ milestoneMiles: 100, milestoneRuns: 5, reward: 'Club Pin', fulfilled: false });
  expect((await getDoc(doc(backend.current!, 'milestone_alerts', `m5_${email}`))).exists()).toBe(true);
});

it.skipIf(!enabled)('streak badges count every full block across separate streaks, verified by the rules', async () => {
  const key = await memberKeyFor(email);
  const weeks = (start: string, count: number) => Array.from({ length: count }, (_, i) => { const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * i); return d.toISOString().slice(0, 10); });
  const dates = [...weeks('2024-01-03', 12), ...weeks('2024-05-01', 5)]; // a 12-week streak, a gap, then a 5-week streak
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', email), { ...user, rewardEpoch: 1, totalRuns: 17, legacyEventRuns: 17, linkedLegacyIds: ['old-name'], linkedLegacyNames: ['OLD NAME'] });
    await setDoc(doc(db, 'legacy_profiles', 'old-name'), { id: 'old-name', name: 'OLD NAME', oldCount: 0, newCount: 17, totalRuns: 17, claimedBy: key, claimedAt: date });
    await setDoc(doc(db, 'legacy_history', 'old-name'), { id: 'old-name', events: dates.map((d) => ({ d, t: '18:00', c: 'ACORN' })) });
  });
  const ctx = { privateSyncEpoch: { current: 0 }, currentUserEmail: email, meetupEvents: events, badges: INITIAL_BADGES, checkins: [],
    setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(), setMeetupEvents: vi.fn() };
  const ops = createLegacyOps(ctx as unknown as Parameters<typeof createLegacyOps>[0]);
  const refreshed = await ops.refreshDerivedStats((await getDoc(doc(backend.current!, 'users', email))).data() as UserProfile);
  expect(refreshed.badgeCounts).toMatchObject({ 'streak-4': 4, 'streak-10': 1 }); // 3 + 1, and 1 + 0
  const stepProof = (await getDoc(doc(backend.current!, 'reward_proofs', `${email}_1_streakstep_4`))).data()!;
  expect(stepProof.count).toBe(4);
  // A forged level is refused, and so is a step proof for a week that isn't a block boundary.
  await expect(updateDoc(doc(backend.current!, 'users', email), { badgeCounts: { ...refreshed.badgeCounts, 'streak-4': 9 }, rewardChanges: ['streak-4'] })).rejects.toHaveProperty('code', 'permission-denied');
  const offBeat = { ...stepProof, count: 5, sources: [...stepProof.sources, stepProof.sources[0] + 1], week: stepProof.sources[0] + 1 };
  await expect(setDoc(doc(backend.current!, 'reward_proofs', `${email}_1_streakstep_4`), offBeat)).rejects.toHaveProperty('code', 'permission-denied');
});

it.skipIf(!enabled)('once the starter pack is saved there are no built-in badges: a badge only counts while its document exists', async () => {
  const powerWalker = INITIAL_BADGES.find((b) => b.id === 'power-walker')!;
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', email), { ...user, totalRuns: 25, walkCount: 25, runCount: 0, petRunCount: 0 });
    await setDoc(doc(db, 'settings', 'catalog'), { seeded: true, seededAt: '2026-11-12T00:00:00.000Z' }); // seeded, but no badge documents at all
  });
  const ctx = { privateSyncEpoch: { current: 0 }, currentUserEmail: email, meetupEvents: events, badges: [powerWalker], checkins: [],
    setOwnLegacyEvents: vi.fn(), setUsers: vi.fn(), setMembers: vi.fn(), setMeetupEvents: vi.fn(), fetchRunnerCheckins: async () => [] };
  const ops = createLegacyOps(ctx as unknown as Parameters<typeof createLegacyOps>[0]);
  const current = async () => (await getDoc(doc(backend.current!, 'users', email))).data() as UserProfile;
  // Seeded club, badge document deleted: the old built-in rule no longer vouches for it.
  await expect(ops.refreshDerivedStats(await current())).rejects.toHaveProperty('code', 'permission-denied');
  // Saved as a document (and editable: here a different level size), it counts under whatever the club defined.
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore() as unknown as Firestore, 'badges', 'power-walker'), { ...powerWalker, triggerConfig: { ...powerWalker.triggerConfig, step: 5 } });
  });
  const edited = { ...powerWalker, triggerConfig: { ...powerWalker.triggerConfig, step: 5 } };
  const refreshed = await createLegacyOps({ ...ctx, badges: [edited] } as unknown as Parameters<typeof createLegacyOps>[0]).refreshDerivedStats(await current());
  expect(refreshed.badgeCounts).toMatchObject({ 'power-walker': 5 }); // 25 walks, a level every 5 (was every 10)
});

it.skipIf(!enabled)('maintenance explains organizer publish refusal while an admin can publish the complete run atomically', async () => {
  const route: GPXRoute = { id: 'publish-route', name: 'Publish route', description: '', distanceMiles: 3.1, elevationGainFt: 0, surface: 'Pavement', difficulty: 'Easy', points: [{ lat: 38.67, lon: -121.77 }], createdAt: '2026-11-13T00:00:00Z' };
  const organizer = { ...user, role: 'organizer' as const };
  await env.withSecurityRulesDisabled(async c => {
    const store = c.firestore() as unknown as Firestore;
    await setDoc(doc(store, 'users', email), organizer);
    await setDoc(doc(store, 'settings', 'maintenance'), { active: true });
    await setDoc(doc(store, 'routes', route.id), route);
  });
  const ctx = { currentUser: organizer, currentUserEmail: email, routes: [route], meetupEvents: [], setRuns: vi.fn(), setMeetupEvents: vi.fn() } as unknown as Parameters<typeof createRunOps>[0];
  const details = { title: 'Next club run', date: '2099-11-18', time: '06:30 PM', locationName: 'Club', address: '', distanceMiles: 3.1, elevationGainFt: 0, surface: 'Pavement' as const, description: '', routeId: route.id, routeChoices: [{ routeId: route.id }], paceGroups: [], organizerName: 'Host' };
  await expect(createRunOps(ctx).createRunWithCheckIn(details, 'FUTURE')).rejects.toMatchObject({ code: 'club-maintenance' });
  expect((await getDocs(collection(backend.current!, 'runs'))).size).toBe(2);
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore() as unknown as Firestore, 'users', email), { role: 'admin' }));
  ctx.currentUser = { ...organizer, role: 'admin' };
  const created = await createRunOps(ctx).createRunWithCheckIn(details, 'FUTURE');
  for (const collectionName of ['runs', 'meetup_events', 'meetup_secrets']) expect((await getDoc(doc(backend.current!, collectionName, created.id))).exists()).toBe(true);
  expect((await getDoc(doc(backend.current!, 'meetup_codes', await codeKeyFor(details.date, 'FUTURE')))).data()?.runId).toBe(created.id);
  expect((await getDoc(doc(backend.current!, 'routes', route.id))).data()?.referenced).toBe(true);
});
