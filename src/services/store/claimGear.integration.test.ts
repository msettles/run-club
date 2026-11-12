import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collection, doc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { createLegacyOps } from './legacy';
import type { StoreState } from './state';
import type { MilestoneAlert, MilestoneReward, UserProfile } from '../../types';

const backend = vi.hoisted(() => ({ current: null as Firestore | null }));
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
  backend.current = env.authenticatedContext('runner', { email, email_verified: true }).firestore() as unknown as Firestore;
});

async function seed(profiles: { id: string; oldCount: number; events: { d: string; t: string; c: string }[] }[]) {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'users', email), runner);
    for (const p of profiles) {
      await setDoc(doc(db, 'legacy_profiles', p.id), { id: p.id, name: p.id.toUpperCase(), oldCount: p.oldCount, newCount: p.events.length, totalRuns: p.oldCount + p.events.length, claimedBy: null, claimedAt: null });
      await setDoc(doc(db, 'legacy_history', p.id), { id: p.id, events: p.events });
    }
  });
}
function ops() {
  const rows = { alerts: [] as MilestoneAlert[] };
  const context = {
    milestones: [milestone(5), milestone(25), milestone(50), milestone(100)], milestoneAlerts: rows.alerts, legacyPool: [], legacyMembers: [], users: [], badges: [],
    privateSessionEpoch: { current: 1 }, privateSyncEpoch: { current: 1 }, meetupEvents: [], checkins: [],
    setUsers: vi.fn(), setMembers: vi.fn(), setLegacyMembers: vi.fn(), setOwnLegacyEvents: vi.fn(), setMeetupEvents: vi.fn(),
    setMilestoneAlerts: (u: MilestoneAlert[] | ((p: MilestoneAlert[]) => MilestoneAlert[])) => { rows.alerts = typeof u === 'function' ? u(rows.alerts) : u; },
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
