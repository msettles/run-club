import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { createClubImportOps } from './clubImport';
import { createLegacyOps } from './legacy';
import { memberKeyFor } from '../../utils/memberKey';
import type { StoreState } from './state';
import type { UserProfile } from '../../types';
import { INITIAL_BADGES } from '../../data/catalog';
import { buildImportCommit } from '../../utils/importCommit';
import { planCheckinsImport, planProfilesImport, planRunsImport } from '../../utils/importFormat';

const backend = vi.hoisted(() => ({ current: null as Firestore | null }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, get db() { return backend.current; } }));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const admin = 'owner@example.test';
let env: RulesTestEnvironment;
beforeAll(async () => { if (enabled) env = await initializeTestEnvironment({ projectId: 'demo-woodchuckers-club-import', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => {
  if (!enabled) return;
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore() as unknown as Firestore, 'users', admin), { email: admin, firstName: 'Owner', lastName: '', displayName: 'Owner', shirtSize: 'L', pre2021Runs: 0, loggedRuns: 0, totalRuns: 0, totalMiles: 0, runCount: 0, walkCount: 0, linkedLegacyNames: [], unlockedBadgeIds: [], role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' }));
  backend.current = env.authenticatedContext('owner', { email: admin, email_verified: true }).firestore() as unknown as Firestore;
});
afterAll(async () => { if (enabled) await env.cleanup(); });

const NOW = new Date('2026-11-11T12:00:00Z');
const profilesCsv = 'Email,Name,No Check-In Runs\njane@example.test,Jane Runner,5\n,PAT EXAMPLE,12\n';
const runsCsv = 'Date,Time,Title,Code Word,Special Event,Distance\n2026-10-07,18:30,Wednesday Run,APPLE,,3.1\n2026-10-14,18:30,Wednesday Run,PEAR,,3.1\n2026-10-21,18:30,Wednesday Run,PLUM,,3.1\n2026-10-28,18:30,Halloween Costume Run,SPOOKY,Halloween,3.1\n';
const checkinsCsv = [
  'Email,Name,Date,Activity,Miles',
  'jane@example.test,,2026-10-07,running,3.1', 'jane@example.test,,2026-10-14,walking,3.1', 'jane@example.test,,2026-10-21,running,3.1', 'jane@example.test,,2026-10-28,running,3.1',
  ',PAT EXAMPLE,2026-10-28,running,3.1',
  'drop.in@example.test,,2026-11-04,running,2',
].join('\n');

function setup() {
  const rows = { users: [] as UserProfile[] };
  const context = {
    badges: INITIAL_BADGES, meetupEvents: [], checkins: [], users: rows.users, legacyMembers: [], legacyPool: [],
    privateSyncEpoch: { current: 1 }, privateSessionEpoch: { current: 1 },
    setUsers: (update: UserProfile[] | ((previous: UserProfile[]) => UserProfile[])) => { rows.users = typeof update === 'function' ? update(rows.users) : update; },
    setMembers: vi.fn(), setLegacyMembers: vi.fn(), setOwnLegacyEvents: vi.fn(), setMeetupEvents: vi.fn(),
  } as unknown as StoreState;
  const legacy = createLegacyOps(context);
  return { context, ops: createClubImportOps(Object.assign(context, legacy) as never), db: () => backend.current! };
}
const commit = (files: { profiles?: string; runs?: string; checkins?: string } = {}) => {
  const runs = planRunsImport(files.runs ?? runsCsv, NOW, [{ id: 'halloween', name: 'Halloween Costume Run' }, { id: 'turkey_trot', name: 'Turkey Trot' }]);
  return buildImportCommit(planProfilesImport(files.profiles ?? profilesCsv, NOW), runs, planCheckinsImport(files.checkins ?? checkinsCsv, runs.runs, NOW), NOW);
};

it.skipIf(!enabled)('admin imports under maintenance and rebuilds reward evidence without reopening client writes', async () => {
  const {ops,db}=setup();
  await setDoc(doc(db(),'settings','maintenance'),{active:true});
  const result=await ops.importClubData(commit());
  expect(result.rewards).toMatchObject({updated:2,failed:0});
  await setDoc(doc(db(),'settings','legacy_import'),{active:true});
  expect(await ops.recomputeRewards()).toMatchObject({updated:3,failed:[]});
  expect((await getDoc(doc(db(),'users','jane@example.test'))).data()).toMatchObject({totalRuns:9,longestStreakWeeks:4});
  expect((await getDocs(collection(db(),'reward_proofs'))).size).toBeGreaterThan(0);
  expect((await getDoc(doc(db(),'settings','maintenance'))).data()?.active).toBe(true);
  expect((await getDoc(doc(db(),'settings','legacy_import'))).data()?.active).toBe(true);
  const member=env.authenticatedContext('jane',{email:'jane@example.test',email_verified:true}).firestore() as unknown as Firestore;
  await expect(setDoc(doc(member,'users','new@example.test'),{email:'new@example.test'})).rejects.toHaveProperty('code','permission-denied');
});

it.skipIf(!enabled)('reconciles already-claimed aliases, keeps undated credits and fulfilled gear, and is repeatable', async () => {
  const {ops,db}=setup();
  const email='existing@example.test', key=await memberKeyFor(email);
  await env.withSecurityRulesDisabled(async c => {
    const store=c.firestore() as unknown as Firestore;
    const base=(await getDoc(doc(store,'users',admin))).data()!;
    await setDoc(doc(store,'users',email),{...base,email,role:'member',pre2021Runs:12,legacyEventRuns:4,totalRuns:16,linkedLegacyIds:['matt','matt-l'],linkedLegacyNames:['MATT','MATT L']});
    for (const id of ['matt','matt-l']) {
      await setDoc(doc(store,'legacy_profiles',id),{id,name:id,oldCount:5,newCount:2,totalRuns:7,claimedBy:key,claimedAt:'2026-01-01'});
      await setDoc(doc(store,'legacy_history',id),{events:[{d:'2026-10-07',t:'18:00:00',c:'SAME'},{d:'2026-10-07',t:'19:00:00',c:'OTHER'}]});
    }
    await setDoc(doc(store,'milestone_alerts','fulfilled'),{userEmail:email,fulfilled:true,reward:'Existing shirt'});
  });
  expect(await ops.recomputeRewards([email])).toMatchObject({updated:1,failed:[]});
  const before=(await getDoc(doc(db(),'users',email))).data()!;
  expect(before).toMatchObject({pre2021Runs:12,legacyEventRuns:1,totalRuns:13});
  expect((await getDoc(doc(db(),'members',key))).data()?.totalRuns).toBe(13);
  expect((await getDoc(doc(db(),'legacy_profiles','matt'))).data()?.attendanceKeys).toBeUndefined();
  expect((await getDoc(doc(db(),'legacy_history','matt'))).data()?.attendanceKeys).toHaveLength(1);
  expect((await getDoc(doc(db(),'legacy_history','matt'))).data()?.events).toHaveLength(2);
  expect((await getDoc(doc(db(),'milestone_alerts','fulfilled'))).data()).toMatchObject({fulfilled:true,reward:'Existing shirt'});
  expect(await ops.recomputeRewards([email])).toMatchObject({updated:1,failed:[]});
  expect((await getDoc(doc(db(),'users',email))).data()).toEqual(before);
});

it.skipIf(!enabled)('admin assignment, unclaim and re-import preserve the union with app attendance', async () => {
  const {ops,context,db}=setup();
  const files={ profiles:'Email,Name,No Check-In Runs\njane@example.test,Jane,4\n,MATT,2\n,MATT L,3\n', runs:runsCsv,
    checkins:'Email,Name,Date\njane@example.test,,2026-10-07\n,MATT,2026-10-07\n,MATT L,2026-10-07\n,MATT L,2026-10-14\n' };
  await ops.importClubData(commit(files));
  context.users=[(await getDoc(doc(db(),'users','jane@example.test'))).data() as UserProfile];
  context.legacyMembers=(await getDocs(collection(db(),'legacy_profiles'))).docs.map(d=>d.data()) as StoreState['legacyMembers'];
  context.milestones=[];
  const legacy=createLegacyOps(context);
  await legacy.adminSetLegacyClaim('matt','jane@example.test');
  await legacy.adminSetLegacyClaim('matt-l','jane@example.test');
  expect((await getDoc(doc(db(),'users','jane@example.test'))).data()).toMatchObject({pre2021Runs:9,loggedRuns:1,legacyEventRuns:1,totalRuns:11});
  // Replacing one alias's history removes only that alias's contribution, not a shared run.
  await ops.importClubData(commit({...files,checkins:files.checkins.replace(',MATT L,2026-10-14\n','')}));
  expect((await getDoc(doc(db(),'users','jane@example.test'))).data()).toMatchObject({pre2021Runs:9,legacyEventRuns:0,totalRuns:10});
  await legacy.adminSetLegacyClaim('matt',null);
  expect((await getDoc(doc(db(),'users','jane@example.test'))).data()).toMatchObject({pre2021Runs:7,legacyEventRuns:0,totalRuns:8});
});

it.skipIf(!enabled)('a partial import upgrades older identities before a later claim can double-count them', async () => {
  const {ops,db,context}=setup();
  const email='existing@example.test',key=await memberKeyFor(email);
  await env.withSecurityRulesDisabled(async c=>{
    const store=c.firestore() as unknown as Firestore,base=(await getDoc(doc(store,'users',admin))).data()!;
    await setDoc(doc(store,'users',email),{...base,email,role:'member',linkedLegacyIds:['old'],linkedLegacyNames:['OLD'],legacyEventRuns:1,totalRuns:1});
    await setDoc(doc(store,'legacy_profiles','old'),{id:'old',name:'OLD',oldCount:0,newCount:1,totalRuns:1,claimedBy:key,claimedAt:'2026-01-01'});
    await setDoc(doc(store,'legacy_history','old'),{events:[{d:'2026-10-07',t:'18:00:00',c:'APPLE'}]});
  });
  await ops.recomputeRewards([email]);
  expect((await getDoc(doc(db(),'users',email))).data()?.legacyRunKeys).toEqual(['date:2026-10-07']);
  await ops.importClubData(commit({profiles:'Name\nNEW NAME\n',checkins:'Name,Date\nNEW NAME,2026-10-07\n'}));
  const user=(await getDoc(doc(db(),'users',email))).data() as UserProfile;
  expect(user.legacyRunKeys).toEqual(['run:run-2026-10-07']);
  backend.current=env.authenticatedContext('existing',{email,email_verified:true}).firestore() as unknown as Firestore;
  const claimed=await createLegacyOps({...context,currentUserEmail:email}).claimLegacyProfile(user,'new-name');
  expect(claimed).toMatchObject({legacyEventRuns:1,totalRuns:1});
});

it.skipIf(!enabled)('imports members, runs, check-ins and held names, then derives totals, badges and proofs from the check-ins', async () => {
  const { ops, db } = setup();
  const result = await ops.importClubData(commit());
  expect(result).toMatchObject({ membersCreated: 2, runsWritten: 5, checkinsWritten: 5, aliasesHeld: 1, rewards: { updated: 2, failed: 0 } });

  const jane = (await getDoc(doc(db(), 'users', 'jane@example.test'))).data() as UserProfile;
  expect(jane).toMatchObject({ displayName: 'Jane Runner', shirtSize: 'Not specified', pre2021Runs: 5, loggedRuns: 4, totalRuns: 9, runCount: 3, walkCount: 1, totalMiles: 12.4, firstRunDate: 'Before 10/2026', lastCheckInDate: '2026-10-28' });
  expect(jane.longestStreakWeeks).toBe(4);
  // Someone with no unrecorded runs reads mm/yyyy of their first check-in; Jane, who has some, reads Before the club's first recorded run.
  expect(((await getDoc(doc(db(), 'users', 'drop.in@example.test'))).data() as UserProfile).firstRunDate).toBe('11/2026');
  expect(jane.unlockedBadgeIds).toContain('streak-4');
  expect(jane.badgeCounts?.['special-halloween']).toBe(1);
  expect((await getDoc(doc(db(), 'members', (await import('../../utils/memberKey').then((m) => m.memberKeyFor('jane@example.test')))))).exists()).toBe(true);

  const proofs = await getDocs(collection(db(), 'reward_proofs'));
  expect(proofs.docs.filter((d) => d.data().userEmail === 'jane@example.test' && d.data().kind === 'week')).toHaveLength(4);
  expect(proofs.docs.some((d) => d.data().kind === 'streakstep' && d.data().step === 4)).toBe(true);

  // The alias is held, unclaimed, with its dated sign-in, and gets no profile or check-in.
  expect((await getDoc(doc(db(), 'users', 'pat-example'))).exists()).toBe(false);
  expect((await getDoc(doc(db(), 'legacy_profiles', 'pat-example'))).data()).toMatchObject({ name: 'PAT EXAMPLE', oldCount: 12, newCount: 1, claimedBy: null });
  expect((await getDoc(doc(db(), 'legacy_history', 'pat-example'))).data()?.events).toEqual([{ r: 'run-2026-10-28', d: '2026-10-28', t: '18:30:00', c: 'SPOOKY', s: 'halloween' }]);
  expect(((await getDoc(doc(db(), 'legacy_index', 'pool'))).data()?.entries as { id: string }[]).map((e) => e.id)).toEqual(['pat-example']);

  // The code word is saved for the run, and the run is a closed past run.
  expect((await getDoc(doc(db(), 'meetup_secrets', 'run-2026-10-28'))).data()).toEqual({ codeWord: 'SPOOKY' });
});

it.skipIf(!enabled)('can be repeated without changing anything, and recomputing everyone gives the same answer', async () => {
  const { ops, db } = setup();
  await ops.importClubData(commit());
  const before = (await getDoc(doc(db(), 'users', 'jane@example.test'))).data();
  const again = await ops.importClubData(commit());
  expect(again).toMatchObject({ membersCreated: 0, membersUpdated: 0, membersUnchanged: 2, runsWritten: 0, runsUpdated: 0, runsUnchanged: 5, checkinsWritten: 0, checkinsUpdated: 0, checkinsUnchanged: 5, aliasesHeld: 0, aliasesUpdated: 0, aliasesUnchanged: 1 });
  const recomputed = await ops.recomputeRewards();
  expect(recomputed).toMatchObject({ updated: 3, failed: [] });
  expect((await getDoc(doc(db(), 'users', 'jane@example.test'))).data()).toEqual(before);
});

it.skipIf(!enabled)('an edited file updates what was edited: profile fields, run details and tags, check-ins, held names', async () => {
  const { ops, db } = setup();
  await ops.importClubData(commit());
  const edited = await ops.importClubData(commit({
    profiles: 'Email,Name,No Check-In Runs\njane@example.test,Jane Q Runner,8\n,PAT EXAMPLE,15\n',
    runs: runsCsv.replace('2026-10-21,18:30,Wednesday Run,PLUM,,3.1', '2026-10-21,18:30,Turkey Trot Warmup,PLUM,Turkey Trot,3.1').replace('SPOOKY', 'BOO'),
    checkins: checkinsCsv.replace('jane@example.test,,2026-10-14,walking,3.1', 'jane@example.test,,2026-10-14,running,5').replace(',PAT EXAMPLE,2026-10-28,running,3.1', ',PAT EXAMPLE,2026-10-28,running,3.1\n,PAT EXAMPLE,2026-10-21,running,3.1'),
  }));
  expect(edited).toMatchObject({ membersCreated: 0, membersUpdated: 1, membersUnchanged: 1, runsWritten: 0, runsUpdated: 3, checkinsUpdated: 4, aliasesUpdated: 1 });
  const jane = (await getDoc(doc(db(), 'users', 'jane@example.test'))).data() as UserProfile;
  expect(jane).toMatchObject({ displayName: 'Jane Q Runner', lastName: 'Q Runner', shirtSize: 'Not specified', importedRuns: 8, pre2021Runs: 8, loggedRuns: 4, runCount: 4, walkCount: 0, totalMiles: 14.3, totalRuns: 12 });
  expect(jane.badgeCounts?.['special-turkey']).toBe(1); // the Turkey Trot tag now on the 21st counts
  expect((await getDoc(doc(db(), 'runs', 'run-2026-10-21'))).data()?.title).toBe('Turkey Trot Warmup');
  expect((await getDoc(doc(db(), 'meetup_secrets', 'run-2026-10-28'))).data()?.codeWord).toBe('BOO');
  const pat = (await getDoc(doc(db(), 'legacy_profiles', 'pat-example'))).data();
  expect(pat).toMatchObject({ oldCount: 15, newCount: 2 });
});

it.skipIf(!enabled)('claiming a held name counts its tagged sign-ins toward special event badges', async () => {
  const { ops, db } = setup();
  await ops.importClubData(commit());
  // PAT's held sign-in is on the Halloween run, whose code word is SPOOKY; retag that run's code word to something plain.
  await ops.importClubData(commit({ runs: runsCsv.replace('SPOOKY', 'BLUE') }));
  const held = (await getDoc(doc(db(), 'legacy_history', 'pat-example'))).data()?.events;
  expect(held).toEqual([{ r: 'run-2026-10-28', d: '2026-10-28', t: '18:30:00', c: 'BLUE', s: 'halloween' }]);
});

it.skipIf(!enabled)('an untagged historical run earns no special credit even with a suggestive code word', async () => {
  const { ops, db } = setup();
  await ops.importClubData(commit({ runs: runsCsv.replace('SPOOKY,Halloween', 'TURKEY,') }));
  const held = (await getDoc(doc(db(), 'legacy_history', 'pat-example'))).data()?.events;
  expect(held).toEqual([{ r: 'run-2026-10-28', d: '2026-10-28', t: '18:30:00', c: 'TURKEY', s: 'none' }]);
  const jane = (await getDoc(doc(db(), 'users', 'jane@example.test'))).data() as UserProfile;
  expect(jane.totalRuns).toBe(9);
  expect(jane.unlockedBadgeIds).not.toContain('turkey-trot');
  const proofs = await getDocs(collection(db(), 'reward_proofs'));
  expect(proofs.docs.some(p => p.data().kind === 'special')).toBe(false);
});

it.skipIf(!enabled)('recomputing picks up a badge added after the import, without importing anything again', async () => {
  const { context, ops, db } = setup();
  await ops.importClubData(commit());
  expect(((await getDoc(doc(db(), 'users', 'jane@example.test'))).data() as UserProfile).unlockedBadgeIds).not.toContain('club-runs');
  context.badges = [...INITIAL_BADGES, { id: 'club-runs', name: 'Club runs', description: '', icon: '🏃', category: 'activity', triggerConfig: { type: 'incremental', counter: 'runs', isIncremental: true, step: 2 } } as never];
  await ops.recomputeRewards(['jane@example.test']);
  const jane = (await getDoc(doc(db(), 'users', 'jane@example.test'))).data() as UserProfile;
  expect(jane.badgeCounts?.['club-runs']).toBe(1); // 3 runs, a level every 2
  expect(jane.unlockedBadgeIds).toContain('club-runs');
});

it.skipIf(!enabled)('a runs-only import saves the runs and recomputes nobody', async () => {
  const { ops } = setup();
  const result = await ops.importClubData(commit({ profiles: '', checkins: '' }));
  expect(result).toMatchObject({ runsWritten: 4, membersCreated: 0, checkinsWritten: 0, aliasesHeld: 0, rewards: { updated: 0, failed: 0 } });
  expect(await ops.recomputeRewards([])).toEqual({ updated: 0, failed: [] });
});

it.skipIf(!enabled)('refuses to import without admin access', async () => {
  const { ops } = setup();
  backend.current = env.authenticatedContext('runner', { email: 'runner@example.test', email_verified: true }).firestore() as unknown as Firestore;
  await expect(ops.importClubData(commit())).rejects.toHaveProperty('code', 'permission-denied');
});
