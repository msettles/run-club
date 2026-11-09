import { describe, expect, it } from 'vitest';
import { eventStart, computeCheckInWindow, checkInStatus, openCheckInEvents, nextCheckInEvent, upcomingRuns, priorRuns } from './checkInWindow';
import type { MeetupEvent, RunEvent } from '../types';

const event = (id: string, time = '06:00 PM', extra: Partial<MeetupEvent> = {}): MeetupEvent => ({
  id, title: id, date: '2026-11-11', time, codeWord: 'ACORN', activeDistances: [], routes: {}, ...extra,
});

describe('check-in windows', () => {
  it.each([['12:00 AM', 0], ['12:00 PM', 12], ['06:30 PM', 18], ['18:30', 18]])('parses %s in local time', (time, hour) => {
    expect(eventStart('2026-11-11', time).getHours()).toBe(hour);
  });
  it('opens two hours before start and includes both endpoints', () => {
    const ev = event('evening');
    const { opensAt, closesAt } = computeCheckInWindow(ev.date, ev.time);
    expect(opensAt.getHours()).toBe(16);
    expect(closesAt.getHours()).toBe(23);
    expect(checkInStatus(ev, new Date(+opensAt - 1))).toBe('not_open');
    expect(checkInStatus(ev, opensAt)).toBe('open');
    expect(checkInStatus(ev, closesAt)).toBe('open');
    expect(checkInStatus(ev, new Date(+closesAt + 1))).toBe('closed');
  });
  it('uses stored server windows instead of recalculating them', () => {
    const ev = event('stored', '06:00 PM', { checkInOpensAt: '2026-11-11T01:00:00Z', checkInClosesAt: '2026-11-11T02:00:00Z' });
    expect(checkInStatus(ev, new Date('2026-11-11T01:30:00Z'))).toBe('open');
  });
  it('filters unpublished events and orders simultaneous open runs by start', () => {
    const early = event('early', '05:00 PM');
    const late = event('late');
    const hidden = event('hidden', '04:00 PM', { codeWordSet: false });
    const next = event('next', '09:00 PM');
    const now = new Date(2026, 10, 11, 17);
    expect(openCheckInEvents([late, hidden, next, early], now).map((e) => e.id)).toEqual(['early', 'late']);
    expect(nextCheckInEvent([hidden, next, late], now)?.id).toBe('next');
  });
  it('keeps tonight in upcoming runs until its window closes', () => {
    const runs = [event('yesterday', '06:00 PM', { date: '2026-11-10' }), event('tonight'), event('tomorrow', '06:00 PM', { date: '2026-11-12' })].map((ev): RunEvent => ({ ...ev, time: ev.time || '06:00 PM', locationName: 'Blue Note', address: '', distanceMiles: 3.1, surface: 'Pavement', elevationGainFt: 0, description: '', paceGroups: [], attendees: [], organizerName: 'Club' }));
    const now = new Date(2026, 10, 11, 23);
    expect(upcomingRuns(runs, now).map((r) => r.id)).toEqual(['tonight', 'tomorrow']);
    expect(priorRuns(runs, now).map((r) => r.id)).toEqual(['yesterday']);
  });
});
