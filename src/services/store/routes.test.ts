import { expect, it, vi } from 'vitest';
import { createRunOps } from './runs';
import type { GPXRoute } from '../../types';

const api = vi.hoisted(() => ({ setDoc: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  ...api, collection: vi.fn(), getDocs: vi.fn(), getDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), writeBatch: vi.fn(), arrayUnion: vi.fn(), arrayRemove: vi.fn(), Timestamp: {},
}));

it('removes cleared route links and old raw GPX instead of merging deleted fields back in', async () => {
  const existing: GPXRoute = { id: 'route', name: 'Route', description: '', distanceMiles: 3.1, elevationGainFt: 0, points: [], surface: 'Pavement', difficulty: 'Easy', createdAt: '', gpxXml: 'old raw GPX', externalLinks: { stravaUrl: 'https://strava.com/old' } };
  const ctx = { routes: [existing], setRoutes: vi.fn() };
  const ops = createRunOps(ctx as unknown as Parameters<typeof createRunOps>[0]);
  await ops.updateRoute('route', { externalLinks: { garminUrl: 'https://connect.garmin.com/new' } });
  expect(api.setDoc.mock.calls[0]).toHaveLength(2);
  expect(api.setDoc.mock.calls[0][1]).not.toHaveProperty('gpxXml');
  expect(api.setDoc.mock.calls[0][1].externalLinks).toEqual({ garminUrl: 'https://connect.garmin.com/new' });
});
