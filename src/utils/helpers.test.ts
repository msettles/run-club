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
