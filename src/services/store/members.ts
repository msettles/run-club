/** Club store operations: members. */
import { 
  UserProfile,
  RunEvent,
} from '../../types';
import { calculateAge, localYmd } from '../../utils/dateUtils';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  writeBatch,
  runTransaction,
  arrayRemove,
} from 'firebase/firestore';
import { memberKeyFor } from '../../utils/memberKey';
import { ADMIN_EMAILS } from '../../utils/roles';
import { cleanFirestoreData, memberFromUser, toPublicMember } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';

export function createMemberOps(ctx: StoreState & ReturnType<typeof createLegacyOps>) {
  const {
    setRuns,
    setMembers,
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
    const session = ctx.privateSessionEpoch?.current;
    const assertSession = () => { if (session !== ctx.privateSessionEpoch?.current) throw new Error('The signed-in account changed. Sign in again to continue.'); };
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
      firstRunDate: localYmd(),
      linkedLegacyIds: [],
      linkedLegacyNames: [],
      unlockedBadgeIds: [],
      badgeCounts: {},
      role: ADMIN_EMAILS.includes(cleanEmail) ? 'admin' : 'member',
      createdAt: new Date().toISOString(),
    };

    const memberKey = await memberKeyFor(cleanEmail);

    // Resuming setup never replaces a profile which another tab already created.
    const firestore = db;
    const registered = isFirebaseConfigured && firestore ? await runTransaction(firestore, async (tx) => {
      const ref = doc(firestore, 'users', cleanEmail);
      const saved = await tx.get(ref);
      if (saved.exists()) return saved.data() as UserProfile;
      tx.set(ref, cleanFirestoreData(newUser));
      tx.set(doc(firestore, 'members', memberKey), toPublicMember(newUser, memberKey));
      return newUser;
    }) : newUser;
    assertSession();
    setUsers((prev) => [registered, ...prev.filter((u) => u.email.toLowerCase() !== cleanEmail)]);
    setMembers((prev) => [memberFromUser(registered, memberKey), ...prev.filter((m) => m.id !== memberKey)]);
    setCurrentUserEmail(cleanEmail);

    // Claim the selected old profiles one by one; a name someone else grabbed
    // in the meantime is reported but doesn't undo the rest.
    let finalUser = registered;
    const failed: string[] = [];
    for (const id of claimedLegacyIds) {
      assertSession();
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

    assertSession();

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
      await runTransaction(currentDb, async (tx) => {
        const ref = doc(currentDb, 'users', cleanEmail);
        const snap = await tx.get(ref);
        if (snap.exists()) tx.update(ref, { deleting: true });
      });
      type Op = (b: ReturnType<typeof writeBatch>) => void;
      const ops: Op[] = [];
      // Query the server too, so nothing is missed if local state is partial.
      const [ciSnap, alertSnap, claimSnap, runsSnap, proofSnap] = await Promise.all([
        getDocs(query(collection(currentDb, 'checkins'), where('userEmail', '==', cleanEmail))),
        getDocs(query(collection(currentDb, 'milestone_alerts'), where('userEmail', '==', cleanEmail))),
        getDocs(query(collection(currentDb, 'legacy_profiles'), where('claimedBy', '==', key))),
        getDocs(collection(currentDb, 'runs')),
        getDocs(query(collection(currentDb, 'reward_proofs'), where('userEmail', '==', cleanEmail))),
      ]);
      proofSnap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      ciSnap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      alertSnap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      claimSnap.docs.forEach((d) => legacyIds.add(d.id));
      legacyIds.forEach((id) =>
        ops.push((b) => b.update(doc(currentDb, 'legacy_profiles', id), { claimedBy: null, claimedAt: null }))
      );
      for (const runDoc of runsSnap.docs) {
        const run = runDoc.data() as RunEvent;
        if (run.attendees.some((a) => a.memberId === key)) {
          ops.push((b) =>
            b.update(doc(currentDb, 'runs', run.id), { attendees: arrayRemove(...run.attendees.filter((a) => a.memberId === key)) })
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

  /** Set (or clear, with '') whose profile this app is showing: the signed-in account. */
  const switchCurrentUser = (email: string) => {
    setCurrentUserEmail(email.toLowerCase());
  };


  return { registerUser, adminDeleteRunner, setUserRole, switchCurrentUser };
}
