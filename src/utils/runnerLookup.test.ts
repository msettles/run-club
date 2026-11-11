import { expect, it } from 'vitest';
import { runnerLookup } from './runnerLookup';

it('prefers the current profile, matching email case-insensitively, and falls back to the stored copy', () => {
  const r = runnerLookup([{ email: 'a@x.com', displayName: 'Alicia Smith', shirtSize: 'M' }]);
  expect(r.name('A@X.com', 'Alice Jones')).toBe('Alicia Smith');
  expect(r.shirtSize('a@x.com', 'S')).toBe('M');
  expect(r.name('other@x.com', 'Bob Old')).toBe('Bob Old');
  expect(r.shirtSize('other@x.com', 'L')).toBe('L');
});
