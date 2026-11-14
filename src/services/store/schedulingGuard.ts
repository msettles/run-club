import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import type { UserProfile } from '../../types';
import { isAdminProfile } from '../../utils/roles';

/** Explain the maintenance refusal before attempting a scheduling write. Rules remain authoritative. */
export async function assertSchedulingAvailable(user: UserProfile | undefined): Promise<void> {
  if (!isFirebaseConfigured || !db || isAdminProfile(user)) return;
  if ((await getDoc(doc(db, 'settings', 'maintenance'))).data()?.active) {
    throw Object.assign(new Error('Not saved: club maintenance is on. Only the club admin can publish or edit runs until club changes resume.'), { code: 'club-maintenance' });
  }
}
