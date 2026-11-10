import { expect, it } from 'vitest';
import { runShareUrl, sharedRunId } from './runLinks';

it('shares only the run ID and safely round-trips special characters', () => {
  const url = runShareUrl('run & summer%night', 'https://example.com/?checkin=true&code=secret#checkin');
  expect(url).toBe('https://example.com/?run=run+%26+summer%25night');
  expect(sharedRunId(new URL(url).search)).toBe('run & summer%night');
});

it('rejects missing IDs, document paths and oversized links', () => {
  for (const search of ['', '?run=', '?run=..', '?run=routes%2Fsecret', `?run=${'x'.repeat(1501)}`]) expect(sharedRunId(search)).toBeNull();
});

it('round-trips an app-made run ID', () => {
  expect(sharedRunId(new URL(runShareUrl('run-1794268066923', 'https://example.com')).search)).toBe('run-1794268066923');
});

it('ignores share text pasted onto the end of a link', () => {
  // Share sheet "Copy" puts the message on the next line; the address bar drops the line break.
  const pasted = 'https://example.com/?run=run-1794268066923\nJoin us for Wednesday Nov 11 Run on 2026-11-11!';
  expect(sharedRunId(new URL(pasted.replace(/\n/g, '')).search)).toBe('run-1794268066923');
  // Encoded line break, a space, or trailing punctuation.
  for (const search of [
    '?run=run-1794268066923%0AJoin%20us%20for%20Wednesday%20Nov%2011%20Run',
    '?run=run-1794268066923%20Join%20us',
    '?run=run-1794268066923!',
    '?run=run-1794268066923.',
    '?run=%20run-1794268066923%20',
  ]) {
    expect(sharedRunId(search)).toBe('run-1794268066923');
  }
});
