import { expect, it } from 'vitest';
import { friendlyRunError } from './runSaveError';
it('does not present a generic permission refusal as evidence of a locked code word', () => {
  const message = friendlyRunError({ code: 'permission-denied' }).message;
  expect(message).toContain('club maintenance');
  expect(message).not.toContain('locked');
});
it('retains the specific maintenance explanation', () => {
  expect(friendlyRunError({ code: 'club-maintenance', message: 'Only the club admin can publish during maintenance.' }).message).toBe('Only the club admin can publish during maintenance.');
});
