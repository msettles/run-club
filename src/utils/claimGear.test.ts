import { describe, expect, it } from 'vitest';
import type { MilestoneReward } from '../types';
import { claimGearAlerts, claimGearMilestones } from './claimGear';

const m = (runs: number, extra: Partial<MilestoneReward> = {}): MilestoneReward => ({ id: `milestone-${runs}`, runsRequired: runs, name: `M${runs}`, reward: `R${runs}`, icon: '🏅', ...extra } as MilestoneReward);
const MILESTONES = [m(1, { hasGear: false }), m(5), m(10), m(25), m(50), m(100)];
const days = (...d: string[]) => d.map((x) => ({ d: x }));
const many = (n: number, prefix = '2022-') => Array.from({ length: n }, (_, i) => ({ d: `${prefix}${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}` }));
const targets = (r: ReturnType<typeof claimGearMilestones>) => r.milestones.map((x) => x.runsRequired);

describe('claimGearMilestones', () => {
  it('owes nothing for a single claimed name: its gear was handed out in the old app', () => {
    expect(claimGearMilestones([{ id: 'a', oldCount: 40, events: many(30) }], MILESTONES).milestones).toEqual([]);
  });

  it('takes the biggest name as the main one and owes the milestones crossed by adding the others', () => {
    const r = claimGearMilestones([{ id: 'small', oldCount: 0, events: many(20, '2023-') }, { id: 'big', oldCount: 30, events: many(15) }], MILESTONES);
    expect(r.primaryId).toBe('big'); // 45 runs, already rewarded up to 45
    expect(targets(r)).toEqual([50]); // adding 20 takes 45 to 65: 50 is crossed, 100 is not
  });

  it('does not count a run twice when two names signed in on the same day', () => {
    const shared = days('2022-03-02', '2022-03-09', '2022-03-16');
    // 50 runs; the other name signed in to the same three runs, so nothing is added.
    expect(targets(claimGearMilestones([{ id: 'big', oldCount: 47, events: shared }, { id: 'dup', oldCount: 0, events: shared }], MILESTONES))).toEqual([]);
    // 49 runs; the other name has the same three days plus one new one: 49 -> 50 crosses the 50 milestone.
    const r = claimGearMilestones([{ id: 'big', oldCount: 46, events: shared }, { id: 'dup', oldCount: 0, events: [...shared, { d: '2022-03-23' }] }], MILESTONES);
    expect(r.primaryId).toBe('big');
    expect(targets(r)).toEqual([50]);
    // Without the day check the same three repeats would have taken 49 to 52 and crossed it too, so the check matters:
    expect(targets(claimGearMilestones([{ id: 'big', oldCount: 46, events: shared }, { id: 'dup', oldCount: 0, events: shared }], MILESTONES))).toEqual([]);
  });

  it('counts runs with no sign-in date, which cannot be matched to a day', () => {
    const r = claimGearMilestones([{ id: 'big', oldCount: 20, events: days('2022-01-05') }, { id: 'old', oldCount: 6, events: [] }], MILESTONES);
    expect(targets(r)).toEqual([25]); // 21 -> 27
  });

  it('adds names biggest first and owes every milestone on the way', () => {
    const r = claimGearMilestones([
      { id: 'c', oldCount: 4, events: [] }, { id: 'a', oldCount: 20, events: [] }, { id: 'b', oldCount: 8, events: [] },
    ], MILESTONES);
    // a (20) is main; add b: 20 -> 28 crosses 25; add c: 28 -> 32 crosses nothing.
    expect(r.primaryId).toBe('a');
    expect(targets(r)).toEqual([25]);
  });

  it('only owes run-count milestones', () => {
    const r = claimGearMilestones([{ id: 'a', oldCount: 4, events: [] }, { id: 'b', oldCount: 3, events: [] }], [m(5), { id: 'milestone-miles-10', measure: 'miles', milesRequired: 10, name: 'Miles', reward: 'x', icon: '🏅' } as MilestoneReward]);
    expect(targets(r)).toEqual([5]);
  });

  it('is empty when nothing is claimed', () => {
    expect(claimGearMilestones([], MILESTONES)).toEqual({ milestones: [], primaryId: undefined });
  });
});

describe('claimGearAlerts', () => {
  it('makes one unfulfilled alert per milestone with a fixed id', () => {
    const [alert] = claimGearAlerts({ email: 'A@Example.com', displayName: 'Ann', shirtSize: 'M' }, [m(25), m(50)], new Date('2026-11-11T19:30:05Z'));
    expect(alert).toMatchObject({ id: 'm25_a@example.com', userEmail: 'a@example.com', milestoneRuns: 25, milestoneName: 'M25', reward: 'R25', fulfilled: false, hasGear: true, date: '2026-11-11', time: '19:30:05' });
    expect(alert.runId).toBeUndefined();
  });

  it('keeps recognition-only milestones as such', () => {
    expect(claimGearAlerts({ email: 'a@x.com', displayName: 'A', shirtSize: 'M' }, [m(1, { hasGear: false })])[0].hasGear).toBe(false);
  });
});
