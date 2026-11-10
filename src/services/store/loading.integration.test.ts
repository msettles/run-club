import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collection, doc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { createRouteCatalogClient, RouteDetailsCache } from '../routeCatalog';
import { createScheduleLoadingOps } from './scheduleLoading';
import { fetchFullRoute } from './routeLoading';
import { createLegacyOps } from './legacy';
import { clubYmd } from '../../utils/dateUtils';
import type { MeetupEvent, RunEvent } from '../../types';

const backend = vi.hoisted(() => ({ current: null as Firestore | null }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, get db() { return backend.current; } }));
const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const project = 'demo-woodchuckers-loading';
const email = 'loading@example.com';
const today = clubYmd();
const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
let env: RulesTestEnvironment;
beforeAll(async () => {
  if (enabled) env = await initializeTestEnvironment({ projectId: project, firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  if (!enabled) return;
  await env.clearFirestore();
  backend.current = env.authenticatedContext('runner', { email, email_verified: true }).firestore() as unknown as Firestore;
});
afterAll(async () => { if (enabled) await env.cleanup(); });

it.skipIf(!enabled)('pages real masked route metadata without downloading track geometry, then loads one requested map', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await Promise.all(Array.from({ length: 25 }, (_, index) => {
      const id = `route-${String(index).padStart(3, '0')}`;
      return setDoc(doc(db, 'routes', id), { id, name: id, description: 'Public route', distanceMiles: 3.1, surface: 'Pavement', difficulty: 'Easy', elevationGainFt: 0, createdAt: new Date().toISOString(),
        points: Array.from({ length: 5000 }, (_, n) => ({ lat: 38 + n / 100000, lon: -121 })), directions: JSON.stringify(Array.from({ length: 100 }, () => ({ instruction: 'Continue along the route' }))) });
    }));
  });
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${project}/databases/(default)/documents`;
  let bytes = 0;
  const fetcher: typeof fetch = async (...args) => { const response = await fetch(...args); bytes += new TextEncoder().encode(await response.clone().text()).length; return response; };
  const catalog = createRouteCatalogClient(base, fetcher);
  const first = await catalog.page();
  expect(first.routes).toHaveLength(20);
  expect(first.routes.every((route) => route.detailsLoaded === false && route.points.length === 0 && !route.directions?.length)).toBe(true);
  const next = await catalog.page(first.nextPageToken);
  expect(next.routes).toHaveLength(5);
  expect(new Set([...first.routes, ...next.routes].map((route) => route.id)).size).toBe(25);
  expect(bytes).toBeLessThan(30_000);
  const loader = vi.fn(fetchFullRoute);
  const cache = new RouteDetailsCache(loader);
  expect(loader).not.toHaveBeenCalled();
  const [a, b] = await Promise.all([cache.load(first.routes[0].id), cache.load(first.routes[0].id)]);
  expect(a.points).toHaveLength(5000); expect(a).toBe(b); expect(loader).toHaveBeenCalledOnce();
});

it.skipIf(!enabled)('paginates tied historical dates without losing the lookahead row or reading future runs', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await Promise.all(Array.from({ length: 45 }, async (_, index) => {
      const id = `run-${String(index).padStart(3, '0')}`;
      await setDoc(doc(db, 'runs', id), { id, date: yesterday, title: id });
      await setDoc(doc(db, 'meetup_events', id), { id, date: yesterday, title: id, codeWordSet: true });
    }));
    await setDoc(doc(db, 'runs', 'future'), { id: 'future', date: today, title: 'Future' });
  });
  let rows = [{ id: 'future', date: today }] as RunEvent[];
  let meetups: MeetupEvent[] = [];
  let more = true;
  const context = { priorRunsCursor: { current: undefined }, priorRunsPending: { current: false }, priorRunsComplete: { current: false }, staffCodeWords: { current: {} },
    setPriorRunsLoading: vi.fn(), setPriorRunsError: vi.fn(), setPriorRunsLoaded: vi.fn(), setHasMorePriorRuns: (value: boolean) => { more = value; },
    setRuns: (update: (previous: RunEvent[]) => RunEvent[]) => { rows = update(rows); },
    setMeetupEvents: (update: (previous: MeetupEvent[]) => MeetupEvent[]) => { meetups = update(meetups); } };
  const ops = createScheduleLoadingOps(context as unknown as Parameters<typeof createScheduleLoadingOps>[0]);
  await Promise.all([ops.loadPriorRuns(), ops.loadPriorRuns()]);
  expect(rows).toHaveLength(21); expect(more).toBe(true);
  await ops.loadPriorRuns(); expect(rows).toHaveLength(41); expect(more).toBe(true);
  await ops.loadPriorRuns(); expect(rows).toHaveLength(46); expect(more).toBe(false);
  expect(new Set(rows.map((run) => run.id)).size).toBe(46);
  expect(meetups).toHaveLength(45);
  expect(rows.some((run) => run.id === 'run-000')).toBe(true);
});

it.skipIf(!enabled)('resolves only missing legacy meetup metadata so paged history preserves reward eligibility', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, 'meetup_events', 'old-run'), { id: 'old-run', title: 'Turkey Run', date: yesterday, specialEvent: 'turkey_trot' });
    await setDoc(doc(db, 'checkins', `old-run_${email}`), { id: `old-run_${email}`, runId: 'old-run', date: yesterday, userEmail: email, codeWord: 'ACORN' });
  });
  let loaded: MeetupEvent[] = [];
  const context = { meetupEvents: [], checkins: [], staffCodeWords: { current: {} },
    setMeetupEvents: (update: (previous: MeetupEvent[]) => MeetupEvent[]) => { loaded = update(loaded); } };
  const records = await createLegacyOps(context as unknown as Parameters<typeof createLegacyOps>[0]).fetchRunnerCheckins(email);
  expect(records[0]).toMatchObject({ eventTitle: 'Turkey Run', eventSpecial: 'turkey_trot' });
  expect(loaded).toHaveLength(1);
  expect((await getDocs(collection(backend.current!, 'meetup_events'))).size).toBe(1);
});
