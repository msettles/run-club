import { beforeEach, expect, it, vi } from 'vitest';
import { createEventOps } from './events';
import type { RunEvent } from '../../types';

const api = vi.hoisted(() => ({ runTransaction: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn() }));
vi.mock('../firebase', () => ({ isFirebaseConfigured: true, db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  collection: vi.fn(), getDoc: vi.fn().mockResolvedValue({ data: () => ({ active: false }) }), getCountFromServer: vi.fn(),
  runTransaction: api.runTransaction, deleteField: () => 'delete-field', Timestamp: { fromDate: (date: Date) => date },
}));
const event = { id: 'run', date: '2026-11-11', time: '06:00 PM', title: 'Updated', codeWord: 'NEW', activeDistances: [], routes: {} };
const run = { id: 'run', title: 'Updated', attendees: [{ memberId: 'stale' }] } as RunEvent;
function context() { return { meetupEvents: [], staffCodeWords: { current: {} }, setMeetupEvents: vi.fn(), setRuns: vi.fn() }; }
beforeEach(() => {
  vi.clearAllMocks();
  api.runTransaction.mockImplementation(async (_db, callback) => callback({
    get: async (ref: string) => ({ exists: () => !ref.startsWith('meetup_codes/'), data: () => ref.startsWith('meetup_events/') ? { date: '2026-11-11' } : { codeWord: 'OLD' } }),
    set: api.set, update: api.update, delete: api.delete,
  }));
});

it('saves the run and new code word in one transaction without stale RSVPs', async () => {
  const ctx = context();
  await createEventOps(ctx as unknown as Parameters<typeof createEventOps>[0]).saveMeetupEvent(event, run);
  expect(api.runTransaction).toHaveBeenCalledOnce();
  expect(api.update).toHaveBeenCalledWith('runs/run', { id: 'run', title: 'Updated', specialEvent: 'delete-field' });
  expect(api.set).toHaveBeenCalledWith('meetup_secrets/run', { codeWord: 'NEW' });
  expect(api.delete).toHaveBeenCalledWith(expect.stringMatching(/^meetup_codes\//));
  expect(ctx.setRuns).toHaveBeenCalledOnce();
});

it('does not apply local edits when the transaction is rejected', async () => {
  api.runTransaction.mockRejectedValue(new Error('Locked code word'));
  const ctx = context();
  await expect(createEventOps(ctx as unknown as Parameters<typeof createEventOps>[0]).saveMeetupEvent(event, run)).rejects.toThrow('Locked');
  expect(ctx.setRuns).not.toHaveBeenCalled();
  expect(ctx.setMeetupEvents).not.toHaveBeenCalled();
});
