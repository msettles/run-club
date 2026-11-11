import type { MilestoneAlert, MilestoneReward } from '../types';
import { milestoneMeasure, milestoneTarget } from './milestones';

/** One claimed old name: runs with no sign-in date, and its dated sign-ins. */
export interface ClaimedHistory {
  id: string;
  oldCount: number;
  events: { d: string }[];
}

export interface ClaimGearResult {
  /** The runs milestones to hand out, lowest first. */
  milestones: MilestoneReward[];
  /** The profile treated as already rewarded in full. */
  primaryId: string | undefined;
}

/**
 * Which milestones a runner is owed after claiming old names.
 *
 * Old names were all handed gear in the old app, so the claimed name with the most runs is taken as the
 * runner's main one, with everything up to its count already given. The other claimed names are then
 * added to it, biggest first. Runs on a day an earlier name already signed in are not counted again (the
 * runner signed in twice to one run). Every milestone the running count crosses while adding them is owed,
 * unfulfilled. Only run-count milestones apply: old sign-ins have no mileage.
 */
export function claimGearMilestones(claimed: ClaimedHistory[], milestones: MilestoneReward[]): ClaimGearResult {
  const total = (p: ClaimedHistory) => p.oldCount + p.events.length;
  const ordered = [...claimed].sort((a, b) => total(b) - total(a) || a.id.localeCompare(b.id));
  const [primary, ...others] = ordered;
  if (!primary) return { milestones: [], primaryId: undefined };
  const runsMilestones = milestones.filter((m) => milestoneMeasure(m) === 'runs').sort((a, b) => milestoneTarget(a) - milestoneTarget(b));
  const seenDays = new Set(primary.events.map((e) => e.d));
  let count = total(primary);
  const owed = new Map<number, MilestoneReward>();
  for (const profile of others) {
    // Days are judged against the names counted before this one, not against this name's own repeats.
    const fresh = profile.events.filter((e) => !seenDays.has(e.d)).length;
    const before = count;
    count += profile.oldCount + fresh;
    for (const m of runsMilestones) if (milestoneTarget(m) > before && milestoneTarget(m) <= count) owed.set(milestoneTarget(m), m);
    profile.events.forEach((e) => seenDays.add(e.d));
  }
  return { milestones: [...owed.values()].sort((a, b) => milestoneTarget(a) - milestoneTarget(b)), primaryId: primary.id };
}

/** The unfulfilled gear alerts for those milestones. The id is fixed per milestone, so one is never made twice. */
export function claimGearAlerts(user: { email: string; displayName: string; shirtSize: string }, milestones: MilestoneReward[], now = new Date()): MilestoneAlert[] {
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19);
  return milestones.map((m) => ({
    id: `m${milestoneTarget(m)}_${user.email.toLowerCase()}`, userEmail: user.email.toLowerCase(), runnerName: user.displayName, shirtSize: user.shirtSize,
    milestoneRuns: milestoneTarget(m), milestoneName: m.name, reward: m.reward, perks: m.perks || '', hasGear: m.hasGear !== false, date, time, fulfilled: false,
  }));
}
