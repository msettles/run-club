/** Club store operations: badges. */
import { 
  Badge, 
  SpecialEventDefinition,
  BadgeCategory,
  BadgeTriggerConfig
} from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import {
  setDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';
import type { createPrivateSyncOps } from './privateSync';
import type { createMemberOps } from './members';
import type { createCheckInOps } from './checkIn';
import type { createEventOps } from './events';

export function createBadgeOps(ctx: StoreState & ReturnType<typeof createLegacyOps> & ReturnType<typeof createPrivateSyncOps> & ReturnType<typeof createMemberOps> & ReturnType<typeof createCheckInOps> & ReturnType<typeof createEventOps>) {
  const {
    badges,
    setBadges,
    specialEvents,
    setSpecialEvents,
  } = ctx;

  /**
   * Create a new badge (Admin) - supports Milestones, Activity (Walk/Run), Distance (1/3/5), Special Events, Streaks
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
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;
    
    let uniqueId = `badge_${baseSlug}`;
    let counter = 1;
    while (badges.some((b) => b.id === uniqueId)) {
      uniqueId = `badge_${baseSlug}_${counter++}`;
    }

    const newBadge: Badge = {
      id: uniqueId,
      name: cleanName,
      emoji: cleanEmoji,
      description: badgeData.description.trim(),
      requirement: badgeData.requirement.trim(),
      category: badgeData.category,
      isIncremental: badgeData.isIncremental ?? false,
      maxMultiplier: badgeData.maxMultiplier,
      triggerConfig: badgeData.triggerConfig,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    // If it's a special event badge, also add a SpecialEventDefinition so it shows in event creator dropdowns
    if (badgeData.category === 'special_event' || badgeData.createSpecialEventOption) {
      let seId = badgeData.triggerConfig.specialEventId || baseSlug;
      if (specialEvents.some((se) => se.id === seId)) {
        seId = `${baseSlug}_${counter}`;
      }
      const newSE: SpecialEventDefinition = {
        id: seId,
        name: cleanName,
        emoji: cleanEmoji,
        badgeId: uniqueId,
        badgeDescription: newBadge.description,
        badgeRequirement: newBadge.requirement,
        isDefault: false,
        createdAt: new Date().toISOString(),
      };
      if (newBadge.triggerConfig) {
        newBadge.triggerConfig.specialEventId = seId;
      }
      setSpecialEvents((prev) => [...prev, newSE]);
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'special_events', seId), newSE);
        } catch (e) {
          console.warn('Firebase SE save error:', e);
        }
      }
    }

    setBadges((prev) => [...prev, newBadge]);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'badges', uniqueId), newBadge);
      } catch (e) {
        console.warn('Firebase badge save error:', e);
      }
    }

    return newBadge;
  };

  /**
   * Delete a custom badge (Admin)
   */
  const deleteBadge = async (badgeId: string): Promise<void> => {
    const b = badges.find((x) => x.id === badgeId);
    if (!b) return;
    if (b.isDefault) {
      console.warn('Cannot delete default club badge');
      return;
    }
    setBadges((prev) => prev.filter((x) => x.id !== badgeId));
    if (b.triggerConfig?.specialEventId) {
      setSpecialEvents((prev) => prev.filter((se) => se.id !== b.triggerConfig?.specialEventId && se.badgeId !== badgeId));
    }
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'badges', badgeId));
        if (b.triggerConfig?.specialEventId) {
          await deleteDoc(doc(db, 'special_events', b.triggerConfig.specialEventId));
        }
      } catch (e) {
        console.warn('Firebase badge delete error:', e);
      }
    }
  };

  /**
   * Create a special event directly (Admin)
   */
  const createSpecialEvent = async (name: string, emoji: string, description?: string): Promise<SpecialEventDefinition> => {
    const cleanName = name.trim();
    const cleanEmoji = emoji.trim() || '🏅';
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;
    let uniqueId = baseSlug;
    let counter = 1;
    while (specialEvents.some((se) => se.id === uniqueId)) {
      uniqueId = `${baseSlug}_${counter++}`;
    }

    const badgeId = `special-${uniqueId}`;
    const badge = await createBadge({
      name: `${cleanName} Veteran`,
      emoji: cleanEmoji,
      description: description?.trim() || `Ran the annual ${cleanName} with the Woodchuckers!`,
      requirement: `Attended ${cleanName}`,
      category: 'special_event',
      isIncremental: true,
      triggerConfig: {
        type: 'special_event',
        specialEventId: uniqueId,
        isIncremental: true,
        step: 1,
      },
      createSpecialEventOption: false,
    });

    const newSE: SpecialEventDefinition = {
      id: uniqueId,
      name: cleanName,
      emoji: cleanEmoji,
      badgeId,
      badgeDescription: badge.description,
      badgeRequirement: badge.requirement,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    setSpecialEvents((prev) => {
      if (prev.some((se) => se.id === uniqueId)) return prev;
      return [...prev, newSE];
    });

    return newSE;
  };

  /**
   * Delete a custom special event (Admin)
   */
  const deleteSpecialEvent = async (eventId: string): Promise<void> => {
    const se = specialEvents.find((x) => x.id === eventId);
    if (!se || se.isDefault) return;
    setSpecialEvents((prev) => prev.filter((x) => x.id !== eventId));
    setBadges((prev) => prev.filter((b) => b.id !== se.badgeId));
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'special_events', eventId));
        await deleteDoc(doc(db, 'badges', se.badgeId));
      } catch (e) {
        console.warn('Firebase SE delete error:', e);
      }
    }
  };


  return { createBadge, deleteBadge, createSpecialEvent, deleteSpecialEvent };
}
