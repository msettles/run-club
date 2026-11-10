import { beforeEach, expect, it, vi } from 'vitest';
import { GUEST_USER, INITIAL_BADGES } from '../../data/catalog';
import type { UserProfile } from '../../types';
import { attendanceWeek } from './rewardProofs';
import { rememberRewardSync, rewardsAreCurrent, streakLapsed } from './rewardSync';

vi.mock('../firebase', () => ({ isFirebaseConfigured: false, db: null }));
const user: UserProfile = { ...GUEST_USER, email: 'runner@example.test', role: 'member', totalRuns: 12, loggedRuns: 12, runCount: 12,
  badgeCounts: { 'first-chuck': 1 }, unlockedBadgeIds: ['first-chuck'], lastCheckInUpdatedAt: '2026-11-04T02:00:00.000Z' };

beforeEach(() => {
  const saved = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } });
});

it('treats rewards as current only for the exact profile state and badge catalog last refreshed', async () => {
  expect(await rewardsAreCurrent(user, INITIAL_BADGES)).toBe(false);
  await rememberRewardSync(user, INITIAL_BADGES);
  expect(await rewardsAreCurrent({ ...user, distanceCounts: {} }, INITIAL_BADGES)).toBe(true);
  for (const changed of [{ totalRuns: 13 }, { rewardEpoch: 1 }, { lastCheckInUpdatedAt: 'later' }, { linkedLegacyIds: ['old-name'] }, { badgeCounts: {} }, { email: 'other@example.test' }])
    expect(await rewardsAreCurrent({ ...user, ...changed }, INITIAL_BADGES)).toBe(false);
  expect(await rewardsAreCurrent(user, INITIAL_BADGES.slice(1))).toBe(false);
});

it('refreshes once a saved streak has lapsed, even when nothing else changed', async () => {
  const week = attendanceWeek('2026-11-11');
  const streaking = { ...user, currentStreakWeeks: 3, streakProofWeek: week - 1 };
  expect(streakLapsed(streaking, '2026-11-11')).toBe(false);
  expect(streakLapsed({ ...streaking, streakProofWeek: week - 2 }, '2026-11-11')).toBe(true);
  expect(streakLapsed({ ...user, currentStreakWeeks: 0 }, '2026-11-11')).toBe(false);
  expect(streakLapsed({ ...streaking, streakProofWeek: undefined }, '2026-11-11')).toBe(true);
});

it('refreshes when the device has no storage', async () => {
  vi.stubGlobal('localStorage', undefined);
  await rememberRewardSync(user, INITIAL_BADGES);
  expect(await rewardsAreCurrent(user, INITIAL_BADGES)).toBe(false);
});
