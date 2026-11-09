import type { UserProfile } from '../types';

/**
 * Bootstrap club accounts that always have admin rights.
 * Keep in sync with isBootstrapAdminEmail() in firestore.rules.
 */
export const ADMIN_EMAILS = ['woodlandwoodchuckers@gmail.com', 'mattsettles@gmail.com'];

export function isAdminProfile(user: Pick<UserProfile, 'email' | 'role'> | null | undefined): boolean {
  if (!user || !user.email) return false;
  return user.role === 'admin' || ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/** Admins and organizers (run hosts). Matches isAdmin() in firestore.rules. */
export function isStaffProfile(user: Pick<UserProfile, 'email' | 'role'> | null | undefined): boolean {
  return isAdminProfile(user) || user?.role === 'organizer';
}
