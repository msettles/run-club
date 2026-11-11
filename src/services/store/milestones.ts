/** Club store operations: milestones (gear tiers). Separate from badges. */
import type { MilestoneReward } from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { cleanFirestoreData } from './helpers';
import { emojiOwners, emojiTakenMessage } from '../../utils/emoji';
import { milestoneMeasure, milestoneTarget, sortMilestones } from '../../utils/milestones';
import type { StoreState } from './state';

export function createMilestoneOps(ctx: StoreState) {
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
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    if (isFirebaseConfigured && db) await setDoc(doc(db, 'milestones', milestone.id), cleanFirestoreData(milestone));
    setMilestones((prev) => sortMilestones([...prev, milestone]));
    return milestone;
  };

  /** Delete a custom milestone (Admin). Built-in milestones can't be deleted. Gear alerts already created are kept. */
  const deleteMilestone = async (id: string): Promise<void> => {
    const m = milestones.find((x) => x.id === id);
    if (!m || m.isDefault) return;
    if (isFirebaseConfigured && db) await deleteDoc(doc(db, 'milestones', id));
    setMilestones((prev) => prev.filter((x) => x.id !== id));
  };

  return { createMilestone, deleteMilestone };
}
