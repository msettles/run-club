import { beforeEach, expect, it, vi } from 'vitest';
import { createCheckInOps } from './checkIn';
import { GUEST_USER } from '../../data/initialData';

const firestore = vi.hoisted(() => ({
  docs: {} as Record<string, unknown>, runTransaction: vi.fn(), set: vi.fn(), update: vi.fn(), attendees: [] as { memberId: string; name: string; checkedIn: boolean; rsvpDate: string }[],
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
    refreshDerivedStats: vi.fn().mockResolvedValue(user), syncMemberProjection: vi.fn().mockResolvedValue(undefined),
    fetchLegacyEvents: vi.fn().mockResolvedValue([]), fetchRunnerCheckins: vi.fn().mockResolvedValue([]),
  };
}
const params = { eventId: 'run', userEmail: 'alice@example.com', codeWordEntered: 'ACORN', activity: 'running' as const, distanceChoice: 'short' };

beforeEach(() => {
  vi.clearAllMocks();
  firestore.attendees = [];
  const c = context();
  firestore.docs = { 'users/alice@example.com': c.users[0], 'meetup_events/run': c.meetupEvents[0] };
  firestore.runTransaction.mockImplementation(async (_db, callback) => callback({
    get: async (ref: string) => ({ exists: () => ref === 'runs/run' || !!firestore.docs[ref], data: () => ref === 'runs/run' ? { attendees: firestore.attendees } : firestore.docs[ref] }),
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

it('refuses more loops than the route allows', async () => {
  Object.assign((firestore.docs['meetup_events/run'] as { routes: { short: object } }).routes.short, { isLoop: true, maxLoops: 3, baseMiles: 3.1 });
  const ops = createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]);
  expect(await ops.checkInRunner({ ...params, loops: 4 })).toMatchObject({ success: false, message: 'This route allows up to 3 loops. Please choose again.' });
  const allowed = await ops.checkInRunner({ ...params, loops: 3 });
  expect(allowed.checkIn).toMatchObject({ loops: 3, actualMiles: 9.3 });
});

it('preserves an existing RSVP instead of duplicating it', async () => {
  const { memberKeyFor } = await import('../../utils/memberKey');
  firestore.attendees = [{ memberId: await memberKeyFor(params.userEmail), name: 'Alice', checkedIn: false, rsvpDate: 'original' }];
  const ops = createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]);
  expect((await ops.checkInRunner(params)).success).toBe(true);
  expect(firestore.update).toHaveBeenCalledWith('runs/run', { attendees: [expect.objectContaining({ rsvpDate: 'original', checkedIn: true })], attendeeIds: [await memberKeyFor(params.userEmail)] });
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
  expect(firestore.set).not.toHaveBeenCalled();
});

it('does not multiply a non-loop route by a submitted loop count', async () => {
  const ops = createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]);
  const result = await ops.checkInRunner({ ...params, loops: 4 });
  expect(result.checkIn?.actualMiles).toBe(3.1);
  expect(result.checkIn?.loops).toBe(1);
});


it('uses the current server profile rather than a stale tab snapshot', async () => {
  firestore.docs['users/alice@example.com'] = { ...context().users[0], totalRuns: 10, loggedRuns: 10, runCount: 10, totalMiles: 30 };
  const result = await createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]).checkInRunner(params);
  expect(result.user?.totalRuns).toBe(11);
  expect(result.user?.totalMiles).toBe(33.1);
});

it('preserves a prior fulfilled milestone without blocking attendance', async () => {
  firestore.docs['milestone_alerts/m5_alice@example.com'] = { fulfilled: true };
  const result = await createCheckInOps(context() as unknown as Parameters<typeof createCheckInOps>[0]).checkInRunner(params);
  expect(result.success).toBe(true);
  expect(firestore.set.mock.calls.some(([ref]) => ref === 'milestone_alerts/m5_alice@example.com')).toBe(false);
});

it('returns the newly earned incremental level while the verified reward refresh runs separately', async () => {
  const ctx = context();
  const badge = { id: 'five', name: 'Five', emoji: '', description: '', requirement: '', category: 'milestone' as const,
    triggerConfig: { type: 'milestone' as const, minTotalRuns: 5, isIncremental: true, step: 5 } };
  Object.assign(ctx, { badges: [badge] });
  firestore.docs['users/alice@example.com'] = { ...ctx.users[0], totalRuns: 9, loggedRuns: 9, runCount: 9,
    unlockedBadgeIds: ['five'], badgeCounts: { five: 1 } };
  const result = await createCheckInOps(ctx as unknown as Parameters<typeof createCheckInOps>[0]).checkInRunner(params);
  expect(result.success).toBe(true);
  expect(result.user?.badgeCounts?.five).toBe(2);
  expect(firestore.set).toHaveBeenCalledWith('users/alice@example.com', expect.objectContaining({ badgeCounts: { five: 1 } }));
});

it('keeps a completed handout visible when the pending listener removes it before the save returns', async () => {
  const ctx = context();
  firestore.docs['milestone_alerts/gear'] = { userEmail: 'alice@example.com', runnerName: 'Alice', fulfilled: false };
  const ops = createCheckInOps(ctx as unknown as Parameters<typeof createCheckInOps>[0]);
  await ops.markMilestoneFulfilled('gear', 'Organizer');
  const update = ctx.setMilestoneAlerts.mock.calls[0][0];
  expect(update([])).toEqual([expect.objectContaining({ id: 'gear', runnerName: 'Alice', fulfilled: true, fulfilledBy: 'Organizer' })]);
  expect(firestore.update).toHaveBeenCalledWith('milestone_alerts/gear', expect.objectContaining({ fulfilled: true }));
});
