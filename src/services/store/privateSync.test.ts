import { beforeEach, expect, it, vi } from 'vitest';
import { createPrivateSyncOps } from './privateSync';

const api = vi.hoisted(() => ({ getDocs: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), onSnapshot: vi.fn() }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  query: (ref: unknown) => ref, where: vi.fn(), ...api,
}));

function context() {
  return {
    staffRosterPage: { current: { pending: false, complete: false } }, gearHistoryPage: { current: { pending: false, complete: false } },
    setStaffRosterLoading: vi.fn(), setStaffRosterError: vi.fn(), setHasMoreStaffUsers: vi.fn(),
    setGearHistoryLoading: vi.fn(), setGearHistoryError: vi.fn(), setHasMoreGearHistory: vi.fn(),
    privateUnsubscribers: { current: [] }, setPrivateSyncError: vi.fn(),
    privateSyncEpoch: { current: 0 }, staffCodeWords: { current: {} },
    setUsers: vi.fn(), setMeetupEvents: vi.fn(), setCheckins: vi.fn(), setOwnLegacyEvents: vi.fn(), setLegacyMembers: vi.fn(), setMilestoneAlerts: vi.fn(),
    fetchLegacyEvents: vi.fn().mockResolvedValue([]), loadLegacyPool: vi.fn().mockResolvedValue([]),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  api.onSnapshot.mockReturnValue(vi.fn());
  api.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ linkedLegacyIds: [] }) });
});

it('does not restore private data when requests finish after sign-out', async () => {
  const callbacks: Array<(snap: { docs: [] }) => void> = [];
  const unsubscribe = vi.fn();
  api.onSnapshot.mockImplementation((_ref, next) => { callbacks.push(next); return unsubscribe; });
  const ctx = context();
  const ops = createPrivateSyncOps(ctx as unknown as Parameters<typeof createPrivateSyncOps>[0]);
  const syncing = ops.syncPrivateData('alice@example.com', true);
  ops.clearPrivateData();
  for (const setter of [ctx.setUsers, ctx.setCheckins, ctx.setMilestoneAlerts, ctx.setOwnLegacyEvents, ctx.setMeetupEvents, ctx.setLegacyMembers]) setter.mockClear();
  callbacks.forEach((next) => next({ docs: [] }));
  expect(unsubscribe).toHaveBeenCalledTimes(callbacks.length);
  await syncing;
  expect(ctx.setUsers).not.toHaveBeenCalled();
  expect(ctx.setCheckins).not.toHaveBeenCalled();
  expect(ctx.setMilestoneAlerts).not.toHaveBeenCalled();
  expect(ctx.setOwnLegacyEvents).not.toHaveBeenCalled();
  expect(ctx.setMeetupEvents).not.toHaveBeenCalled();
});

it('does not re-read or re-seed routes during staff sign-in', async () => {
  api.getDocs.mockResolvedValue({ docs: [] });
  const ops = createPrivateSyncOps(context() as unknown as Parameters<typeof createPrivateSyncOps>[0]);
  await ops.syncPrivateData('alice@example.com', true);
  expect(api.getDocs.mock.calls.some(([ref]) => ref === 'routes')).toBe(false);
  expect(api.setDoc).not.toHaveBeenCalled();
});

it('does not subscribe to the complete staff profile collection at sign-in', async () => {
  const ctx = context();
  await createPrivateSyncOps(ctx as unknown as Parameters<typeof createPrivateSyncOps>[0]).syncPrivateData('alice@example.com', true);
  expect(api.onSnapshot.mock.calls.some(([ref]) => ref === 'users')).toBe(false);
  expect(api.onSnapshot.mock.calls.some(([ref]) => ref === 'users/alice@example.com')).toBe(true);
});
