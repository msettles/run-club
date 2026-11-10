import { expect, it } from 'vitest';
import { matchesStaffSearch } from './staffLoading';
import type { UserProfile } from '../../types';
const runner = { email: 'jane.smith@example.test', firstName: 'Jánë', lastName: 'Smith', displayName: 'Jánë M. Smith', role: 'member' } as UserProfile;
it('matches partial names and emails regardless of case, accents or word order', () => {
  for (const term of ['JANE', 'smith jane', '  jane   SMITH ', 'smith@example', 'example.test', 'Jánë']) expect(matchesStaffSearch(runner, term)).toBe(true);
  expect(matchesStaffSearch(runner, 'John')).toBe(false);
  expect(matchesStaffSearch(runner, 'Jane elsewhere')).toBe(false);
});
it('applies role filters, including the bootstrap owner role', () => {
  expect(matchesStaffSearch(runner, 'smith', 'admin')).toBe(false);
  expect(matchesStaffSearch(runner, 'smith', 'member')).toBe(true);
  expect(matchesStaffSearch({ ...runner, email: 'woodlandwoodchuckers@gmail.com' }, 'Jane', 'admin')).toBe(true);
});
