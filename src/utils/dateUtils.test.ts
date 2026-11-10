import { afterEach, expect, it, vi } from 'vitest';
import { calculateAge, localYmd } from './dateUtils';
afterEach(() => vi.useRealTimers());
it('uses the Pacific run date when UTC has already moved to tomorrow', () => {
  expect(localYmd(new Date('2026-11-12T02:00:00Z'))).toBe('2026-11-11');
});
it('calculates age at birthday boundaries and rejects future birthdays', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 9, 18));
  expect(calculateAge('2000-11-09')).toBe(26);
  expect(calculateAge('2000-11-10')).toBe(25);
  expect(calculateAge('2027-11-09')).toBeUndefined();
});
