import { CLUB_MILESTONES } from '../data/initialData';

/** Progress within the current milestone interval, shared by both runner screens. */
export function milestoneProgress(totalRuns: number) {
  const nextMilestone = CLUB_MILESTONES.find((m) => m.runsRequired > totalRuns) || null;
  const previousMilestoneRuns = nextMilestone
    ? (CLUB_MILESTONES[CLUB_MILESTONES.indexOf(nextMilestone) - 1]?.runsRequired || 0)
    : (CLUB_MILESTONES[CLUB_MILESTONES.length - 1]?.runsRequired || 0);
  const span = nextMilestone ? nextMilestone.runsRequired - previousMilestoneRuns : 1;
  const currentInSpan = nextMilestone ? Math.max(0, totalRuns - previousMilestoneRuns) : span;
  return {
    nextMilestone,
    previousMilestoneRuns,
    runsRemaining: nextMilestone ? nextMilestone.runsRequired - totalRuns : 0,
    progressPercent: Math.min(100, Math.round((currentInSpan / span) * 100)),
  };
}
