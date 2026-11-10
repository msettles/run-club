import { afterEach, expect, it, vi } from 'vitest';
import { celebrate } from './celebrate';

const confetti = vi.hoisted(() => vi.fn());
vi.mock('canvas-confetti', () => ({ default: confetti }));
afterEach(() => confetti.mockReset());

it('keeps animation optional and respects reduced motion', async () => {
  expect(celebrate('check-in')).toBeUndefined();
  await vi.waitFor(() => expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ particleCount: 90, disableForReducedMotion: true })));
});

it('does not throw into the check-in flow when the animation fails', async () => {
  confetti.mockImplementation(() => { throw new Error('Canvas unavailable'); });
  expect(() => celebrate('rewards')).not.toThrow();
  await vi.waitFor(() => expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ particleCount: 50 })));
});
