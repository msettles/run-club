import { Badge, UserProfile } from '../types';

export interface BadgeProgress {
  current: number;
  target: number;
  unit: string;
}

/**
 * How far a runner is toward a badge's next level, from the stats already on their profile.
 * Returns null where there is nothing meaningful to count (special events, pets, one-off attendance).
 */
export function badgeProgress(badge: Badge, user: UserProfile): BadgeProgress | null {
  const cfg = badge.triggerConfig;
  if (!cfg) return null;
  const earned = user.badgeCounts?.[badge.id] || (user.unlockedBadgeIds?.includes(badge.id) ? 1 : 0);
  // Incremental badges level up every `step`; others have a single threshold.
  const levelUp = (threshold: number, step: number | undefined, count: number, unit: string, incremental = Boolean(cfg.isIncremental)): BadgeProgress => {
    const size = incremental ? step || threshold : threshold;
    const target = incremental ? Math.max(threshold, (Math.floor(count / size) + 1) * size) : threshold;
    return { current: Math.min(count, target), target, unit };
  };
  switch (cfg.type) {
    case 'milestone':
      return levelUp(cfg.minTotalRuns || 1, cfg.step, user.totalRuns, 'runs');
    case 'activity': {
      const count = cfg.activityType === 'walking' ? user.walkCount || 0 : user.runCount || 0;
      return levelUp(cfg.activityCount || 10, cfg.step, count, cfg.activityType === 'walking' ? 'walks' : 'runs');
    }
    case 'distance': {
      const key = (cfg.distanceChoice || cfg.distanceTier || '3.1').toString();
      return levelUp(cfg.distanceCount || 1, cfg.step, user.distanceCounts?.[key] || 0, 'times');
    }
    case 'incremental': {
      const step = Math.max(1, cfg.step || 1);
      const count = cfg.counter === 'pet' ? user.petRunCount || 0 : cfg.counter === 'runs' ? user.runCount || 0 : user.walkCount || 0;
      const unit = cfg.counter === 'pet' ? 'pet check-ins' : cfg.counter === 'runs' ? 'runs' : 'walks';
      return levelUp(step, step, count, unit, true);
    }
    case 'streak': {
      const weeks = cfg.streakWeeks || 4;
      const best = Math.max(user.longestStreakWeeks || 0, user.currentStreakWeeks || 0);
      return levelUp(weeks, weeks, earned ? best : Math.min(best, weeks), 'weeks');
    }
    default:
      return null;
  }
}

/** The ×N level tag for an incremental badge: levels above the display cap show as e.g. "x10+" (10 itself shows "x10"). */
export function levelTag(badge: Pick<Badge, 'maxMultiplier'>, count: number): string {
  const max = badge.maxMultiplier;
  return `x${max && count > max ? `${max}+` : count}`;
}
