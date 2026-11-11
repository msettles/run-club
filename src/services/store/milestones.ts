/** Club store operations: milestones (gear tiers). Separate from badges. */
import type { MilestoneReward } from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { cleanFirestoreData } from './helpers';
import type { StoreState } from './state';

export function createMilestoneOps(ctx: StoreState) {
  const { milestones, setMilestones } = ctx;

  /**
   * Create a milestone (Admin). `gear` is what gets handed out; leave it blank for a
   * recognition-only milestone (organizers see it, nothing to hand out).
   * Each total-runs number can only be a milestone once, because a runner's alert is keyed by it.
   */
  const createMilestone = async (data: {
    name: string;
    runsRequired: number;
    icon: string;
    description: string;
    gear: string;
    perks?: string;
  }): Promise<MilestoneReward> => {
    const name = data.name.trim();
    const runsRequired = Math.floor(Number(data.runsRequired));
    if (!name) throw new Error('Give the milestone a name.');
    if (!Number.isFinite(runsRequired) || runsRequired < 1 || runsRequired > 100000) throw new Error('Runs required must be a whole number of 1 or more.');
    if (milestones.some((m) => m.runsRequired === runsRequired)) throw new Error(`There is already a milestone at ${runsRequired} run${runsRequired === 1 ? '' : 's'}.`);
    const gear = data.gear.trim();
    const milestone: MilestoneReward = {
      id: `milestone-${runsRequired}`,
      runsRequired,
      name,
      reward: gear || name,
      perks: (data.perks || '').trim(),
      icon: data.icon.trim() || '🏆',
      description: data.description.trim(),
      hasGear: Boolean(gear),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    if (isFirebaseConfigured && db) await setDoc(doc(db, 'milestones', milestone.id), cleanFirestoreData(milestone));
    setMilestones((prev) => [...prev, milestone].sort((a, b) => a.runsRequired - b.runsRequired));
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
