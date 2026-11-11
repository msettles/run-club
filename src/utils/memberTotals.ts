import type { CheckInRecord, UserProfile } from '../types';
import { adjustDistanceCounts, lastCheckInFields } from './legacy';

type Totals = Pick<UserProfile, 'loggedRuns' | 'totalRuns' | 'totalMiles' | 'runCount' | 'walkCount' | 'petRunCount' | 'distanceCounts' | 'firstRunDate' | 'lastCheckInDate' | 'lastCheckInRunId' | 'lastCheckInUpdatedAt'>;

/**
 * A member's totals, rebuilt from their check-ins alone.
 *
 * Runs with no check-in record (`pre2021Runs`) and claimed old sign-ins (`legacyEventRuns`) are kept
 * as they are and only added to the run total. Everything else is counted from the check-ins, so the
 * result is the same whether the history was imported, claimed or checked in live.
 */
export function totalsFromCheckins(user: Pick<UserProfile, 'pre2021Runs' | 'legacyEventRuns' | 'firstRunDate' | 'lastCheckInUpdatedAt'>, checkins: CheckInRecord[]): Totals {
  let miles = 0;
  let runCount = 0;
  let walkCount = 0;
  let petRunCount = 0;
  let distanceCounts: Record<string, number> = {};
  for (const c of checkins) {
    miles += c.actualMiles || 0;
    if (c.activity === 'running') runCount++;
    if (c.activity === 'walking') walkCount++;
    if (c.withPet) petRunCount++;
    distanceCounts = adjustDistanceCounts(distanceCounts, c.actualMiles || 0, 1);
  }
  const dates = checkins.map((c) => c.date).sort();
  const latest = checkins.map((c) => c.updatedAt || c.createdAt).sort().pop();
  return {
    loggedRuns: checkins.length,
    totalRuns: (user.pre2021Runs || 0) + (user.legacyEventRuns || 0) + checkins.length,
    totalMiles: Math.round(miles * 100) / 100,
    runCount, walkCount, petRunCount, distanceCounts,
    ...(dates.length ? { firstRunDate: dates[0] } : user.firstRunDate ? { firstRunDate: user.firstRunDate } : {}),
    ...lastCheckInFields(checkins),
    ...(latest ? { lastCheckInUpdatedAt: latest } : user.lastCheckInUpdatedAt ? { lastCheckInUpdatedAt: user.lastCheckInUpdatedAt } : {}),
  };
}
