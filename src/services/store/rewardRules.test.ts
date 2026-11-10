import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { INITIAL_BADGES } from '../../data/catalog';

it('keeps built-in Firestore reward eligibility synchronized with the application catalog', () => {
  const fields = ['type', 'minTotalRuns', 'isIncremental', 'step', 'activityType', 'activityCount', 'distanceChoice', 'distanceTier', 'distanceCount', 'streakWeeks', 'specialEventId'];
  const rules = readFileSync('firestore.rules', 'utf8');
  const block = rules.slice(rules.indexOf('    function builtinBadgeConfig'), rules.indexOf('    function badgeConfig'));
  const actual = Object.fromEntries([...block.matchAll(/id == ("[^"]+") \? (\{[^}]+\})/g)].map((match) => [JSON.parse(match[1]), JSON.parse(match[2])]));
  const expected = Object.fromEntries(INITIAL_BADGES.filter((badge) => badge.triggerConfig).map((badge) => [badge.id,
    Object.fromEntries(Object.entries(badge.triggerConfig!).filter(([key]) => fields.includes(key)))]));
  expect(actual, 'Run npm run sync:reward-rules after editing built-in badge triggers').toEqual(expected);
});
