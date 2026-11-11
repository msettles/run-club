import type { Badge, BadgeCategory, DistanceChoice, IncrementalCounter } from '../types';

/** The admin badge form's fields for an existing badge, so any badge (starter or custom) can be edited. */
export interface BadgeFormValues {
  name: string;
  emoji: string;
  description: string;
  requirement: string;
  category: BadgeCategory;
  incremental: boolean;
  counter: IncrementalCounter;
  step: number;
  maxDisplay: string;
  specialSlug: string;
  distanceChoice: DistanceChoice;
  distanceThreshold: number;
  streakWeeks: number;
}

export function badgeFormFromBadge(b: Badge): BadgeFormValues {
  const cfg = b.triggerConfig;
  const type = cfg?.type;
  const base: BadgeFormValues = {
    name: b.name, emoji: b.emoji, description: b.description, requirement: b.requirement,
    category: 'attendance', incremental: Boolean(b.isIncremental), counter: 'walks', step: 10,
    maxDisplay: b.maxMultiplier ? String(b.maxMultiplier) : '', specialSlug: '', distanceChoice: '3.1', distanceThreshold: 10, streakWeeks: 4,
  };
  if (type === 'incremental' || type === 'activity' || type === 'pet') {
    // Older walk/run and pet badges are edited as the one Incremental kind.
    const counter: IncrementalCounter = type === 'incremental' ? (cfg?.counter || 'walks') : type === 'pet' ? 'pet' : cfg?.activityType === 'running' ? 'runs' : 'walks';
    return { ...base, category: 'incremental', counter, step: cfg?.step || cfg?.activityCount || 1 };
  }
  if (type === 'special_event') return { ...base, category: 'special_event', specialSlug: cfg?.specialEventId || '' };
  if (type === 'distance') return { ...base, category: 'distance', distanceChoice: (cfg?.distanceChoice || cfg?.distanceTier || '3.1') as DistanceChoice, distanceThreshold: cfg?.distanceCount || 10 };
  if (type === 'streak') return { ...base, category: 'streak', streakWeeks: cfg?.streakWeeks || 4 };
  return base;
}
