import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, getDocs, collection, type Firestore } from 'firebase/firestore';
import { createCatalogOps } from './catalog';
import { createBadgeOps } from './badges';
import { createMilestoneOps } from './milestones';
import { CLUB_MILESTONES, INITIAL_BADGES, INITIAL_SPECIAL_EVENTS } from '../../data/catalog';
import type { Badge, MilestoneReward, SpecialEventDefinition } from '../../types';

const backend = vi.hoisted(() => ({ current: null as Firestore | null }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, get db() { return backend.current; } }));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let env: RulesTestEnvironment;
beforeAll(async () => { if (enabled) env = await initializeTestEnvironment({ projectId: 'demo-woodchuckers-catalog', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
beforeEach(async () => {
  if (!enabled) return;
  await env.clearFirestore();
  backend.current = env.authenticatedContext('admin', { email: 'woodlandwoodchuckers@gmail.com', email_verified: true }).firestore() as unknown as Firestore;
});
afterAll(async () => { if (enabled) await env.cleanup(); });

/** The catalog as the app holds it: saved documents in state, with the real store operations on top. */
function club() {
  const state = { badges: [] as Badge[], milestones: [] as MilestoneReward[], events: [] as SpecialEventDefinition[], seeded: false };
  const ctx: Record<string, unknown> = {
    get badgeDocs() { return state.badges; }, get milestoneDocs() { return state.milestones; }, get specialEventDocs() { return state.events; },
    get badges() { return state.seeded ? state.badges : [...INITIAL_BADGES.filter((b) => !state.badges.some((x) => x.id === b.id)), ...state.badges]; },
    get milestones() { return state.seeded ? state.milestones : [...CLUB_MILESTONES.filter((m) => !state.milestones.some((x) => x.id === m.id)), ...state.milestones]; },
    get specialEvents() { return state.seeded ? state.events : [...INITIAL_SPECIAL_EVENTS.filter((e) => !state.events.some((x) => x.id === e.id)), ...state.events]; },
    get catalogSeeded() { return state.seeded; },
    setBadges: (u: Badge[] | ((p: Badge[]) => Badge[])) => { state.badges = typeof u === 'function' ? u(state.badges) : u; },
    setMilestones: (u: MilestoneReward[] | ((p: MilestoneReward[]) => MilestoneReward[])) => { state.milestones = typeof u === 'function' ? u(state.milestones) : u; },
    setSpecialEvents: (u: SpecialEventDefinition[] | ((p: SpecialEventDefinition[]) => SpecialEventDefinition[])) => { state.events = typeof u === 'function' ? u(state.events) : u; },
    setCatalogSeeded: (v: boolean) => { state.seeded = v; },
  };
  // The real store builds its operations on every render (so they see the latest state); do the same on every call.
  const fresh = () => {
    const catalog = createCatalogOps(ctx as never);
    Object.assign(ctx, catalog);
    return { ...catalog, ...createBadgeOps(ctx as never), ...createMilestoneOps(ctx as never) };
  };
  const call = <K extends keyof ReturnType<typeof fresh>>(name: K) => ((...args: unknown[]) => (fresh()[name] as (...a: unknown[]) => unknown)(...args)) as ReturnType<typeof fresh>[K];
  return {
    state,
    installStarterCatalog: call('installStarterCatalog'), updateBadge: call('updateBadge'), deleteBadge: call('deleteBadge'),
    updateMilestone: call('updateMilestone'), deleteMilestone: call('deleteMilestone'),
  };
}
const ids = async (name: string) => (await getDocs(collection(backend.current!, name))).docs.map((d) => d.id).sort();

it.skipIf(!enabled)('the starter pack is saved once as plain documents, and edits survive "add back defaults"', async () => {
  const c = club();
  const added = await c.installStarterCatalog();
  expect(added).toBe(INITIAL_BADGES.length + CLUB_MILESTONES.length + INITIAL_SPECIAL_EVENTS.length);
  expect(await ids('badges')).toEqual(INITIAL_BADGES.map((b) => b.id).sort());
  expect(await ids('milestones')).toEqual(CLUB_MILESTONES.map((m) => m.id).sort());
  expect((await getDoc(doc(backend.current!, 'settings', 'catalog'))).data()).toMatchObject({ seeded: true });
  expect((await getDoc(doc(backend.current!, 'milestones', 'milestone-5'))).data()).not.toHaveProperty('isDefault'); // nothing is "built in"

  await c.updateMilestone('milestone-5', { name: 'Club Shirt', target: 5, icon: '👕', description: 'Edited', gear: 'Blue Shirt', perks: '' });
  await c.deleteBadge('power-walker');
  expect((await getDoc(doc(backend.current!, 'badges', 'power-walker'))).exists()).toBe(false);
  // Adding back defaults restores only what was deleted, and leaves the edited shirt alone.
  expect(await c.installStarterCatalog()).toBe(1);
  expect((await getDoc(doc(backend.current!, 'badges', 'power-walker'))).exists()).toBe(true);
  expect((await getDoc(doc(backend.current!, 'milestones', 'milestone-5'))).data()).toMatchObject({ name: 'Club Shirt', reward: 'Blue Shirt' });
});

it.skipIf(!enabled)('any milestone or badge can be edited or deleted, including starter ones (and a special-event badge takes its event with it)', async () => {
  const c = club();
  await c.installStarterCatalog();
  // Edit a starter badge (name + emoji), keeping its rule.
  const walker = c.state.badges.find((b) => b.id === 'power-walker')!;
  await c.updateBadge('power-walker', { name: 'Trail Strider', emoji: '🥾', description: 'd', requirement: 'r', category: walker.category!, isIncremental: true, triggerConfig: { ...walker.triggerConfig!, step: 20 } });
  expect((await getDoc(doc(backend.current!, 'badges', 'power-walker'))).data()).toMatchObject({ name: 'Trail Strider', emoji: '🥾', triggerConfig: { step: 20 } });
  // Re-target a starter milestone: its id follows the new target.
  await c.updateMilestone('milestone-50', { name: '60 Runs', target: 60, icon: '🧢', description: '', gear: 'Hat', perks: '' });
  expect((await getDoc(doc(backend.current!, 'milestones', 'milestone-50'))).exists()).toBe(false);
  expect((await getDoc(doc(backend.current!, 'milestones', 'milestone-60'))).data()).toMatchObject({ runsRequired: 60, name: '60 Runs' });
  // Delete a starter milestone and a starter special-event badge (and its event option).
  await c.deleteMilestone('milestone-100');
  expect(await ids('milestones')).not.toContain('milestone-100');
  await c.deleteBadge('special-turkey');
  expect(await ids('badges')).not.toContain('special-turkey');
  expect(await ids('special_events')).not.toContain('turkey_trot');
});
