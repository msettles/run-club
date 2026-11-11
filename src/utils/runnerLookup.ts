import type { UserProfile } from '../types';

/**
 * Staff screens show a runner's *current* profile name and shirt size, looked up by email,
 * so renames and size changes follow the runner. The copy stored on a check-in or gear alert
 * is only the fallback for runners who aren't in the loaded roster.
 */
export function runnerLookup(users: Pick<UserProfile, 'email' | 'displayName' | 'shirtSize'>[]) {
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  return {
    name: (email: string, stored?: string): string => byEmail.get(email.toLowerCase())?.displayName || stored || '',
    shirtSize: (email: string, stored?: string): string => byEmail.get(email.toLowerCase())?.shirtSize || stored || '',
  };
}
