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
