import { describe, expect, it } from 'vitest';
import type { CheckInRecord } from '../types';
import { totalsFromCheckins } from './memberTotals';

const checkin = (date: string, extra: Partial<CheckInRecord> = {}): CheckInRecord => ({
  id: `run-${date}_a@example.com`, runId: `run-${date}`, date, time: '18:30:00', userEmail: 'a@example.com', activity: 'running',
  distanceChoice: '3.1', actualMiles: 3.1, source: 'legacy_import', createdAt: `${date}T18:30:00.000Z`, updatedAt: `${date}T18:30:00.000Z`, ...extra,
});

describe('totalsFromCheckins', () => {
  it('counts everything from the check-ins and adds only the uncounted runs to the run total', () => {
    const totals = totalsFromCheckins({ pre2021Runs: 10, legacyEventRuns: 5 }, [
      checkin('2026-10-07'), checkin('2026-10-14', { activity: 'walking', actualMiles: 2 }), checkin('2026-10-21', { withPet: true }),
    ]);
    expect(totals).toMatchObject({ loggedRuns: 3, totalRuns: 18, totalMiles: 8.2, runCount: 2, walkCount: 1, petRunCount: 1, firstRunDate: 'Before 10/2026', lastCheckInDate: '2026-10-21', lastCheckInRunId: 'run-2026-10-21' });
    expect(Object.values(totals.distanceCounts || {}).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });

  it('sets the first run date to month/year of the oldest check-in, or "Before mm/yyyy" of when records begin when some runs have no record', () => {
    const rows = [checkin('2026-10-07'), checkin('2026-10-14')];
    expect(totalsFromCheckins({ pre2021Runs: 0 }, rows).firstRunDate).toBe('10/2026');
    expect(totalsFromCheckins({ pre2021Runs: 0 }, rows, ['2022-02-02']).firstRunDate).toBe('02/2022');
    expect(totalsFromCheckins({ pre2021Runs: 4 }, rows, ['2022-02-02'], '2021-01-06').firstRunDate).toBe('Before 01/2021');
  });

  it('gives the same answer however often it runs', () => {
    const rows = [checkin('2026-10-07'), checkin('2026-10-14')];
    expect(totalsFromCheckins({ pre2021Runs: 0 }, rows)).toEqual(totalsFromCheckins({ pre2021Runs: 0 }, [...rows].reverse()));
  });

  it('keeps what it cannot know when there are no check-ins', () => {
    expect(totalsFromCheckins({ pre2021Runs: 0, firstRunDate: '2019-01-02' }, [])).toMatchObject({ loggedRuns: 0, totalRuns: 0, totalMiles: 0, firstRunDate: '2019-01-02' });
    expect(totalsFromCheckins({ pre2021Runs: 7 }, [])).toMatchObject({ loggedRuns: 0, totalRuns: 7, totalMiles: 0, firstRunDate: 'Before check-ins began' });
  });
});
