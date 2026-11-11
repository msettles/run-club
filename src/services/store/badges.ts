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
import type { createCatalogOps } from './catalog';

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;

/** `base`, or `base_1`, `base_2`… whichever isn't taken yet. */
function uniqueId(base: string, taken: (id: string) => boolean): string {
  let id = base;
  for (let n = 1; taken(id); n++) id = `${base}_${n}`;
  return id;
}

export function createBadgeOps(ctx: StoreState & ReturnType<typeof createCatalogOps>) {
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

  /**
   * Edit a badge (Admin): any badge, including ones from the starter pack. A special-event badge keeps its event id
   * (so past attendance still counts) and its event option's name, emoji and wording follow the badge.
   */
  const updateBadge = async (badgeId: string, badgeData: {
    name: string;
    emoji: string;
    description: string;
    requirement: string;
    category: BadgeCategory;
    isIncremental?: boolean;
    maxMultiplier?: number;
    triggerConfig: BadgeTriggerConfig;
  }): Promise<Badge> => {
    await ctx.ensureCatalogSeeded();
    const existing = badges.find((b) => b.id === badgeId);
    if (!existing) throw new Error('That badge no longer exists.');
    const name = badgeData.name.trim();
    const emoji = badgeData.emoji.trim() || '🏅';
    if (!name) throw new Error('Give the badge a name.');
    const taken = emojiTakenMessage(emoji, emojiOwners(badges, ctx.milestones, badgeId));
    if (taken) throw new Error(taken);

    const triggerConfig = { ...badgeData.triggerConfig };
    // A special-event badge keeps the event it was tied to.
    if (existing.triggerConfig?.specialEventId && badgeData.category === 'special_event') triggerConfig.specialEventId = existing.triggerConfig.specialEventId;
    const updated: Badge = {
      ...existing,
      name,
      emoji,
      description: badgeData.description.trim(),
      requirement: badgeData.requirement.trim(),
      category: badgeData.category,
      isIncremental: badgeData.isIncremental ?? false,
      maxMultiplier: badgeData.maxMultiplier,
      triggerConfig,
    };
    const event = specialEvents.find((se) => se.badgeId === badgeId || se.id === existing.triggerConfig?.specialEventId);
    const updatedEvent: SpecialEventDefinition | undefined = event
      ? { ...event, name, emoji, badgeDescription: updated.description, badgeRequirement: updated.requirement }
      : undefined;

    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'badges', badgeId), cleanFirestoreData(updated));
      if (updatedEvent) batch.set(doc(db, 'special_events', updatedEvent.id), cleanFirestoreData(updatedEvent));
      await batch.commit();
    }
    setBadges((prev) => [...prev.filter((b) => b.id !== badgeId), updated]);
    if (updatedEvent) setSpecialEvents((prev) => [...prev.filter((se) => se.id !== updatedEvent.id), updatedEvent]);
    return updated;
  };

  /**
   * Delete a badge and its special event option, if any (Admin): any badge, including ones from the starter pack.
   * Runners who already earned it keep their record, but it no longer shows or counts.
   */
  const deleteBadge = async (badgeId: string): Promise<void> => {
    await ctx.ensureCatalogSeeded();
    const b = badges.find((x) => x.id === badgeId);
    if (!b) return;
    const seIds = specialEvents
      .filter((se) => se.badgeId === badgeId || se.id === b.triggerConfig?.specialEventId)
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

  return { createBadge, updateBadge, deleteBadge };
}
