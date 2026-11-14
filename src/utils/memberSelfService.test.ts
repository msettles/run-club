import { describe, expect, it } from 'vitest';
import { personalHistoryRows } from './personalHistory';
import { runNightCounts } from './runNight';
import { assertAssistedCheckIn, assistedStreakWeeks } from './assistedCheckIn';
import { GUEST_USER } from '../data/catalog';
import type { CheckInRecord, MeetupEvent } from '../types';
const checkin: CheckInRecord = { id: 'run_app@example.test', runId: 'run', date: '2026-11-18', time: '18:30:00', userEmail: 'app@example.test', runnerName: 'Runner', actualMiles: 3.28, distanceChoice: 'long', activity: 'walking', withPet: true, source: 'pwa', createdAt: '2026-11-18T18:30:00Z' };
describe('personal attendance presentation', () => {
  it('counts shared aliases once and prefers app details for overlapping history', () => {
    const rows = personalHistoryRows([checkin], [
      { r: 'run', d: '2026-11-18', t: '18:00', c: 'PRIVATE' },
      { r: 'old', d: '2026-11-11', t: '18:00', c: 'PRIVATE' },
      { r: 'old', d: '2026-11-11', t: '18:00', c: 'PRIVATE' },
      { r: 'second-same-day', d: '2026-11-11', t: '19:00', c: 'PRIVATE' },
    ], [], []);
    expect(rows).toHaveLength(3); expect(rows[0]).toMatchObject({ source: 'app', miles: 3.28, activity: 'walking', withPet: true });
    expect(rows[1].runId).toBe('second-same-day'); expect(rows[2].miles).toBeUndefined();
    expect(JSON.stringify(rows)).not.toContain('PRIVATE');
  });
});
it('groups real mileage and loop choices instead of assuming fixed 1/3/5-mile routes', () => {
  const counts = runNightCounts([checkin, { ...checkin, id: 'two', activity: 'running', withPet: false, distanceChoice: 'short', actualMiles: 1.19 }, { ...checkin, id: 'three', loops: 2, actualMiles: 6.56 }]);
  expect(counts).toMatchObject({ total: 3, walking: 2, running: 1, pets: 2 }); expect(counts.routes).toHaveLength(3);
});
describe('assisted check-in policy', () => {
  const staff = { ...GUEST_USER, email: 'org@example.test', role: 'organizer' as const };
  const runner = { ...GUEST_USER, email: 'runner@example.test', role: 'member' as const };
  const event: MeetupEvent = { id: 'run', date: '2026-11-18', time: '06:30 PM', codeWord: 'SECRET', codeWordSet: true, title: 'Club run', activeDistances: [], routes: {} };
  const now = new Date('2026-11-19T02:30:00Z');
  it('permits staff during the normal club-local window', () => expect(() => assertAssistedCheckIn(staff, runner, event, false, false, now)).not.toThrow());
  it('denies ordinary runners, maintenance, imports, pending claims and closed windows', () => {
    expect(() => assertAssistedCheckIn(runner, runner, event, false, false, now)).toThrow('organizers');
    expect(() => assertAssistedCheckIn(staff, runner, event, true, false, now)).toThrow('paused');
    expect(() => assertAssistedCheckIn(staff, runner, event, false, true, now)).toThrow('paused');
    expect(() => assertAssistedCheckIn(staff, { ...runner, pendingLegacyClaim: 'old' }, event, false, false, now)).toThrow('claim');
    expect(() => assertAssistedCheckIn(staff, runner, event, false, false, new Date('2026-11-18T20:00:00Z'))).toThrow('window');
    expect(() => assertAssistedCheckIn({ ...staff, role: 'admin' }, runner, event, false, false, new Date('2026-11-20T02:00:00Z'))).toThrow('window');
  });
});

it('keeps streak freshness current after a long gap and deduplicates attendance weeks', () => {
  const result = assistedStreakWeeks(['2026-01-07', '2026-01-14', '2026-01-14', '2026-11-18']);
  expect(result.streakProofWeek).toBe(Math.floor(Date.parse('2026-11-18T00:00:00Z') / 604800000 + 3 / 7));
  expect(result.longestStreakProofWeek).toBe(Math.floor(Date.parse('2026-01-14T00:00:00Z') / 604800000 + 3 / 7));
});
