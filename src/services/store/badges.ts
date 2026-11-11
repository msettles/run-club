/** Club store operations: badges. */
import {
  Badge,
  SpecialEventDefinition,
  BadgeCategory,
  BadgeTriggerConfig
} from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { cleanFirestoreData } from './helpers';
import { emojiOwners, emojiTakenMessage } from '../../utils/emoji';
import type { StoreState } from './state';

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;

/** `base`, or `base_1`, `base_2`… whichever isn't taken yet. */
function uniqueId(base: string, taken: (id: string) => boolean): string {
  let id = base;
  for (let n = 1; taken(id); n++) id = `${base}_${n}`;
  return id;
}

export function createBadgeOps(ctx: StoreState) {
  const {
    badges,
    setBadges,
    specialEvents,
    setSpecialEvents,
  } = ctx;

  /**
   * Create a new badge (Admin). A special-event badge also gets a special event
   * option (so it shows in the run forms); both are saved together, before the
   * screen shows them. Throws if the server refuses.
   */
  const createBadge = async (badgeData: {
    name: string;
    emoji: string;
    description: string;
    requirement: string;
    category: BadgeCategory;
    isIncremental?: boolean;
    maxMultiplier?: number;
    triggerConfig: BadgeTriggerConfig;
    createSpecialEventOption?: boolean;
  }): Promise<Badge> => {
    const cleanName = badgeData.name.trim();
    const cleanEmoji = badgeData.emoji.trim() || '🏅';
    // No two badges or milestones share an emoji (a special-event badge and its own event option do).
    const taken = emojiTakenMessage(cleanEmoji, emojiOwners(badges, ctx.milestones));
    if (taken) throw new Error(taken);
    const slug = slugify(cleanName);
    const badgeId = uniqueId(`badge_${slug}`, (id) => badges.some((b) => b.id === id));
    const now = new Date().toISOString();

    const newBadge: Badge = {
      id: badgeId,
      name: cleanName,
      emoji: cleanEmoji,
      description: badgeData.description.trim(),
      requirement: badgeData.requirement.trim(),
      category: badgeData.category,
      isIncremental: badgeData.isIncremental ?? false,
      maxMultiplier: badgeData.maxMultiplier,
      triggerConfig: { ...badgeData.triggerConfig },
      isDefault: false,
      createdAt: now,
    };

    let newSE: SpecialEventDefinition | undefined;
    if (badgeData.category === 'special_event' || badgeData.createSpecialEventOption) {
      const seId = uniqueId(badgeData.triggerConfig.specialEventId || slug, (id) => specialEvents.some((se) => se.id === id));
      newBadge.triggerConfig = { ...newBadge.triggerConfig!, specialEventId: seId };
      newSE = {
        id: seId,
        name: cleanName,
        emoji: cleanEmoji,
        badgeId,
        badgeDescription: newBadge.description,
        badgeRequirement: newBadge.requirement,
        isDefault: false,
        createdAt: now,
      };
    }

    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'badges', badgeId), cleanFirestoreData(newBadge));
      if (newSE) batch.set(doc(db, 'special_events', newSE.id), cleanFirestoreData(newSE));
      await batch.commit();
    }

    setBadges((prev) => [...prev, newBadge]);
    if (newSE) {
      const se = newSE;
      setSpecialEvents((prev) => [...prev, se]);
    }
    return newBadge;
  };

  /** Delete a custom badge and its special event option, if any (Admin). Throws if the server refuses. */
  const deleteBadge = async (badgeId: string): Promise<void> => {
    const b = badges.find((x) => x.id === badgeId);
    if (!b || b.isDefault) return;
    const seIds = specialEvents
      .filter((se) => !se.isDefault && (se.badgeId === badgeId || se.id === b.triggerConfig?.specialEventId))
      .map((se) => se.id);
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'badges', badgeId));
      seIds.forEach((id) => batch.delete(doc(db!, 'special_events', id)));
      await batch.commit();
    }
    setBadges((prev) => prev.filter((x) => x.id !== badgeId));
    setSpecialEvents((prev) => prev.filter((se) => !seIds.includes(se.id)));
  };

  return { createBadge, deleteBadge };
}
