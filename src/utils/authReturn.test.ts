import { expect, it } from 'vitest';
import { authReturnUrl, safeAuthReturnUrl } from './authReturn';
const origin = 'https://example.test';
it('keeps QR intent across email sign-in while stripping one-time credentials and unrelated state', () => {
  expect(authReturnUrl(`${origin}/?checkin=true&mode=signIn&oobCode=secret&apiKey=key&email=private&codeWord=ACORN`)).toBe(`${origin}/?checkin=true`);
  expect(authReturnUrl(`${origin}/#checkin`)).toBe(`${origin}/?checkin=true`);
});
it('pins a selected run and preserves shared-run browsing without inventing check-in intent', () => {
  expect(authReturnUrl(`${origin}/`, { runId: 'run-123' })).toBe(`${origin}/?run=run-123&checkin=true`);
  expect(authReturnUrl(`${origin}/?run=run-123`)).toBe(`${origin}/?run=run-123`);
  expect(authReturnUrl(`${origin}/`, { candidateIds: ['run-1', 'run-2'] })).toBe(`${origin}/?checkin=true`);
  expect(authReturnUrl(`${origin}/?run=run-123`, { candidateIds: ['run-1', 'run-2'] })).toBe(`${origin}/?checkin=true`);
});
it('only permits safe same-origin navigation parameters', () => {
  expect(safeAuthReturnUrl(`${origin}/?checkin=true`, 'https://elsewhere.test/?run=run-2')).toBe(`${origin}/?checkin=true`);
  expect(safeAuthReturnUrl(`${origin}/?checkin=true`, '//elsewhere.test/')).toBe(`${origin}/?checkin=true`);
  expect(safeAuthReturnUrl(`${origin}/`, '/?checkin=true&next=https://elsewhere.test&email=private')).toBe(`${origin}/?checkin=true`);
});
