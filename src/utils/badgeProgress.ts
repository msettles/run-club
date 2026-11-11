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
  const levelUp = (threshold: number, step: number | undefined, count: number, unit: string): BadgeProgress => {
    const size = cfg.isIncremental ? step || threshold : threshold;
    const target = cfg.isIncremental ? Math.max(threshold, (Math.floor(count / size) + 1) * size) : threshold;
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
    case 'streak': {
      const weeks = cfg.streakWeeks || 4;
      const best = Math.max(user.longestStreakWeeks || 0, user.currentStreakWeeks || 0);
      return levelUp(weeks, weeks, earned ? best : Math.min(best, weeks), 'weeks');
    }
    default:
      return null;
  }
}
