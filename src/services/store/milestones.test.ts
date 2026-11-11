import { expect, it, vi } from 'vitest';
import { createMilestoneOps } from './milestones';
import type { MilestoneReward } from '../../types';

vi.mock('../firebase', () => ({ isFirebaseConfigured: false, db: null }));

const ops = (existing: MilestoneReward[] = [], badges: { id: string; name: string; emoji: string }[] = []) => {
  let list = existing;
  const ctx = { milestones: existing, badges, setMilestones: (u: MilestoneReward[] | ((p: MilestoneReward[]) => MilestoneReward[])) => { list = typeof u === 'function' ? u(list) : u; } };
  return { ...createMilestoneOps(ctx as never), get list() { return list; } };
};

it('gear is optional: a blank gear field makes a recognition-only milestone named after the milestone', async () => {
  const o = ops();
  const m = await o.createMilestone({ name: '25 Runs', target: 25, icon: '', description: '', gear: '' });
  expect(m).toMatchObject({ id: 'milestone-25', runsRequired: 25, reward: '25 Runs', hasGear: false, icon: '🏆', perks: '' });
});

it('gear filled in makes a handout; miles milestones use their own id and default icon', async () => {
  const o = ops();
  expect(await o.createMilestone({ name: '100 Miles', measure: 'miles', target: 100, icon: '', description: '', gear: 'Club Pin' }))
    .toMatchObject({ id: 'milestone-miles-100', milesRequired: 100, reward: 'Club Pin', hasGear: true, icon: '📏' });
  const m = await o.createMilestone({ name: 'Hat', target: 50, icon: '🧢', description: '', gear: ' Hat ' });
  expect(m).toMatchObject({ reward: 'Hat', icon: '🧢' });
});

it('refuses a duplicate target within the same measure only', async () => {
  const existing = [{ id: 'milestone-100', runsRequired: 100, name: 'x', reward: 'x', perks: '', icon: '', description: '' }];
  const o = ops(existing);
  await expect(o.createMilestone({ name: 'dup', target: 100, icon: '', description: '', gear: '' })).rejects.toThrow('already a milestone at 100 runs');
  await expect(o.createMilestone({ name: '100 mi', measure: 'miles', target: 100, icon: '', description: '', gear: '' })).resolves.toBeTruthy();
});

it('an emoji can only be used once across badges and milestones', async () => {
  const existing = [{ id: 'milestone-5', runsRequired: 5, name: 'Shirt', reward: 'Shirt', perks: '', icon: '👕', description: '' }];
  const o = ops(existing, [{ id: 'power-walker', name: 'Power Walker', emoji: '🚶' }]);
  await expect(o.createMilestone({ name: 'A', target: 10, icon: '👕', description: '', gear: '' })).rejects.toThrow('already used by the Shirt milestone');
  await expect(o.createMilestone({ name: 'B', target: 11, icon: '🚶', description: '', gear: '' })).rejects.toThrow('already used by the Power Walker badge');
  await expect(o.createMilestone({ name: 'C', target: 12, icon: '🚶\uFE0F', description: '', gear: '' })).rejects.toThrow('already used'); // variation selector doesn't make it new
  await expect(o.createMilestone({ name: 'D', target: 13, icon: '🧦', description: '', gear: '' })).resolves.toBeTruthy();
});
