import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { historicalRunKeys } from '../../utils/attendanceIdentity';
import { memberKeyFor } from '../../utils/memberKey';
import { toPublicMember } from './helpers';
import { createLegacyOps } from './legacy';
import type { StoreState } from './state';
import type { MilestoneAlert, MilestoneReward, UserProfile } from '../../types';

const backend = vi.hoisted(() => ({ current: null as Firestore | null, failGearAfter: -1 }));
vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return { ...actual, runTransaction: (db: Firestore, work: Parameters<typeof actual.runTransaction>[1]) => actual.runTransaction(db, tx => work(new Proxy(tx, {
    get(target, key) {
      if (key === 'set') return (ref: Parameters<typeof tx.set>[0], data: Parameters<typeof tx.set>[1]) => {
        if (ref.parent.id === 'milestone_alerts' && backend.failGearAfter >= 0) {
          if (backend.failGearAfter-- === 0) throw new Error('Simulated interrupted merchandise write');
        }
        return target.set(ref, data);
      };
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }))) };
});
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, get db() { return backend.current; } }));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const email = 'runner@example.test';
let env: RulesTestEnvironment;
const runner: UserProfile = { email, firstName: 'Run', lastName: 'Ner', displayName: 'Run Ner', shirtSize: 'M', pre2021Runs: 0, loggedRuns: 0, totalRuns: 0, totalMiles: 0, runCount: 0, walkCount: 0, linkedLegacyNames: [], unlockedBadgeIds: [], role: 'member', createdAt: '2026-01-01T00:00:00.000Z' };
const milestone = (runs: number): MilestoneReward => ({ id: `milestone-${runs}`, runsRequired: runs, name: `M${runs}`, reward: `Reward ${runs}`, icon: '🏅' } as MilestoneReward);
const day = (n: number) => `2022-${String(Math.floor(n / 28) + 1).padStart(2, '0')}-${String((n % 28) + 1).padStart(2, '0')}`;
const events = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ d: day(from + i), t: '18:00:00', c: 'WORD' }));

beforeAll(async () => { if (enabled) env = await initializeTestEnvironment({ projectId: 'demo-woodchuckers-claim-gear', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
afterAll(async () => { if (enabled) await env.cleanup(); });
beforeEach(async () => {
  if (!enabled) return;
  await env.clearFirestore();
  backend.failGearAfter = -1;
  backend.current = env.authenticatedContext('runner', { email, email_verified: true }).firestore() as unknown as Firestore;
});

async function seed(profiles: { id: string; oldCount: number; events: { d: string; t: string; c: string }[] }[]) {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', email), runner);
    for (const p of profiles) {
      await setDoc(doc(db, 'legacy_profiles', p.id), { id: p.id, name: p.id.toUpperCase(), oldCount: p.oldCount, newCount: p.events.length, attendanceReady: true, totalRuns: p.oldCount + p.events.length, claimedBy: null, claimedAt: null });
      await setDoc(doc(db, 'legacy_history', p.id), { id: p.id, events: p.events, attendanceKeys: historicalRunKeys(p.events) });
    }
  });
}
function ops(overrides: Partial<StoreState> = {}) {
  const rows = { alerts: [] as MilestoneAlert[] };
  const context = {
    milestones: [milestone(5), milestone(25), milestone(50), milestone(100)], milestoneAlerts: rows.alerts, legacyPool: [], legacyMembers: [], users: [], badges: [],
    privateSessionEpoch: { current: 1 }, privateSyncEpoch: { current: 1 }, meetupEvents: [], checkins: [],
    currentUserEmail: email,
    setUsers: vi.fn(), setMembers: vi.fn(), setLegacyMembers: vi.fn(), setOwnLegacyEvents: vi.fn(), setMeetupEvents: vi.fn(),
    setMilestoneAlerts: (u: MilestoneAlert[] | ((p: MilestoneAlert[]) => MilestoneAlert[])) => { rows.alerts = typeof u === 'function' ? u(rows.alerts) : u; },
    ...overrides,
  } as unknown as StoreState;
  return { rows, ops: createLegacyOps(context) };
}
// Read as the club's own server would: a runner cannot list the gear queue.
const alertDocs = async () => {
  let found: { id: string; [key: string]: unknown }[] = [];
  await env.withSecurityRulesDisabled(async (c) => { found = (await getDocs(collection(c.firestore() as unknown as Firestore, 'milestone_alerts'))).docs.map((d) => ({ id: d.id, ...d.data() })); });
  return found;
};
const alertIds = async () => (await alertDocs()).map((d) => d.id).sort();

it.skipIf(!enabled)('retries partial merchandise delivery after reload and preserves an already fulfilled item', async () => {
  await seed([{id:'main',oldCount:20,events:events(0,10)},{id:'other',oldCount:0,events:[...events(0,5),...events(100,20)]}]);
  const catalog=[milestone(31),milestone(32),milestone(33)];
  const {ops:o}=ops({milestones:catalog});
  const first=await o.claimLegacyProfile(runner,'main');
  backend.failGearAfter=1;
  const interrupted=await o.claimLegacyProfile(first,'other');
  expect(interrupted).toMatchObject({totalRuns:50,claimGearPending:true});
  expect(await alertIds()).toEqual([`m31_${email}`]);
  await env.withSecurityRulesDisabled(async c=>updateDoc(doc(c.firestore() as unknown as Firestore,'milestone_alerts',`m31_${email}`),{fulfilled:true,fulfilledBy:'staff'}));
  backend.failGearAfter=-1;
  const reloaded=ops({milestones:catalog}).ops;
  const complete=await reloaded.retryClaimGear(interrupted);
  expect(complete.claimGearPending).toBe(false);
  expect(await alertIds()).toEqual([`m31_${email}`,`m32_${email}`,`m33_${email}`]);
  expect((await alertDocs()).find(a=>a.id===`m31_${email}`)).toMatchObject({fulfilled:true,fulfilledBy:'staff'});
  await reloaded.claimLegacyProfile(complete,'other');
  expect(await alertIds()).toHaveLength(3);
});

it.skipIf(!enabled)('resumes a reserved claim after interruption without adding credits twice and keeps history private', async () => {
  const e={d:'2026-11-11',t:'18:00:00',c:'VETERAN'};
  await seed([{id:'matt',oldCount:5,events:[e,{...e,t:'19:00:00'}]}]);
  const other=env.authenticatedContext('other',{email:'other@example.test',email_verified:true}).firestore() as unknown as Firestore;
  await expect(getDoc(doc(other,'legacy_history','matt'))).rejects.toHaveProperty('code','permission-denied');
  const pending={...runner,pre2021Runs:5,legacyEventRuns:2,totalRuns:7,linkedLegacyIds:['matt'],linkedLegacyNames:['MATT'],pendingLegacyClaim:'matt'};
  await env.withSecurityRulesDisabled(async c => {
    const store=c.firestore() as unknown as Firestore;
    await setDoc(doc(store,'users',email),pending);
    await updateDoc(doc(store,'legacy_profiles','matt'),{claimedBy:await memberKeyFor(email),claimedAt:'2026-11-11'});
  });
  const {ops:o}=ops();
  await expect(setDoc(doc(backend.current!,'members',await memberKeyFor(email)),toPublicMember(pending,await memberKeyFor(email)))).rejects.toHaveProperty('code','permission-denied');
  const completed=await o.claimLegacyProfile(pending,'matt');
  expect(completed).toMatchObject({pre2021Runs:5,legacyEventRuns:1,totalRuns:6});
  expect(completed.pendingLegacyClaim).toBeUndefined();
  expect(await o.claimLegacyProfile(completed,'matt')).toEqual(completed);
  expect((await getDoc(doc(backend.current!,'legacy_profiles','matt'))).data()?.attendanceKeys).toBeUndefined();
  await expect(getDoc(doc(other,'legacy_history','matt'))).rejects.toHaveProperty('code','permission-denied');
});

it.skipIf(!enabled)('special-event proofs cannot count the same canonical run under two claimed names', async () => {
  const e={d:'2024-11-27',t:'18:00:00',c:'TURKEY',r:'turkey-2024',s:'turkey_trot'};
  await seed([{id:'matt',oldCount:0,events:[e]},{id:'matt-l',oldCount:0,events:[{...e,t:'19:00:00'}]}]);
  const {ops:o}=ops();
  const first=await o.claimLegacyProfile(runner,'matt');
  const second=await o.claimLegacyProfile(first,'matt-l');
  await o.refreshDerivedStats(second);
  const ref=doc(backend.current!,'reward_proofs',`${email}_0_special_turkey_trot`);
  const proof=(await getDoc(ref)).data()!;
  expect(proof).toMatchObject({count:1,sources:['run:turkey-2024']});
  await expect(updateDoc(ref,{count:2,sources:[...proof.sources,'run:turkey-2024'],sourceId:'run:turkey-2024',source:{legacyId:'matt-l',event:{...e,t:'19:00:00'}}})).rejects.toHaveProperty('code','permission-denied');
});

it.skipIf(!enabled)('claims the union of shared runs, preserves undated credits and rejects forged attendance keys', async () => {
  const shared = { d:'2026-11-11',t:'18:00:00',c:'VETERAN' };
  await seed([{id:'matt',oldCount:7,events:[shared]},{id:'matt-l',oldCount:3,events:[{...shared,t:'19:00:00'},{...shared,c:'OTHER'},{...shared,d:'2026-11-18'}]}]);
  const {ops:o}=ops();
  const first = await o.claimLegacyProfile(runner,'matt');
  const second = await o.claimLegacyProfile(first,'matt-l');
  expect(second).toMatchObject({ pre2021Runs:10,legacyEventRuns:2,totalRuns:12 });
  expect((await getDoc(doc(backend.current!,'users',email))).data()?.legacyRunKeys).toHaveLength(2);
  expect(await o.claimLegacyProfile(second,'matt-l')).toEqual(second);
  await expect(updateDoc(doc(backend.current!,'users',email),{legacyRunKeys:[],legacyEventRuns:0,totalRuns:10})).rejects.toHaveProperty('code','permission-denied');
  await expect(updateDoc(doc(backend.current!,'users',email),{appRunKeys:['event:2026-11-11:OTHER']})).rejects.toHaveProperty('code','permission-denied');
});

it.skipIf(!enabled)('claiming one name owes no gear; claiming a second owes only the milestones its new runs cross', async () => {
  // Main name: 20 undated + 10 dated = 30 runs. Second: 25 dated, 5 on days the first already has, so 20 add.
  await seed([{ id: 'main', oldCount: 20, events: events(0, 10) }, { id: 'other', oldCount: 0, events: [...events(0, 5), ...events(100, 20)] }]);
  const { ops: o, rows } = ops();
  const afterFirst = await o.claimLegacyProfile(runner, 'main');
  expect(await alertIds()).toEqual([]);
  await o.claimLegacyProfile(afterFirst, 'other');
  expect(await alertIds()).toEqual([`m50_${email}`]); // 30 -> 50: 50 is reached; 25 is not crossed
  expect(rows.alerts.map((a) => a.id)).toEqual([`m50_${email}`]);
  const [alert] = await alertDocs();
  expect(alert).toMatchObject({ fulfilled: false, milestoneRuns: 50, userEmail: email, reward: 'Reward 50' });
});

it.skipIf(!enabled)('runs a second name signed in to on the same days adds nothing, so no gear is owed', async () => {
  await seed([{ id: 'main', oldCount: 20, events: events(0, 29) }, { id: 'double', oldCount: 0, events: events(0, 29) }]);
  const { ops: o } = ops();
  const first = await o.claimLegacyProfile(runner, 'main');
  await o.claimLegacyProfile(first, 'double');
  expect(await alertIds()).toEqual([]);
});
