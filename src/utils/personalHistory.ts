import type { CheckInRecord, MeetupEvent, RunEvent } from '../types';
import type { LegacyEvent } from './legacy';
import { historicalRunKey, uniqueHistoricalAttendance } from './attendanceIdentity';
export interface PersonalHistoryRow {
  id: string; runId?: string; title: string; date: string; time?: string;
  source: 'app' | 'assisted' | 'legacy'; routeName?: string; routeId?: string; routeChoice?: string;
  miles?: number; loops?: number; activity?: string; withPet?: boolean;
}
/** App attendance wins over claimed history; aliases sharing one canonical run appear once. */
export function personalHistoryRows(checkins: CheckInRecord[], legacy: LegacyEvent[], runs: RunEvent[], events: MeetupEvent[]): PersonalHistoryRow[] {
  const titles = new Map(runs.map((r) => [r.id, r.title]));
  const meetups = new Map(events.map((e) => [e.id, e]));
  const app = checkins.map((c): PersonalHistoryRow => ({ id: c.id, runId: c.runId, title: c.eventTitle || titles.get(c.runId || '') || 'Club run',
    date: c.date, time: c.time, source: c.source === 'legacy_import' ? 'legacy' : c.source === 'admin' ? 'assisted' : 'app',
    routeName: c.routeName, routeChoice: String(c.distanceChoice), routeId: meetups.get(c.runId || '')?.routes[String(c.distanceChoice)]?.routeId,
    miles: c.actualMiles, loops: c.loops, activity: c.activity, withPet: c.withPet }));
  const old = uniqueHistoricalAttendance(legacy, checkins).map((e): PersonalHistoryRow => ({
    id: historicalRunKey(e), runId: e.r, date: e.d, time: e.t || undefined,
    title: titles.get(e.r || '') || 'Historical club run', source: 'legacy',
  }));
  return [...app, ...old].sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || a.id.localeCompare(b.id));
}
