import type { Badge, MilestoneReward } from '../types';

/** Compare emoji ignoring the invisible variation selector some keyboards add. */
export const emojiKey = (emoji: string): string => emoji.replace(/️/g, '').trim();

/**
 * Which badge or milestone already uses each emoji, so no two look alike.
 * (A special-event badge and its event option share an emoji by design, so special events aren't counted.)
 * `ignoreId` skips the item being edited.
 */
export function emojiOwners(badges: Pick<Badge, 'id' | 'name' | 'emoji'>[], milestones: Pick<MilestoneReward, 'id' | 'name' | 'icon'>[], ignoreId?: string): Map<string, string> {
  const owners = new Map<string, string>();
  for (const b of badges) if (b.id !== ignoreId && b.emoji) owners.set(emojiKey(b.emoji), `the ${b.name} badge`);
  for (const m of milestones) if (m.id !== ignoreId && m.icon) owners.set(emojiKey(m.icon), `the ${m.name} milestone`);
  return owners;
}

/** An error message if `emoji` is already taken, otherwise undefined. */
export function emojiTakenMessage(emoji: string, owners: Map<string, string>): string | undefined {
  const owner = owners.get(emojiKey(emoji));
  return owner ? `${emoji} is already used by ${owner}. Pick a different emoji.` : undefined;
}
