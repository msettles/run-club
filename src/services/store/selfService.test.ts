import { beforeEach, expect, it, vi } from 'vitest';
import { createSelfServiceOps } from './selfService';
import { GUEST_USER } from '../../data/catalog';
const transport = vi.hoisted(() => ({ getDoc: vi.fn() }));
vi.mock('../firebase', () => ({ db: {}, isFirebaseConfigured: true }));
vi.mock('firebase/firestore', () => ({ doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`, getDoc: transport.getDoc }));
function context() {
  const user = { ...GUEST_USER, email: 'me@example.test', role: 'member' as const, linkedLegacyIds: ['old'] };
  return { currentUser: user, privateSessionEpoch: { current: 1 }, runs: [], meetupEvents: [],
    fetchRunnerCheckins: vi.fn().mockResolvedValue([]), fetchLegacyEvents: vi.fn().mockResolvedValue([]),
    claimLegacyProfile: vi.fn().mockResolvedValue({ ...user, totalRuns: 12 }), refreshDerivedStats: vi.fn().mockResolvedValue({ ...user, totalRuns: 12 }),
    loadRoute: vi.fn().mockResolvedValue({ id: 'saved-version-1' }) };
}
const ops = (ctx: ReturnType<typeof context>) => createSelfServiceOps(ctx as unknown as Parameters<typeof createSelfServiceOps>[0]);
beforeEach(() => { vi.clearAllMocks(); });
it('loads only the signed-in identity and its linked names', async () => {
  const ctx = context(); await ops(ctx).loadPersonalHistory();
  expect(ctx.fetchRunnerCheckins).toHaveBeenCalledWith('me@example.test'); expect(ctx.fetchLegacyEvents).toHaveBeenCalledWith(['old']);
});
it('rejects late private history after a session change', async () => {
  const ctx = context(); let release!: (rows: []) => void;
  ctx.fetchRunnerCheckins.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  const pending = ops(ctx).loadPersonalHistory(); ctx.privateSessionEpoch.current++; release([]);
  await expect(pending).rejects.toThrow('account changed');
});
it('reports a saved claim honestly when secondary reward refresh fails', async () => {
  const ctx = context(); ctx.refreshDerivedStats.mockRejectedValueOnce(new Error('Offline'));
  const result = await ops(ctx).claimOwnHistory('old');
  expect(ctx.claimLegacyProfile).toHaveBeenCalledWith(ctx.currentUser, 'old'); expect(result).toMatchObject({ user: { totalRuns: 12 }, rewardsPending: true });
});
it('resolves an older route alias through its recorded meetup only when requested', async () => {
  const ctx = context(); transport.getDoc.mockResolvedValue({ data: () => ({ routes: { '1.2': { routeId: 'saved-version-1' } } }) });
  expect(await ops(ctx).loadPersonalHistoryRoute({ id: 'ci', runId: 'older-run', routeChoice: '1.2', title: 'Older run', date: '2020-01-01', source: 'app' })).toEqual({ id: 'saved-version-1' });
  expect(transport.getDoc).toHaveBeenCalledWith('meetup_events/older-run'); expect(ctx.loadRoute).toHaveBeenCalledWith('saved-version-1');
});
it('does not invent a route link for attendance without one', async () => {
  const ctx = context();
  await expect(ops(ctx).loadPersonalHistoryRoute({ id: 'legacy', title: 'Old attendance', date: '2020-01-01', source: 'legacy' })).rejects.toThrow('no saved route link');
  expect(ctx.loadRoute).not.toHaveBeenCalled();
});
