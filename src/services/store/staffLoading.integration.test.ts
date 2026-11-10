import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { createStaffLoadingOps, newStaffPage, resetStaffPages } from './staffLoading';
import type { StoreState } from './state';
import type { MilestoneAlert, UserProfile } from '../../types';
const backend = vi.hoisted(() => ({ current: null as Firestore | null }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, get db() { return backend.current; } }));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const email = 'staff@example.test';
let env: RulesTestEnvironment;
beforeAll(async () => { if (enabled) env = await initializeTestEnvironment({ projectId: 'demo-woodchuckers-staff-pages', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => {
  if (!enabled) return;
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore() as unknown as Firestore, 'users', email), { email, displayName: 'Staff', role: 'admin' }));
  backend.current = env.authenticatedContext('staff', { email, email_verified: true }).firestore() as unknown as Firestore;
});
afterAll(async () => { if (enabled) await env.cleanup(); });
const owner = { email, displayName: 'Staff', role: 'admin' } as UserProfile;
function state() {
  const rows = { users: [owner], alerts: [] as MilestoneAlert[], moreUsers: true, moreGear: true, rosterError: null as string | null };
  const context = {
    staffSearchCache: { current: { expires: 0 } },
    currentUser: owner, users: rows.users, privateSyncEpoch: { current: 1 },
    staffRosterPage: { current: newStaffPage() }, gearHistoryPage: { current: newStaffPage() },
    setUsers: (update: UserProfile[] | ((previous: UserProfile[]) => UserProfile[])) => { rows.users = typeof update === 'function' ? update(rows.users) : update; },
    setMilestoneAlerts: (update: MilestoneAlert[] | ((previous: MilestoneAlert[]) => MilestoneAlert[])) => { rows.alerts = typeof update === 'function' ? update(rows.alerts) : update; },
    setStaffRosterLoading: vi.fn(), setGearHistoryLoading: vi.fn(), setGearHistoryError: vi.fn(),
    setStaffRosterError: (value: string | null) => { rows.rosterError = value; },
    setHasMoreStaffUsers: (value: boolean) => { rows.moreUsers = value; }, setHasMoreGearHistory: (value: boolean) => { rows.moreGear = value; },
  } as unknown as StoreState;
  return { context, rows, ops: createStaffLoadingOps(context) };
}
it.skipIf(!enabled)('pages staff profiles without duplicates, resolves an unloaded exact email and exports the complete roster separately', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await Promise.all(Array.from({ length: 125 }, (_, n) => {
      const address = `runner-${String(n).padStart(3, '0')}@example.test`;
      return setDoc(doc(db, 'users', address), { email: address, displayName: `Runner ${n}`, role: 'member' });
    }));
  });
  const { context, rows, ops } = state();
  await Promise.all([ops.loadMoreStaffUsers(), ops.loadMoreStaffUsers()]);
  expect(rows.users).toHaveLength(51); // First 50 plus the signed-in profile.
  expect(rows.moreUsers).toBe(true);
  const found = await ops.findStaffUser('  RUNNER-124@EXAMPLE.TEST ');
  expect(found?.displayName).toBe('Runner 124');
  const exported = await ops.exportStaffUsers();
  expect(exported).toHaveLength(126);
  expect(rows.users).toHaveLength(52); // Export must not fill the interactive roster.
  await ops.loadMoreStaffUsers(); await ops.loadMoreStaffUsers();
  expect(rows.moreUsers).toBe(false);
  expect(rows.users).toHaveLength(126);
  expect(new Set(rows.users.map((user) => user.email)).size).toBe(126);
  expect(context.staffRosterPage.current.complete).toBe(true);
});
it.skipIf(!enabled)('pages only fulfilled history and preserves live pending gear during page loads and refresh', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await Promise.all(Array.from({ length: 123 }, (_, n) => setDoc(doc(db, 'milestone_alerts', `gear-${String(n).padStart(3, '0')}`), { fulfilled: true, userEmail: 'runner@example.test' })));
    await setDoc(doc(db, 'milestone_alerts', 'pending'), { fulfilled: false, userEmail: 'runner@example.test' });
  });
  const { rows, ops } = state();
  rows.alerts.push({ id: 'pending', fulfilled: false } as MilestoneAlert);
  await ops.loadMoreGearHistory(); expect(rows.alerts).toHaveLength(51);
  await ops.loadMoreGearHistory(); await ops.loadMoreGearHistory();
  expect(rows.alerts).toHaveLength(124); expect(rows.moreGear).toBe(false);
  await ops.refreshGearHistory();
  expect(rows.alerts).toHaveLength(51);
  expect(rows.alerts.filter((alert) => !alert.fulfilled)).toEqual([{ id: 'pending', fulfilled: false }]);
});
it.skipIf(!enabled)('does not publish private pages or return an export after session cleanup', async () => {
  const { context, rows, ops } = state();
  const pending = ops.loadMoreStaffUsers();
  context.privateSyncEpoch.current++; resetStaffPages(context); rows.users = [];
  await pending;
  expect(rows.users).toEqual([]);
  expect(context.staffRosterPage.current.cursor).toBeUndefined();
  const exporting = ops.exportStaffUsers();
  context.privateSyncEpoch.current++;
  await expect(exporting).rejects.toThrow('session changed');
});
it.skipIf(!enabled)('retains the cursor on permission failure and permits retry once staff access is restored', async () => {
  const { context, rows, ops } = state();
  backend.current = env.authenticatedContext('nonstaff', { email: 'not-staff@example.test', email_verified: true }).firestore() as unknown as Firestore;
  await expect(ops.loadMoreStaffUsers()).rejects.toHaveProperty('code', 'permission-denied');
  expect(context.staffRosterPage.current.cursor).toBeUndefined();
  expect(context.staffRosterPage.current.pending).toBe(false); expect(rows.rosterError).toContain('retry');
  backend.current = env.authenticatedContext('staff', { email, email_verified: true }).firestore() as unknown as Firestore;
  await ops.loadMoreStaffUsers();
  expect(rows.rosterError).toBeNull(); expect(rows.moreUsers).toBe(false);
  const retained = { email: 'already-loaded@example.test', displayName: 'Retained', role: 'member' } as UserProfile;
  rows.users.push(retained);
  backend.current = env.authenticatedContext('nonstaff', { email: 'not-staff@example.test', email_verified: true }).firestore() as unknown as Firestore;
  await expect(ops.refreshStaffUsers()).rejects.toHaveProperty('code', 'permission-denied');
  expect(rows.users).not.toContain(retained); // Revoked access clears other runners' private rows.
});

it.skipIf(!enabled)('searches names and partial emails beyond the first roster page and pages all matches using a shared cache', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await Promise.all(Array.from({ length: 125 }, (_, n) => {
      const address = `runner-${String(n).padStart(3, '0')}@example.test`;
      return setDoc(doc(db, 'users', address), { email: address, displayName: n === 124 ? 'Jánë Smith Runner' : `Runner ${n}`, role: n === 124 ? 'organizer' : 'member' });
    }));
  });
  const { context, rows, ops } = state();
  await ops.loadMoreStaffUsers();
  expect(rows.users.some((user) => user.email === 'runner-124@example.test')).toBe(false);
  const first = ops.searchStaffUsers('SMITH jane');
  const pending = context.staffSearchCache.current.pending;
  const second = ops.searchStaffUsers('124@example');
  expect(context.staffSearchCache.current.pending).toBe(pending);
  const [byName, byEmail] = await Promise.all([first, second]);
  expect(byName.users.map((user) => user.email)).toEqual(['runner-124@example.test']);
  expect(byEmail.users.map((user) => user.email)).toEqual(['runner-124@example.test']);
  expect(context.staffSearchCache.current.rows).toHaveLength(126);
  const cache = context.staffSearchCache.current.rows;
  const pages = await Promise.all([ops.searchStaffUsers('runner', 'all', 0), ops.searchStaffUsers('runner', 'all', 50), ops.searchStaffUsers('runner', 'all', 100)]);
  expect(pages.map((page) => page.users.length)).toEqual([50, 50, 25]);
  expect(new Set(pages.flatMap((page) => page.users.map((user) => user.email))).size).toBe(125);
  expect(pages[2].hasMore).toBe(false);
  expect((await ops.searchStaffUsers('runner', 'organizer')).total).toBe(1);
  expect(context.staffSearchCache.current.rows).toBe(cache);
  context.staffSearchCache.current.expires = 0;
  await ops.searchStaffUsers('Smith');
  expect(context.staffSearchCache.current.rows).not.toBe(cache);
});
it.skipIf(!enabled)('discards a search scan and its private cache after session cleanup', async () => {
  const { context, ops, rows } = state();
  const searching = ops.searchStaffUsers('Staff');
  context.privateSyncEpoch.current++; resetStaffPages(context); rows.users = [];
  await expect(searching).rejects.toThrow('session changed');
  expect(context.staffSearchCache.current.rows).toBeUndefined();
  expect(rows.users).toEqual([]);
});
