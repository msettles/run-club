import { CLUB_MILESTONES } from '../data/catalog';
import type { MilestoneAlert, MilestoneReward } from '../types';

/**
 * Whether a milestone alert has gear to hand out. A recognition-only milestone (a runner's first run)
 * is shown to organizers so they can welcome the runner, but is never a handout.
 */
export function alertHasGear(alert: Pick<MilestoneAlert, 'hasGear'>): boolean {
  return alert.hasGear !== false;
}

/** Progress toward the next *gear* milestone (a recognition-only milestone has nothing to work toward), shared by both runner screens. */
export function milestoneProgress(totalRuns: number, milestones: MilestoneReward[] = CLUB_MILESTONES) {
  const gear = [...milestones].filter((m) => m.hasGear !== false).sort((a, b) => a.runsRequired - b.runsRequired);
  const nextMilestone = gear.find((m) => m.runsRequired > totalRuns) || null;
  const previousMilestoneRuns = nextMilestone
    ? (gear[gear.indexOf(nextMilestone) - 1]?.runsRequired || 0)
    : (gear[gear.length - 1]?.runsRequired || 0);
  const span = nextMilestone ? nextMilestone.runsRequired - previousMilestoneRuns : 1;
  const currentInSpan = nextMilestone ? Math.max(0, totalRuns - previousMilestoneRuns) : span;
  return {
    nextMilestone,
    previousMilestoneRuns,
    runsRemaining: nextMilestone ? nextMilestone.runsRequired - totalRuns : 0,
    progressPercent: Math.min(100, Math.round((currentInSpan / span) * 100)),
  };
}
