import { beforeEach, expect, it, vi } from 'vitest';
import { createCheckInOps } from './checkIn';
import { GUEST_USER } from '../../data/initialData';

const firestore = vi.hoisted(() => ({
  runTransaction: vi.fn(), set: vi.fn(), update: vi.fn(), attendees: [] as { memberId: string; name: string; checkedIn: boolean; rsvpDate: string }[],
}));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  runTransaction: firestore.runTransaction, setDoc: vi.fn(),
}));

function context() {
  const user = { ...GUEST_USER, email: 'alice@example.com', displayName: 'Alice', role: 'member' as const, totalRuns: 4, loggedRuns: 4, totalMiles: 12, runCount: 4 };
  const event = { id: 'run', date: '2026-11-11', codeWord: 'ACORN', routes: { short: { name: 'Short', actualMiles: 3.1, routeId: 'short' } } };
  return {
    users: [user], currentUser: user, currentUserEmail: user.email, meetupEvents: [event],
    badges: [], checkins: [], ownLegacyEvents: [], milestoneAlerts: [],
    setRuns: vi.fn(), setMembers: vi.fn(), setUsers: vi.fn(), setCheckins: vi.fn(), setMilestoneAlerts: vi.fn(),
    fetchLegacyEvents: vi.fn().mockResolvedValue([]), fetchRunnerCheckins: vi.fn().mockResolvedValue([]),
  };
}
const params = { eventId: 'run', userEmail: 'alice@example.com', codeWordEntered: 'ACORN', activity: 'running' as const, distanceChoice: 'short' };

beforeEach(() => {
  vi.clearAllMocks();
  firestore.attendees = [];
  firestore.runTransaction.mockImplementation(async (_db, callback) => callback({
    get: async () => ({ exists: () => true, data: () => ({ attendees: firestore.attendees }) }),
    set: firestore.set, update: firestore.update,
  }));
});

it('persists check-in, totals, milestone and automatic RSVP before returning success', async () => {
  const ctx = context();
  const ops = createCheckInOps(ctx as unknown as Parameters<typeof createCheckInOps>[0]);
  const result = await ops.checkInRunner(params);
  expect(result.success).toBe(true);
  expect(firestore.set).toHaveBeenCalledWith('checkins/run_alice@example.com', expect.objectContaining({ actualMiles: 3.1 }));
  expect(firestore.set).toHaveBeenCalledWith('users/alice@example.com', expect.objectContaining({ totalRuns: 5, totalMiles: 15.1 }));
  expect(firestore.set).toHaveBeenCalledWith('milestone_alerts/m5_alice@example.com', expect.objectContaining({ milestoneRuns: 5 }));
  expect(firestore.update).toHaveBeenCalledWith('runs/run', expect.objectContaining({ attendees: [expect.objectContaining({ name: 'Alice' })] }));
  expect(ctx.setCheckins).toHaveBeenCalledOnce();
  expect(result.checkIn?.runId).toBe('run');
});

it('preserves an existing RSVP instead of duplicating it', async () => {
  const { memberKeyFor } = await import('../../utils/memberKey');
  firestore.attendees = [{ memberId: await memberKeyFor(params.userEmail), name: 'Alice', checkedIn: false, rsvpDate: 'original' }];
  const ops = createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]);
  expect((await ops.checkInRunner(params)).success).toBe(true);
  expect(firestore.update).not.toHaveBeenCalled();
});

it('does not show success or mutate local data when the server rejects the save', async () => {
  firestore.runTransaction.mockRejectedValue({ code: 'permission-denied' });
  const ctx = context();
  const ops = createCheckInOps(ctx as unknown as Parameters<typeof createCheckInOps>[0]);
  expect((await ops.checkInRunner(params)).success).toBe(false);
  expect(ctx.setCheckins).not.toHaveBeenCalled();
  expect(ctx.setRuns).not.toHaveBeenCalled();
  expect(ctx.setUsers).not.toHaveBeenCalled();
});

it('rejects unavailable routes without inventing mileage', async () => {
  const ops = createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]);
  expect((await ops.checkInRunner({ ...params, distanceChoice: 'missing' })).success).toBe(false);
  expect(firestore.runTransaction).not.toHaveBeenCalled();
});

it('does not multiply a non-loop route by a submitted loop count', async () => {
  const ops = createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]);
  const result = await ops.checkInRunner({ ...params, loops: 4 });
  expect(result.checkIn?.actualMiles).toBe(3.1);
  expect(result.checkIn?.loops).toBe(1);
});
