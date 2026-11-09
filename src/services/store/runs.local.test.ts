import { expect, it, vi } from 'vitest';
import { createRunOps } from './runs';
import { GUEST_USER } from '../../data/initialData';
import type { CheckInRecord, UserProfile } from '../../types';
vi.mock('../firebase', () => ({ isFirebaseConfigured: false, db: null }));

it('deleting a local-mode run rolls back miles, counts and the last-check-in date', async () => {
  const user: UserProfile = { ...GUEST_USER, email: 'alice@example.com', totalRuns: 5, loggedRuns: 5, totalMiles: 15.1, runCount: 5, lastCheckInDate: '2026-11-11', lastCheckInRunId: 'delete' };
  const checkins = [
    { id: 'old_alice', runId: 'old', date: '2026-11-04', time: '18:00', userEmail: user.email, actualMiles: 3.1, activity: 'running' },
    { id: 'delete_alice', runId: 'delete', date: '2026-11-11', time: '18:00', userEmail: user.email, actualMiles: 3.1, activity: 'running' },
  ] as CheckInRecord[];
  const ctx = {
    users: [user], checkins, meetupEvents: [], badges: [],
    fetchLegacyEvents: vi.fn().mockResolvedValue([]),
    setUsers: vi.fn(), setMembers: vi.fn(), setCheckins: vi.fn(), setMilestoneAlerts: vi.fn(), setRuns: vi.fn(), setMeetupEvents: vi.fn(),
  };
  await createRunOps(ctx as unknown as Parameters<typeof createRunOps>[0]).deleteRun('delete');
  const updated: UserProfile = ctx.setUsers.mock.calls[0][0]([user])[0];
  expect(updated).toMatchObject({ totalRuns: 4, loggedRuns: 4, totalMiles: 12, runCount: 4, lastCheckInDate: '2026-11-04', lastCheckInRunId: 'old' });
  expect(ctx.setCheckins.mock.calls[0][0](checkins)).toHaveLength(1);
});
