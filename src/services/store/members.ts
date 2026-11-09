/** Club store operations: members. */
import { 
  UserProfile,
} from '../../types';
import { calculateAge } from '../../utils/dateUtils';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { memberKeyFor } from '../../utils/memberKey';
import { ADMIN_EMAILS } from '../../utils/roles';
import { cleanFirestoreData, memberFromUser, toPublicMember } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';
import type { createPrivateSyncOps } from './privateSync';

export function createMemberOps(ctx: StoreState & ReturnType<typeof createLegacyOps> & ReturnType<typeof createPrivateSyncOps>) {
  const {
    runs,
    setRuns,
    setMembers,
    setCurrentMemberId,
    users,
    setUsers,
    setCheckins,
    legacyPool,
    setLegacyMembers,
    currentUserEmail,
    setCurrentUserEmail,
    setMilestoneAlerts,
    claimLegacyProfile,
    refreshDerivedStats,
    syncPrivateData,
  } = ctx;

  /**
   * Register a new user profile with optional claimed legacy historical records
   */
  const registerUser = async (
    profileData: {
      email: string;
      firstName: string;
      lastName: string;
      shirtSize: string;
      birthday?: string;
      age?: number;
      city?: string;
      zipCode?: string;
      preferredPace?: string;
    },
    claimedLegacyIds: string[] = []
  ): Promise<UserProfile> => {
    const cleanEmail = profileData.email.trim().toLowerCase();
    const displayName = `${profileData.firstName.trim()} ${profileData.lastName.trim()}`;

    const effectiveAge = profileData.birthday
      ? calculateAge(profileData.birthday)
      : profileData.age;

    // Profiles start empty: legacy runs arrive one claim at a time (each checked
    // by the rules), and new runs through check-ins.
    const newUser: UserProfile = {
      email: cleanEmail,
      firstName: profileData.firstName.trim(),
      lastName: profileData.lastName.trim(),
      displayName,
      shirtSize: profileData.shirtSize,
      birthday: profileData.birthday,
      age: effectiveAge,
      city: profileData.city || 'Woodland',
      zipCode: profileData.zipCode || '95695',
      preferredPace: profileData.preferredPace,
      pre2021Runs: 0,
      legacyEventRuns: 0,
      loggedRuns: 0,
      totalRuns: 0,
      totalMiles: 0,
      runCount: 0,
      walkCount: 0,
      petRunCount: 0,
      firstRunDate: new Date().toISOString().split('T')[0],
      linkedLegacyIds: [],
      linkedLegacyNames: [],
      unlockedBadgeIds: [],
      badgeCounts: {},
      role: ADMIN_EMAILS.includes(cleanEmail) ? 'admin' : 'member',
      createdAt: new Date().toISOString(),
    };

    const memberKey = await memberKeyFor(cleanEmail);

    // Persist first so the UI never shows a profile the server rejected.
    // users + members go in one batch: the rules require the public row to mirror the profile.
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', cleanEmail), cleanFirestoreData(newUser));
      batch.set(doc(db, 'members', memberKey), toPublicMember(newUser, memberKey));
      await batch.commit();
    }

    setUsers((prev) => [newUser, ...prev.filter((u) => u.email.toLowerCase() !== cleanEmail)]);
    setMembers((prev) => [memberFromUser(newUser, memberKey), ...prev.filter((m) => m.id !== memberKey)]);

    setCurrentUserEmail(cleanEmail);
    setCurrentMemberId(memberKey);

    // Claim the selected old profiles one by one; a name someone else grabbed
    // in the meantime is reported but doesn't undo the rest.
    let finalUser = newUser;
    const failed: string[] = [];
    for (const id of claimedLegacyIds) {
      try {
        finalUser = await claimLegacyProfile(finalUser, id);
      } catch (err) {
        console.warn('Legacy claim failed:', id, err);
        failed.push(legacyPool.find((m) => m.id === id)?.name || id);
      }
    }
    if ((finalUser.linkedLegacyIds || []).length) {
      try {
        finalUser = await refreshDerivedStats(finalUser);
      } catch (err) {
        console.warn('Badge refresh failed:', err);
      }
    }

    // New profiles never go through the returning-user path in App, so load
    // private data (and run the staff code-word migration) here as well.
    if (isFirebaseConfigured && db) {
      syncPrivateData(cleanEmail, newUser.role === 'admin' || newUser.role === 'organizer', newUser.role === 'admin');
    }

    if (failed.length) {
      throw Object.assign(
        new Error(`Your profile was created, but these old profiles were already claimed: ${failed.join(', ')}. Ask an organizer if one of them is yours.`),
        { user: finalUser }
      );
    }
    return finalUser;
  };

  /**
   * Admin only: delete a runner so the email can sign up fresh. Removes their
   * profile, leaderboard row, check-ins, gear alerts and RSVPs, and unclaims
   * any old-app names they linked. Their sign-in account itself is untouched.
   */
  const adminDeleteRunner = async (email: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === currentUserEmail.toLowerCase()) throw new Error("You can't delete your own profile.");
    const key = await memberKeyFor(cleanEmail);
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    const legacyIds = new Set([
      ...(user?.linkedLegacyIds || []),
      ...legacyPool.filter((m) => m.claimedBy === key).map((m) => m.id),
    ]);

    if (isFirebaseConfigured && db) {
      const currentDb = db;
      type Op = (b: ReturnType<typeof writeBatch>) => void;
      const ops: Op[] = [];
      // Query the server too, so nothing is missed if local state is partial.
      const [ciSnap, alertSnap, claimSnap] = await Promise.all([
        getDocs(query(collection(currentDb, 'checkins'), where('userEmail', '==', cleanEmail))),
        getDocs(query(collection(currentDb, 'milestone_alerts'), where('userEmail', '==', cleanEmail))),
        getDocs(query(collection(currentDb, 'legacy_profiles'), where('claimedBy', '==', key))),
      ]);
      ciSnap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      alertSnap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      claimSnap.docs.forEach((d) => legacyIds.add(d.id));
      legacyIds.forEach((id) =>
        ops.push((b) => b.update(doc(currentDb, 'legacy_profiles', id), { claimedBy: null, claimedAt: null }))
      );
      for (const run of runs) {
        if (run.attendees.some((a) => a.memberId === key)) {
          ops.push((b) =>
            b.update(doc(currentDb, 'runs', run.id), { attendees: run.attendees.filter((a) => a.memberId !== key) })
          );
        }
      }
      ops.push((b) => b.delete(doc(currentDb, 'members', key)));
      ops.push((b) => b.delete(doc(currentDb, 'users', cleanEmail)));
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(currentDb);
        ops.slice(i, i + 400).forEach((op) => op(batch));
        await batch.commit();
      }
    }

    setUsers((prev) => prev.filter((u) => u.email.toLowerCase() !== cleanEmail));
    setMembers((prev) => prev.filter((m) => m.id !== key));
    setCheckins((prev) => prev.filter((c) => c.userEmail.toLowerCase() !== cleanEmail));
    setMilestoneAlerts((prev) => prev.filter((a) => a.userEmail.toLowerCase() !== cleanEmail));
    setRuns((prev) => prev.map((r) => ({ ...r, attendees: r.attendees.filter((a) => a.memberId !== key) })));
    setLegacyMembers((prev) =>
      prev.map((m) => (legacyIds.has(m.id) ? { ...m, claimedBy: null, claimedByEmail: null, claimedAt: null } : m))
    );
  };

  /**
   * Admin only: change another runner's role (member / organizer / admin).
   * The rules reject role changes by non-admins and on your own profile.
   */
  const setUserRole = async (email: string, role: 'member' | 'organizer' | 'admin'): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'users', cleanEmail), { role });
    }
    setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === cleanEmail ? { ...u, role } : u)));
  };

  /**
   * Switch the current active testing user by email
   */
  const switchCurrentUser = (email: string) => {
    setCurrentUserEmail(email.toLowerCase());
    setCurrentMemberId(email.toLowerCase());
  };


  return { registerUser, adminDeleteRunner, setUserRole, switchCurrentUser };
}
