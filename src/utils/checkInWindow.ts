/**
 * Check-in windows. An event's check-in opens 2 hours before its start and
 * closes at 11:59:59 PM that day (club local time). Firestore stores the window
 * on meetup_events and the rules enforce it; this module mirrors the same rule
 * so the app can pick "the run happening right now" for the table QR code.
 */
import type { MeetupEvent, RunEvent } from '../types';

export const OPENS_BEFORE_START_MS = 2 * 60 * 60 * 1000;

/** Start of an event in local time from "YYYY-MM-DD" and "06:00 PM" / "18:00". */
export function eventStart(date: string, time?: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  let hour = 18;
  let minute = 0;
  const match = (time || '').match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (match) {
    hour = parseInt(match[1], 10);
    minute = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
  }
  return new Date(y, m - 1, d, hour, minute);
}

export function computeCheckInWindow(date: string, time?: string): { opensAt: Date; closesAt: Date } {
  const start = eventStart(date, time);
  return {
    opensAt: new Date(start.getTime() - OPENS_BEFORE_START_MS),
    closesAt: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59),
  };
}

/** The event's window: the stored one when present (what the rules enforce), else computed. */
export function checkInWindow(ev: Pick<MeetupEvent, 'date' | 'time' | 'checkInOpensAt' | 'checkInClosesAt'>): {
  opensAt: Date;
  closesAt: Date;
} {
  if (ev.checkInOpensAt && ev.checkInClosesAt) {
    return { opensAt: new Date(ev.checkInOpensAt), closesAt: new Date(ev.checkInClosesAt) };
  }
  return computeCheckInWindow(ev.date, ev.time);
}

export type CheckInStatus = 'not_open' | 'open' | 'closed';

export function checkInStatus(ev: Parameters<typeof checkInWindow>[0], now = new Date()): CheckInStatus {
  const { opensAt, closesAt } = checkInWindow(ev);
  if (now < opensAt) return 'not_open';
  if (now > closesAt) return 'closed';
  return 'open';
}

/** A check-in event is live once its code word is saved (codeWordSet !== false). */
export const isEventLive = (e: Pick<MeetupEvent, 'codeWordSet'>): boolean => e.codeWordSet !== false;

/** A run is live (shown to runners, reachable by the QR code) once its check-in event and code word exist. */
export function isRunLive(run: Pick<RunEvent, 'id'>, events: MeetupEvent[]): boolean {
  return events.some((e) => e.id === run.id && isEventLive(e));
}

/** Live events whose check-in window is open right now, earliest start first. */
export function openCheckInEvents(events: MeetupEvent[], now = new Date()): MeetupEvent[] {
  return events
    .filter((e) => isEventLive(e) && checkInStatus(e, now) === 'open')
    .sort((a, b) => eventStart(a.date, a.time).getTime() - eventStart(b.date, b.time).getTime());
}

/** The next live event whose check-in hasn't opened yet. */
export function nextCheckInEvent(events: MeetupEvent[], now = new Date()): MeetupEvent | undefined {
  return events
    .filter((e) => isEventLive(e) && checkInStatus(e, now) === 'not_open')
    .sort((a, b) => checkInWindow(a).opensAt.getTime() - checkInWindow(b).opensAt.getTime())[0];
}

/** "Wed, Nov 11 at 4:00 PM" */
export function formatOpening(d: Date): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
}

/** Runs still to come (including today's), soonest first. */
export function upcomingRuns(runs: RunEvent[], now = new Date()): RunEvent[] {
  return runs
    .filter((r) => computeCheckInWindow(r.date, r.time).closesAt >= now)
    .sort((a, b) => eventStart(a.date, a.time).getTime() - eventStart(b.date, b.time).getTime());
}

/** Runs that are over, most recent first. */
export function priorRuns(runs: RunEvent[], now = new Date()): RunEvent[] {
  return runs
    .filter((r) => computeCheckInWindow(r.date, r.time).closesAt < now)
    .sort((a, b) => eventStart(b.date, b.time).getTime() - eventStart(a.date, a.time).getTime());
}
