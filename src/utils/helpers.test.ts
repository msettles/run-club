import { describe, expect, it } from 'vitest';
import { sha256Hex } from './hash';
import { codeKeyFor, memberKeyFor } from './memberKey';
import { formatMiles, roundMiles } from './miles';
import { milestoneProgress } from './milestones';
import { hydrateRouteFromFirestore } from '../services/store/helpers';

describe('stable Firebase keys', () => {
  it('matches the standard SHA-256 vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('normalizes member emails and includes the public key namespace', async () => {
    expect(await memberKeyFor(' Alice@Example.com ')).toBe(await sha256Hex('woodchuckers:alice@example.com'));
  });
  it('normalizes words and keeps same-word runs on different dates separate', async () => {
    expect(await codeKeyFor('2026-11-11', ' acorn ')).toBe(await sha256Hex('2026-11-11:ACORN'));
    expect(await codeKeyFor('2026-11-11', 'acorn')).not.toBe(await codeKeyFor('2026-11-12', 'acorn'));
  });
});

it.each([[0, '0.0'], [3, '3.0'], [3.14, '3.1'], [3.15, '3.2']])('formats %s miles as %s', (miles, label) => {
  expect(formatMiles(miles)).toBe(label);
  expect(roundMiles(miles)).toBe(Number(label));
});

it.each([
  [0, 5, 0], [4, 1, 80], [5, 45, 0], [50, 50, 0], [75, 25, 50], [200, 0, 100], [250, 0, 100],
])('calculates milestone progress for %s runs', (runs, remaining, percent) => {
  const progress = milestoneProgress(runs);
  expect(progress.runsRemaining).toBe(remaining);
  expect(progress.progressPercent).toBe(percent);
});

it('does not infer repeatable loops from a route name or a non-boolean flag', () => {
  for (const isLoop of [undefined, false, 'false', 'true']) {
    expect(hydrateRouteFromFirestore({ id: 'route-the-123', name: 'The 1, 2, 3', isLoop }).isLoop).toBe(false);
  }
  expect(hydrateRouteFromFirestore({ isLoop: true }).isLoop).toBe(true);
});

it('reuses a member hash for repeated normalized emails', () => {
  expect(memberKeyFor(' CacheProbe@Example.com ')).toBe(memberKeyFor('cacheprobe@example.com'));
});

it('omits raw GPX and serializes nested geometry before saving a route', async () => {
  const { formatRouteForFirestore, assertRouteFitsFirestore } = await import('../services/store/helpers');
  const formatted = formatRouteForFirestore({ detailsLoaded: false, gpxXml: 'x'.repeat(1024 * 1024), points: [{ lat: 38, lon: -121 }], geoJson: { coordinates: [[-121, 38], [-122, 39]] }, directions: [] });
  expect(formatted.gpxXml).toBeUndefined();
  expect(formatted.detailsLoaded).toBeUndefined();
  expect(typeof formatted.geoJson).toBe('string');
  expect(() => assertRouteFitsFirestore(formatted)).not.toThrow();
  expect(() => assertRouteFitsFirestore({ geoJson: 'x'.repeat(901 * 1024) })).toThrow('too detailed');
});

it('keeps private profile fields out of deferred public leaderboard state', async () => {
  const { memberFromUser } = await import('../services/store/helpers');
  const { GUEST_USER } = await import('../data/catalog');
  const row = memberFromUser({ ...GUEST_USER, email: 'private@example.com', displayName: 'Runner', birthday: '1980-01-01', emergencyContact: { name: 'Private', phone: '555-1234' } }, 'public-key', true);
  expect(row.email).toBe('');
  expect(row.birthday).toBeUndefined();
  expect(row.emergencyContact).toBeUndefined();
  expect(row.name).toBe('Runner');
});

it('a recognition-only milestone (the first run) is never a gear handout', async () => {
  const { alertHasGear } = await import('./milestones');
  expect(alertHasGear({ hasGear: false })).toBe(false);
  expect(alertHasGear({ hasGear: true })).toBe(true);
  expect(alertHasGear({})).toBe(true); // alerts saved before this field existed were gear
});

it('milestone progress only counts toward gear milestones and honors admin-made ones', () => {
  const custom = [
    { id: 'a', runsRequired: 1, name: 'First', reward: 'First', perks: '', icon: '🦫', description: '', hasGear: false },
    { id: 'b', runsRequired: 10, name: '10 runs', reward: 'Socks', perks: '', icon: '🧦', description: '', hasGear: true },
  ];
  expect(milestoneProgress(0, custom)).toMatchObject({ runsRemaining: 10, progressPercent: 0 });
  expect(milestoneProgress(5, custom).progressPercent).toBe(50);
});

describe('incremental badges', () => {
  it('levels up every step of the chosen counter and caps only the display', async () => {
    const { recomputeBadges } = await import('./legacy');
    const { levelTag } = await import('./badgeProgress');
    const { INITIAL_BADGES } = await import('../data/catalog');
    const user = { totalRuns: 30, walkCount: 25, runCount: 5, petRunCount: 11, unlockedBadgeIds: [], badgeCounts: {} } as unknown as import('../types').UserProfile;
    const counts = recomputeBadges(user, INITIAL_BADGES, []).badgeCounts!;
    expect(counts['power-walker']).toBe(2);   // 25 walks, every 10
    expect(counts['pet-runner']).toBe(11);    // 11 pet check-ins, every 1
    const walker = INITIAL_BADGES.find((b) => b.id === 'power-walker')!;
    const hound = INITIAL_BADGES.find((b) => b.id === 'pet-runner')!;
    expect(levelTag(walker, 25)).toBe('x25');      // no cap
    expect(levelTag(hound, 10)).toBe('x10');       // the cap itself shows as is
    expect(levelTag(hound, 11)).toBe('x10+');      // beyond it shows 10+
  });
  it('supports admin-made incremental badges for walks, runs and pet check-ins', async () => {
    const { recomputeBadges } = await import('./legacy');
    const user = { totalRuns: 20, walkCount: 4, runCount: 14, petRunCount: 0, unlockedBadgeIds: [], badgeCounts: {} } as unknown as import('../types').UserProfile;
    const badge = (id: string, counter: 'walks' | 'runs' | 'pet', step: number) => ({ id, name: id, emoji: '🏅', description: '', requirement: '', category: 'incremental' as const, isIncremental: true, triggerConfig: { type: 'incremental' as const, counter, step, isIncremental: true } });
    const counts = recomputeBadges(user, [badge('r', 'runs', 5), badge('w', 'walks', 5), badge('p', 'pet', 1)], []).badgeCounts!;
    expect(counts).toEqual({ r: 2 }); // 14 runs / 5 = 2; 4 walks is short of 5; no pet check-ins
  });
});

it('mileage milestones have their own progress, separate from runs', () => {
  const list = [
    { id: 'r', runsRequired: 5, name: '5', reward: 'Shirt', perks: '', icon: '👕', description: '' },
    { id: 'm1', measure: 'miles' as const, milesRequired: 100, name: '100 mi', reward: 'Pin', perks: '', icon: '📏', description: '' },
    { id: 'm2', measure: 'miles' as const, milesRequired: 500, name: '500 mi', reward: 'Mug', perks: '', icon: '🍺', description: '' },
  ];
  expect(milestoneProgress(40, list, 'miles')).toMatchObject({ runsRemaining: 60, progressPercent: 40 });
  expect(milestoneProgress(250, list, 'miles').nextMilestone?.id).toBe('m2');
  expect(milestoneProgress(3, list, 'runs').nextMilestone?.id).toBe('r');
});

it('a miles incremental badge levels up every step of total miles', async () => {
  const { recomputeBadges } = await import('./legacy');
  const user = { totalRuns: 30, totalMiles: 257.4, unlockedBadgeIds: [], badgeCounts: {} } as unknown as import('../types').UserProfile;
  const badge = { id: 'mi', name: 'mi', emoji: '📏', description: '', requirement: '', category: 'incremental' as const, isIncremental: true, triggerConfig: { type: 'incremental' as const, counter: 'miles' as const, step: 100, isIncremental: true } };
  expect(recomputeBadges(user, [badge], []).badgeCounts).toEqual({ mi: 2 });
  expect(recomputeBadges({ ...user, totalMiles: 99.9 } as typeof user, [badge], []).badgeCounts).toEqual({});
});

describe('badge progress is shown within the current level', () => {
  it('streak badge progress is the streak you are on now, against the badge step', async () => {
    const { badgeProgress } = await import('./badgeProgress');
    const { INITIAL_BADGES } = await import('../data/catalog');
    const { clubYmd } = await import('./dateUtils');
    const today = clubYmd();
    const user = (extra: object) => ({ totalRuns: 0, totalMiles: 0, walkCount: 0, runCount: 0, unlockedBadgeIds: [], badgeCounts: {}, lastCheckInDate: today, ...extra }) as unknown as import('../types').UserProfile;
    const burrow = INITIAL_BADGES.find((b) => b.id === 'streak-10')!;
    const streak = INITIAL_BADGES.find((b) => b.id === 'streak-4')!;
    // Earned from a past 13-week streak, but only 1 week into the current one: 1 / 10 and 1 / 4.
    const now = { longestStreakWeeks: 13, currentStreakWeeks: 1, badgeCounts: { 'streak-10': 1, 'streak-4': 3 } };
    expect(badgeProgress(burrow, user(now))).toMatchObject({ current: 1, target: 10 });
    expect(badgeProgress(streak, user(now))).toMatchObject({ current: 1, target: 4 });
    // Still in a 13-week streak: 3 past the first 10-week level, 1 past the third 4-week level.
    const long = { longestStreakWeeks: 13, currentStreakWeeks: 13, badgeCounts: { 'streak-10': 1, 'streak-4': 3 } };
    expect(badgeProgress(burrow, user(long))).toMatchObject({ current: 3, target: 10 });
    expect(badgeProgress(streak, user(long))).toMatchObject({ current: 1, target: 4 });
    // Exactly on a level shows a full bar, not 0; a new streak of 2 is 2 / 4.
    expect(badgeProgress(streak, user({ currentStreakWeeks: 8, longestStreakWeeks: 8 }))).toMatchObject({ current: 4, target: 4 });
    expect(badgeProgress(streak, user({ currentStreakWeeks: 2, longestStreakWeeks: 2 }))).toMatchObject({ current: 2, target: 4 });
    // A lapsed streak (last check-in long ago) is 0.
    expect(badgeProgress(burrow, user({ currentStreakWeeks: 5, longestStreakWeeks: 13, lastCheckInDate: '2020-01-01' }))).toMatchObject({ current: 0, target: 10 });
    const walker = INITIAL_BADGES.find((b) => b.id === 'power-walker')!;
    expect(badgeProgress(walker, user({ walkCount: 25, badgeCounts: { 'power-walker': 2 } }))).toMatchObject({ current: 5, target: 10 });
    expect(badgeProgress(walker, user({ walkCount: 3 }))).toMatchObject({ current: 3, target: 10 });
  });
});

describe('streak badges level up for every full block in every streak', () => {
  const wednesdays = (start: string, count: number) => Array.from({ length: count }, (_, i) => {
    const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * i); return d.toISOString().slice(0, 10);
  });

  it('finds each separate streak and counts full blocks', async () => {
    const { streakRunLengths, streakBlocks } = await import('./legacy');
    const dates = [...wednesdays('2024-01-03', 12), ...wednesdays('2024-05-01', 5)];
    expect(streakRunLengths(dates)).toEqual([12, 5]);
    expect(streakBlocks([12, 5], 4)).toBe(4); // 3 + 1
    expect(streakBlocks([12, 5], 10)).toBe(1);
    expect(streakBlocks([20], 10)).toBe(2);   // 20 in a row earns two
    expect(streakBlocks([9], 10)).toBe(0);
  });

  it('a later streak adds levels on top of an earlier one', async () => {
    const { recomputeBadges } = await import('./legacy');
    const { INITIAL_BADGES } = await import('../data/catalog');
    const user = { totalRuns: 17, walkCount: 0, runCount: 17, unlockedBadgeIds: [], badgeCounts: {} } as unknown as import('../types').UserProfile;
    const events = [...wednesdays('2024-01-03', 12), ...wednesdays('2024-05-01', 5)].map((date) => ({ date, specialEventIds: [] as string[] }));
    const counts = recomputeBadges(user, INITIAL_BADGES, events, '2024-06-01').badgeCounts!;
    expect(counts['streak-4']).toBe(4);
    expect(counts['streak-10']).toBe(1);
    // Under the old "longest streak only" rule these would have been 3 and 1.
  });
});
