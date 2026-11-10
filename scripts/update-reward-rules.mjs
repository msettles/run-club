/** Synchronize the built-in reward defaults used by Firestore authorization. */
import { readFileSync, writeFileSync } from 'node:fs';
import { INITIAL_BADGES } from '../src/data/catalog.ts';
const fields = new Set(['type', 'minTotalRuns', 'isIncremental', 'step', 'activityType', 'activityCount', 'distanceChoice', 'distanceTier', 'distanceCount', 'streakWeeks', 'specialEventId']);
const choices = INITIAL_BADGES.filter((badge) => badge.triggerConfig).map((badge) => {
  const config = Object.fromEntries(Object.entries(badge.triggerConfig).filter(([key]) => fields.has(key)));
  return `id == ${JSON.stringify(badge.id)} ? ${JSON.stringify(config)}`;
});
const block = `    function builtinBadgeConfig(id) {\n      return ${choices.join(' :\n        ')} : {};\n    }\n`;
const path = new URL('../firestore.rules', import.meta.url);
const source = readFileSync(path, 'utf8');
const start = source.indexOf('    function builtinBadgeConfig(id) {');
const end = source.indexOf('    function badgeConfig(id)', start);
if (start < 0 || end < 0) throw new Error('Reward defaults marker missing');
writeFileSync(path, source.slice(0, start) + block + source.slice(end));
console.log('Synchronized built-in reward authorization defaults.');
