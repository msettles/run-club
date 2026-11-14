import type { CheckInRecord } from '../types';

export interface HistoricalAttendance { d: string; c?: string; r?: string }
export const ATTENDANCE_POLICY_VERSION = 2;
export const historicalRunKey = (event: HistoricalAttendance): string => event.r ? `run:${event.r}` : `date:${event.d}`;
export function attendanceKeyResolver(context: HistoricalAttendance[]) {
  const known = new Map<string, Set<string>>();
  for (const e of context) if (e.r) {
    const fallback = historicalRunKey({ d: e.d });
    if (!known.has(fallback)) known.set(fallback, new Set());
    known.get(fallback)!.add(`run:${e.r}`);
  }
  return (event: HistoricalAttendance): string => {
    const key = historicalRunKey(event), candidates = known.get(key);
    if (!event.r && candidates && candidates.size > 1) throw new Error(`Several runs share ${event.d}. Historical attendance needs an explicit Run ID.`);
    return !event.r && candidates?.size === 1 ? [...candidates][0] : key;
  };
}
export const historicalRunKeys = (events: HistoricalAttendance[], context = events): string[] => [...new Set(events.map(attendanceKeyResolver(context)))].sort();
export const appAttendanceKeys = (checkins: CheckInRecord[]): string[] => [...new Set(checkins.map(c => historicalRunKey({d:c.date,r:c.runId})))].sort();

/** Dated legacy contribution only; undated credits are deliberately outside this calculation. */
export function legacyAttendanceCredit(legacyRunKeys: string[], appRunKeys: string[]): number {
  const app = new Set(appRunKeys);
  return new Set(legacyRunKeys.filter(key => !app.has(key))).size;
}

export function uniqueHistoricalAttendance<T extends HistoricalAttendance>(events: T[], checkins: CheckInRecord[] = []): T[] {
  const resolve = attendanceKeyResolver([...events, ...checkins.map(c => ({ d: c.date, r: c.runId }))]);
  const seen = new Set(appAttendanceKeys(checkins));
  return events.filter(event => {
    const key = resolve(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
