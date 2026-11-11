import { expect, it } from 'vitest';
import { badgeFormFromBadge } from './badgeForm';
import { INITIAL_BADGES } from '../data/catalog';
import type { Badge } from '../types';

const find = (id: string) => INITIAL_BADGES.find((b) => b.id === id)!;

it('loads every starter badge into the edit form with its rule', () => {
  expect(badgeFormFromBadge(find('power-walker'))).toMatchObject({ category: 'incremental', counter: 'walks', step: 10, maxDisplay: '' });
  expect(badgeFormFromBadge(find('pet-runner'))).toMatchObject({ category: 'incremental', counter: 'pet', step: 1, maxDisplay: '10' });
  expect(badgeFormFromBadge(find('streak-4'))).toMatchObject({ category: 'streak', streakWeeks: 4, incremental: true });
  expect(badgeFormFromBadge(find('special-turkey'))).toMatchObject({ category: 'special_event', specialSlug: 'turkey_trot' });
});

it('older walk/run and pet badges open as Incremental', () => {
  const base = { id: 'x', name: 'X', emoji: '🏅', description: 'd', requirement: 'r' } as Badge;
  expect(badgeFormFromBadge({ ...base, triggerConfig: { type: 'activity', activityType: 'running', activityCount: 25, step: 25 } })).toMatchObject({ category: 'incremental', counter: 'runs', step: 25 });
  expect(badgeFormFromBadge({ ...base, triggerConfig: { type: 'pet', step: 1 } })).toMatchObject({ category: 'incremental', counter: 'pet', step: 1 });
  expect(badgeFormFromBadge({ ...base, triggerConfig: { type: 'distance', distanceTier: '5', distanceCount: 3 } })).toMatchObject({ category: 'distance', distanceChoice: '5', distanceThreshold: 3 });
});
