import { expect, it } from 'vitest';
import { emojiOwners, emojiTakenMessage } from './emoji';
import { INITIAL_BADGES, CLUB_MILESTONES } from '../data/catalog';

it('the built-in badges and milestones never share an emoji', () => {
  const all = [...INITIAL_BADGES.map((b) => b.emoji), ...CLUB_MILESTONES.map((m) => m.icon)].map((e) => e.replace(/\uFE0F/g, ''));
  expect(new Set(all).size).toBe(all.length);
});

it('reports who already uses an emoji, and lets an item keep its own', () => {
  const owners = emojiOwners(INITIAL_BADGES, CLUB_MILESTONES);
  expect(emojiTakenMessage('🔥', owners)).toContain('Burrow Regular');
  expect(emojiTakenMessage('🧦', owners)).toBeUndefined();
  expect(emojiTakenMessage('🔥', emojiOwners(INITIAL_BADGES, CLUB_MILESTONES, 'streak-4'))).toBeUndefined();
});
