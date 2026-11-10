import { describe, expect, it } from 'vitest';
import { adjustDistanceCounts, computeStreaks, datedEventsFrom, distanceCountKeys, liveStreak, parseCsv, recomputeBadges, specialEventIdsFor } from './legacy';
import { GUEST_USER } from '../data/initialData';
import type { Badge, BadgeTriggerConfig, CheckInRecord } from '../types';

const badge = (id: string, triggerConfig?: BadgeTriggerConfig): Badge => ({ id, name: id, emoji: '', description: '', requirement: '', triggerConfig });

describe('legacy parsing and attendance history', () => {
  it('reads quoted commas, escaped quotes, CRLF and embedded newlines', () => {
    expect(parseCsv('Name,Notes\r\n"Doe, Jane","Said ""hi""\nand ran"\r\n')).toEqual([{ Name: 'Doe, Jane', Notes: 'Said "hi"\nand ran' }]);
  });
  it('deduplicates attendance within a week and counts across the year boundary', () => {
    expect(computeStreaks(['2025-12-24', '2025-12-31', '2026-01-01', '2026-01-07'], '2026-01-14')).toEqual({ current: 3, longest: 3 });
    expect(computeStreaks(['2025-12-24', '2025-12-31', '2026-01-07'], '2026-01-21')).toEqual({ current: 0, longest: 3 });
    expect(computeStreaks([], '2026-01-21')).toEqual({ current: 0, longest: 0 });
  });
  it('expires a cached leaderboard streak only after a full missed week', () => {
    expect(liveStreak(3, '2026-11-04', '2026-11-11')).toBe(3);
    expect(liveStreak(3, '2026-11-04', '2026-11-18')).toBe(0);
    const legacyWeek = Math.floor((Date.parse('2026-11-04T00:00:00Z') + 259200000) / 604800000);
    expect(liveStreak(3, undefined, '2026-11-11', legacyWeek)).toBe(3);
    expect(liveStreak(3, undefined, '2026-11-18', legacyWeek)).toBe(0);
  });
  it('matches special events by run ID when two runs share a date', () => {
    const checkin = { runId: 'normal', date: '2026-11-11', codeWord: 'ACORN' } as CheckInRecord;
    const events = [{ id: 'normal', date: checkin.date, title: 'Social Run' }, { id: 'special', date: checkin.date, title: 'Turkey Trot' }];
    expect(datedEventsFrom([], [checkin], events)[0].specialEventIds).toEqual([]);
    expect(datedEventsFrom([], [{ ...checkin, runId: 'special' }], events)[0].specialEventIds).toEqual(['turkey_trot']);
  });
  it('does not count an explicitly marked special event twice', () => {
    expect(specialEventIdsFor('TURKEY', 'Turkey Trot', 'turkey_trot')).toEqual(['turkey_trot']);
  });
});

describe('distance counts and badge recomputation', () => {
  it('supports old buckets and both distance labels, and reverses an edit without mutating input', () => {
    expect(distanceCountKeys(2)).toEqual(['1', '2.0', '2.0 mi']);
    expect(distanceCountKeys(4)).toEqual(['3', '4.0', '4.0 mi']);
    expect(distanceCountKeys(4.1)).toEqual(['5', '4.1', '4.1 mi']);
    const original = { '3': 2, '3.1': 2, '3.1 mi': 2 };
    const edited = adjustDistanceCounts(adjustDistanceCounts(original, 3.1, -1), 5.2, 1);
    expect(original['3']).toBe(2);
    expect(edited).toMatchObject({ '3': 1, '3.1': 1, '5': 1, '5.2': 1 });
    expect(adjustDistanceCounts({ '3': 0 }, 3.1, -1)['3']).toBe(0);
  });
  it('awards all rule types from combined totals and history, preserving manual badges', () => {
    const badges = [
      badge('first', { type: 'attendance' }), badge('five', { type: 'milestone', minTotalRuns: 5 }),
      badge('walk', { type: 'activity', activityType: 'walking', activityCount: 2, isIncremental: true }),
      badge('distance', { type: 'distance', distanceChoice: '3.1 mi', distanceCount: 2 }),
      badge('pet', { type: 'pet' }), badge('streak', { type: 'streak', streakWeeks: 2 }),
      badge('turkey', { type: 'special_event', specialEventId: 'turkey_trot' }), badge('manual'),
    ];
    const user = { ...GUEST_USER, totalRuns: 5, walkCount: 4, petRunCount: 2, distanceCounts: { '3.1 mi': 2 }, unlockedBadgeIds: ['manual'], badgeCounts: { manual: 3 } };
    const events = [{ date: '2026-11-04', specialEventIds: ['turkey_trot'] }, { date: '2026-11-11', specialEventIds: ['turkey_trot'] }];
    const result = recomputeBadges(user, badges, events, '2026-11-11');
    expect(result.badgeCounts).toEqual({ manual: 3, first: 1, five: 1, walk: 2, distance: 1, pet: 2, streak: 1, turkey: 2 });
    expect(result.currentStreakWeeks).toBe(2);
    expect(result.unlockedBadgeIds[0]).toBe('manual');
  });
  it('removes a rule-based badge after rollback while retaining manual awards', () => {
    const result = recomputeBadges({ ...GUEST_USER, totalRuns: 4, unlockedBadgeIds: ['five', 'manual'], badgeCounts: { five: 1, manual: 2 } }, [badge('five', { type: 'milestone', minTotalRuns: 5 }), badge('manual')], [], '2026-11-11');
    expect(result.badgeCounts).toEqual({ manual: 2 });
    expect(result.unlockedBadgeIds).toEqual(['manual']);
  });
});

it('rolls the last check-in date back to actual remaining attendance', async () => {
  const { lastCheckInFields } = await import('./legacy');
  expect(lastCheckInFields([])).toEqual({ lastCheckInDate: undefined, lastCheckInRunId: undefined });
  expect(lastCheckInFields([{ date: '2026-11-04', time: '18:05', runId: 'earlier' }, { date: '2026-10-28', time: '18:00', runId: 'older' }] as CheckInRecord[])).toEqual({ lastCheckInDate: '2026-11-04', lastCheckInRunId: 'earlier' });
});
