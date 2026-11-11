/** Club store operations: milestones (gear tiers). Separate from badges. */
import type { MilestoneReward } from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import { deleteDoc, doc, setDoc, writeBatch } from 'firebase/firestore';
import { cleanFirestoreData } from './helpers';
import { emojiOwners, emojiTakenMessage } from '../../utils/emoji';
import { milestoneMeasure, milestoneTarget, sortMilestones } from '../../utils/milestones';
import type { StoreState } from './state';
import type { createCatalogOps } from './catalog';

export function createMilestoneOps(ctx: StoreState & ReturnType<typeof createCatalogOps>) {
  const { milestones, setMilestones } = ctx;

  /**
   * Create a milestone (Admin). `gear` is what gets handed out; leave it blank for a
   * recognition-only milestone (organizers see it, nothing to hand out).
   * A milestone is earned by total runs or total miles; each target can be a milestone only once per measure,
   * because a runner's alert is keyed by it. Miles are tracked from app check-ins only.
   */
  const createMilestone = async (data: {
    name: string;
    /** What earns it: total runs (default) or total miles. */
    measure?: 'runs' | 'miles';
    /** The runs or miles needed (whole number). */
    target: number;
    icon: string;
    description: string;
    gear: string;
    perks?: string;
  }): Promise<MilestoneReward> => {
    const name = data.name.trim();
    const measure = data.measure === 'miles' ? 'miles' : 'runs';
    const target = Math.floor(Number(data.target));
    const unit = measure === 'miles' ? 'mile' : 'run';
    if (!name) throw new Error('Give the milestone a name.');
    if (!Number.isFinite(target) || target < 1 || target > 100000) throw new Error(`${measure === 'miles' ? 'Miles' : 'Runs'} required must be a whole number of 1 or more.`);
    if (milestones.some((m) => milestoneMeasure(m) === measure && milestoneTarget(m) === target)) throw new Error(`There is already a milestone at ${target} ${unit}${target === 1 ? '' : 's'}.`);
    const gear = data.gear.trim();
    const icon = data.icon.trim() || (measure === 'miles' ? '📏' : '🏆');
    const taken = emojiTakenMessage(icon, emojiOwners(ctx.badges, milestones));
    if (taken) throw new Error(taken);
    const milestone: MilestoneReward = {
      id: measure === 'miles' ? `milestone-miles-${target}` : `milestone-${target}`,
      measure,
      ...(measure === 'miles' ? { milesRequired: target } : { runsRequired: target }),
      name,
      reward: gear || name,
      perks: (data.perks || '').trim(),
      icon,
      description: data.description.trim(),
      hasGear: Boolean(gear),
      createdAt: new Date().toISOString(),
    };
    if (isFirebaseConfigured && db) await setDoc(doc(db, 'milestones', milestone.id), cleanFirestoreData(milestone));
    setMilestones((prev) => sortMilestones([...prev, milestone]));
    return milestone;
  };

  /**
   * Edit a milestone (Admin): any milestone, including ones from the starter pack. Changing what earns it
   * (the measure or the target) gives it a new id, since an id is built from its target.
   */
  const updateMilestone = async (id: string, data: {
    name: string;
    measure?: 'runs' | 'miles';
    target: number;
    icon: string;
    description: string;
    gear: string;
    perks?: string;
  }): Promise<MilestoneReward> => {
    await ctx.ensureCatalogSeeded();
    const existing = milestones.find((m) => m.id === id);
    if (!existing) throw new Error('That milestone no longer exists.');
    const name = data.name.trim();
    const measure = data.measure === 'miles' ? 'miles' : 'runs';
    const target = Math.floor(Number(data.target));
    const unit = measure === 'miles' ? 'mile' : 'run';
    if (!name) throw new Error('Give the milestone a name.');
    if (!Number.isFinite(target) || target < 1 || target > 100000) throw new Error(`${measure === 'miles' ? 'Miles' : 'Runs'} required must be a whole number of 1 or more.`);
    if (milestones.some((m) => m.id !== id && milestoneMeasure(m) === measure && milestoneTarget(m) === target)) throw new Error(`There is already a milestone at ${target} ${unit}${target === 1 ? '' : 's'}.`);
    const gear = data.gear.trim();
    const icon = data.icon.trim() || existing.icon || (measure === 'miles' ? '📏' : '🏆');
    const taken = emojiTakenMessage(icon, emojiOwners(ctx.badges, milestones, id));
    if (taken) throw new Error(taken);
    const newId = measure === 'miles' ? `milestone-miles-${target}` : `milestone-${target}`;
    const { runsRequired: _r, milesRequired: _m, ...rest } = existing;
    const updated: MilestoneReward = {
      ...rest,
      id: newId,
      measure,
      ...(measure === 'miles' ? { milesRequired: target } : { runsRequired: target }),
      name,
      reward: gear || name,
      perks: (data.perks || '').trim(),
      icon,
      description: data.description.trim(),
      hasGear: Boolean(gear),
    };
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      if (newId !== id) batch.delete(doc(db, 'milestones', id));
      batch.set(doc(db, 'milestones', newId), cleanFirestoreData(updated));
      await batch.commit();
    }
    setMilestones((prev) => sortMilestones([...prev.filter((m) => m.id !== id), updated]));
    return updated;
  };

  /** Delete a milestone (Admin): any milestone, including ones from the starter pack. Gear alerts already created are kept. */
  const deleteMilestone = async (id: string): Promise<void> => {
    await ctx.ensureCatalogSeeded();
    if (!milestones.some((x) => x.id === id)) return;
    if (isFirebaseConfigured && db) await deleteDoc(doc(db, 'milestones', id));
    setMilestones((prev) => prev.filter((x) => x.id !== id));
  };

  return { createMilestone, updateMilestone, deleteMilestone };
}
