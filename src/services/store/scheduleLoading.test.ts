import { beforeEach, expect, it, vi } from 'vitest';
import { createScheduleLoadingOps, subscribeSchedule } from './scheduleLoading';

const api = vi.hoisted(() => ({ getDocs: vi.fn(), onSnapshot: vi.fn() }));
vi.mock('../firebase', () => ({ db: {}, isFirebaseConfigured: true }));
vi.mock('firebase/firestore', () => ({
  ...api, collection: (_db: unknown, name: string) => name, documentId: () => '__name__',
  query: (collection: string, ...constraints: unknown[]) => ({ collection, constraints }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  orderBy: (field: string, direction: string) => ({ orderBy: field, direction }),
  limit: (count: number) => ({ limit: count }), startAfter: (doc: unknown) => ({ startAfter: doc }),
}));
beforeEach(() => { vi.clearAllMocks(); api.onSnapshot.mockReturnValue(vi.fn()); });
function subscriptionContext() {
  return { upcomingRunLimit: 20, setScheduleDataLoaded: vi.fn(), setScheduleError: vi.fn(), setHasMoreUpcomingRuns: vi.fn(),
    setRuns: vi.fn(), setMeetupEvents: vi.fn(), staffCodeWords: { current: {} } };
}
it('does not consume QR readiness on an empty cache before the server answers', () => {
  const ctx = subscriptionContext();
  const stop = subscribeSchedule(ctx, '2026-11-09');
  const next = api.onSnapshot.mock.calls[0][2];
  next({ metadata: { fromCache: true }, empty: true, docs: [], size: 0 });
  expect(ctx.setScheduleDataLoaded).not.toHaveBeenCalledWith(true);
  next({ metadata: { fromCache: false }, empty: true, docs: [], size: 0 });
  expect(ctx.setScheduleDataLoaded).toHaveBeenLastCalledWith(true);
  ctx.setRuns.mockClear(); stop();
  next({ metadata: { fromCache: false }, empty: true, docs: [], size: 0 });
  expect(ctx.setRuns).not.toHaveBeenCalled();
});
it('keeps meetup subscriptions stable when only RSVP data changes', () => {
  const ctx = subscriptionContext(); subscribeSchedule(ctx, '2026-11-09');
  const next = api.onSnapshot.mock.calls[0][2];
  const snapshot = { metadata: { fromCache: false }, empty: false, docs: [{ id: 'run', data: () => ({ id: 'run', date: '2026-11-11', attendees: [] }) }], size: 1 };
  next(snapshot); expect(api.onSnapshot).toHaveBeenCalledTimes(2);
  next(snapshot); expect(api.onSnapshot).toHaveBeenCalledTimes(2);
  expect(api.onSnapshot.mock.calls[0][0].constraints).toContainEqual({ limit: 21 });
});
it('leaves the history cursor unchanged when meetup loading fails, so retry cannot skip runs', async () => {
  const docs = Array.from({ length: 21 }, (_, i) => ({ id: `r${i}`, data: () => ({ id: `r${i}`, date: '2026-11-01' }) }));
  const page = { docs, size: 21 };
  api.getDocs.mockResolvedValueOnce(page).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(page).mockResolvedValueOnce({ docs: [] });
  const ctx = { priorRunsPending: { current: false }, priorRunsComplete: { current: false }, priorRunsCursor: { current: undefined }, staffCodeWords: { current: {} },
    setPriorRunsLoading: vi.fn(), setPriorRunsError: vi.fn(), setPriorRunsLoaded: vi.fn(), setHasMorePriorRuns: vi.fn(), setRuns: vi.fn(), setMeetupEvents: vi.fn() };
  const ops = createScheduleLoadingOps(ctx as unknown as Parameters<typeof createScheduleLoadingOps>[0]);
  await expect(ops.loadPriorRuns()).rejects.toThrow('offline');
  expect(ctx.priorRunsCursor.current).toBeUndefined(); expect(ctx.setRuns).not.toHaveBeenCalled();
  await ops.loadPriorRuns(); expect(ctx.priorRunsCursor.current).toBe(docs[19]);
  expect(ctx.setHasMorePriorRuns).toHaveBeenLastCalledWith(true);
});
