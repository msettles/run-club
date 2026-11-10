import { beforeEach, expect, it, vi } from 'vitest';
import { createRunOps } from './runs';
import type { GPXRoute } from '../../types';

const api = vi.hoisted(() => ({ saved: undefined as Record<string, unknown> | undefined, set: vi.fn() }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  runTransaction: async (_db: unknown, callback: (tx: unknown) => unknown) => callback({ get: async () => ({ exists: () => Boolean(api.saved), data: () => api.saved }), set: api.set }),
  setDoc: vi.fn(), collection: vi.fn(), getDocs: vi.fn().mockResolvedValue({ docs: [] }), getDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), writeBatch: vi.fn(), arrayUnion: vi.fn(), arrayRemove: vi.fn(), Timestamp: {},
}));

const existing: GPXRoute = { id: 'route', name: 'Route', description: '', distanceMiles: 3.1, elevationGainFt: 0, points: [], surface: 'Pavement', difficulty: 'Easy', createdAt: '2026-01-01T00:00:00.000Z', gpxXml: 'old raw GPX', externalLinks: { stravaUrl: 'https://strava.com/old' } };
function operations(runs: unknown[] = []) {
  const ctx = { routes: [existing], runs, setRoutes: vi.fn() };
  return { ctx, ops: createRunOps(ctx as unknown as Parameters<typeof createRunOps>[0]) };
}
beforeEach(() => { api.set.mockClear(); api.saved = { ...existing }; });

it('removes cleared route links and old raw GPX instead of merging deleted fields back in', async () => {
  await operations().ops.updateRoute('route', { externalLinks: { garminUrl: 'https://connect.garmin.com/new' } });
  expect(api.set.mock.calls[0]).toHaveLength(2);
  expect(api.set.mock.calls[0][1]).not.toHaveProperty('gpxXml');
  expect(api.set.mock.calls[0][1].externalLinks).toEqual({ garminUrl: 'https://connect.garmin.com/new' });
});

it('edits a route no run has used in place, keeping its ID and creation date', async () => {
  const { ctx, ops } = operations();
  const saved = await ops.updateRoute('route', { name: 'Renamed' });
  expect(saved).toMatchObject({ id: 'route', name: 'Renamed', createdAt: existing.createdAt, referenced: false });
  expect(api.set).toHaveBeenCalledWith('routes/route', expect.objectContaining({ name: 'Renamed' }));
  const update = ctx.setRoutes.mock.calls[0][0] as (previous: GPXRoute[]) => GPXRoute[];
  expect(update([existing]).map((route) => route.name)).toEqual(['Renamed']);
});

it('saves a new version when the saved route is marked as used, or a loaded run uses it', async () => {
  api.saved = { ...existing, referenced: true };
  const marked = await operations().ops.updateRoute('route', { name: 'Renamed' });
  expect(marked.id).not.toBe('route');
  expect(api.set).toHaveBeenLastCalledWith(`routes/${marked.id}`, expect.objectContaining({ name: 'Renamed', referenced: false }));
  api.saved = { ...existing };
  const { ctx, ops } = operations([{ id: 'run', routeChoices: [{ routeId: 'route' }] }]);
  const inUse = await ops.updateRoute('route', { name: 'Renamed' });
  expect(inUse.id).not.toBe('route');
  const update = ctx.setRoutes.mock.calls[0][0] as (previous: GPXRoute[]) => GPXRoute[];
  expect(update([existing])).toHaveLength(2);
});
