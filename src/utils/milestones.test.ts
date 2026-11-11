import { expect, it } from 'vitest';
import { alertsForRoster } from './milestones';
import type { MilestoneAlert } from '../types';

const alert = (id: string, email: string, runId: string, extra: Partial<MilestoneAlert> = {}): MilestoneAlert => ({
  id, userEmail: email, runnerName: email, shirtSize: 'M', milestoneRuns: 50, milestoneName: '50 Runs', reward: 'Hat', perks: '',
  date: '2026-11-04', time: '18:00:00', runId, fulfilled: false, hasGear: true, ...extra,
});

it('a runner who reached 50 without getting the hat is flagged again when they check in at run 51', () => {
  const owed = alert('m50_pat@x.com', 'pat@x.com', 'run-50');
  // Run 51 is a different run; Pat checked in again, so the unhanded hat shows up in this run's list.
  expect(alertsForRoster('run-51', [], [owed], ['PAT@x.com']).map((a) => a.id)).toEqual(['m50_pat@x.com']);
});

it('does not flag gear for runners who are not at this run, handed-out gear, or no-gear milestones', () => {
  const live = [
    alert('m50_pat@x.com', 'pat@x.com', 'run-50'),                                   // owed, but Pat is not here
    alert('m5_sam@x.com', 'sam@x.com', 'run-50', { fulfilled: true }),                // already handed out
    alert('m1_kim@x.com', 'kim@x.com', 'run-1', { hasGear: false, milestoneRuns: 1 }), // welcome only
  ];
  expect(alertsForRoster('run-51', [], live, ['sam@x.com', 'kim@x.com'])).toEqual([]);
});

it('this run\'s own alerts always show, with live updates winning over the loaded copy', () => {
  const loaded = [alert('m5_a@x.com', 'a@x.com', 'run-9')];
  const live = [alert('m5_a@x.com', 'a@x.com', 'run-9', { fulfilled: true })];
  const result = alertsForRoster('run-9', loaded, live, []);
  expect(result).toHaveLength(1);
  expect(result[0].fulfilled).toBe(true);
});
