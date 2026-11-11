import { CLUB_MILESTONES } from '../data/catalog';
import type { MilestoneAlert, MilestoneReward } from '../types';

/** What a milestone is earned by. Milestones without a measure are run-count milestones. */
export const milestoneMeasure = (m: Pick<MilestoneReward, 'measure'>): 'runs' | 'miles' => (m.measure === 'miles' ? 'miles' : 'runs');

/** The total (runs or miles, depending on its measure) a milestone needs. */
export const milestoneTarget = (m: Pick<MilestoneReward, 'measure' | 'runsRequired' | 'milesRequired'>): number =>
  (milestoneMeasure(m) === 'miles' ? m.milesRequired : m.runsRequired) ?? 0;

/** Milestones in earning order: runs first, then miles, each by target. */
export const sortMilestones = (list: MilestoneReward[]): MilestoneReward[] =>
  [...list].sort((a, b) => (milestoneMeasure(a) === milestoneMeasure(b) ? milestoneTarget(a) - milestoneTarget(b) : milestoneMeasure(a) === 'runs' ? -1 : 1));

/**
 * Whether a milestone alert has gear to hand out. A recognition-only milestone (a runner's first run)
 * is shown to organizers so they can welcome the runner, but is never a handout.
 */
export function alertHasGear(alert: Pick<MilestoneAlert, 'hasGear'>): boolean {
  return alert.hasGear !== false;
}

/**
 * Progress toward the next *gear* milestone of one measure (a recognition-only milestone has nothing to work toward),
 * shared by both runner screens. `remaining` is in runs or miles to match the measure.
 */
export function milestoneProgress(total: number, milestones: MilestoneReward[] = CLUB_MILESTONES, measure: 'runs' | 'miles' = 'runs') {
  const gear = sortMilestones(milestones).filter((m) => m.hasGear !== false && milestoneMeasure(m) === measure);
  const nextMilestone = gear.find((m) => milestoneTarget(m) > total) || null;
  const previous = nextMilestone
    ? (gear[gear.indexOf(nextMilestone) - 1] ? milestoneTarget(gear[gear.indexOf(nextMilestone) - 1]) : 0)
    : (gear.length ? milestoneTarget(gear[gear.length - 1]) : 0);
  const span = nextMilestone ? milestoneTarget(nextMilestone) - previous : 1;
  const currentInSpan = nextMilestone ? Math.max(0, total - previous) : span;
  const remaining = nextMilestone ? milestoneTarget(nextMilestone) - total : 0;
  return {
    nextMilestone,
    previousMilestoneRuns: previous,
    runsRemaining: remaining,
    progressPercent: Math.min(100, Math.round((currentInSpan / span) * 100)),
  };
}

/**
 * The milestone alerts an organizer should see for one run: those reached at this run, plus any gear earned at an
 * EARLIER run that has not been handed out yet, for runners who checked in to this run too (so unclaimed gear is
 * raised again the next time that runner shows up). `live` alerts (updated as gear is handed out) win over `loaded`.
 */
export function alertsForRoster(runId: string, loaded: MilestoneAlert[], live: MilestoneAlert[], checkedInEmails: Iterable<string>): MilestoneAlert[] {
  const byId = new Map(loaded.map((a) => [a.id, a]));
  for (const a of live) if (a.runId === runId) byId.set(a.id, a);
  const here = new Set([...checkedInEmails].map((e) => e.toLowerCase()));
  for (const a of live) if (a.runId !== runId && !a.fulfilled && alertHasGear(a) && here.has(a.userEmail.toLowerCase())) byId.set(a.id, a);
  return [...byId.values()];
}
