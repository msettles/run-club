/** Club store operations: legacy. */
import { 
  UserProfile,
  CheckInRecord,
  LegacyMember,
} from '../../types';
import {
  buildLegacyImport,
  datedEventsFrom,
  recomputeBadges,
  isLegacyClaimed,
  type LegacyEvent,
} from '../../utils/legacy';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { fetchMeetups } from './scheduleLoading';
import { sha256Hex } from '../../utils/hash';
import { prepareRewardProofs } from './rewardProofs';
import { memberKeyFor } from '../../utils/memberKey';
import { assertDocumentFitsFirestore, cleanFirestoreData, memberFromUser, toPublicMember } from './helpers';
import type { StoreState } from './state';

function stableJson(value: unknown): string {
  const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) :
    value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, normalize(entry)])) : value;
  return JSON.stringify(normalize(value));
}

export function createLegacyOps(ctx: StoreState) {
  const {
    setMembers,
    badges,
    users,
    setUsers,
    meetupEvents,
    checkins,
    legacyPool,
    setLegacyMembers,
    setOwnLegacyEvents,
    currentUserEmail,
    legacyMembers,
    privateSyncEpoch,
  } = ctx;

  /**
   * Load the legacy name pool: one index doc (names + counts) plus the claimed
   * profiles, so claim status is current. Signed-in users only.
   */
  const loadLegacyPool = async (): Promise<LegacyMember[]> => {
    if (!isFirebaseConfigured || !db) return legacyPool;
    const epoch = privateSyncEpoch.current;
    const [indexSnap, claimedSnap] = await Promise.all([
      getDoc(doc(db, 'legacy_index', 'pool')),
      getDocs(query(collection(db, 'legacy_profiles'), where('claimedBy', '!=', null))),
    ]);
    const claimed = new Map(claimedSnap.docs.map((d) => [d.id, d.data()]));
    const entries: { id: string; name: string; oldCount: number; newCount: number }[] =
      (indexSnap.exists() && indexSnap.data().entries) || [];
    const pool: LegacyMember[] = entries.map((e) => ({
      id: e.id,
      name: e.name,
      oldCount: e.oldCount,
      newCount: e.newCount,
      totalRuns: e.oldCount + e.newCount,
      claimedBy: (claimed.get(e.id)?.claimedBy as string) || null,
      claimedByEmail: null,
      claimedAt: (claimed.get(e.id)?.claimedAt as string) || null,
    }));
    if (epoch === privateSyncEpoch.current) setLegacyMembers(pool);
    return pool;
  };

  /** Dated sign-ins for legacy names (readable by their claimer and staff). */
  const fetchLegacyEvents = async (ids: string[]): Promise<LegacyEvent[]> => {
    if (!ids.length || !isFirebaseConfigured || !db) return [];
    const currentDb = db;
    const snaps = await Promise.all(ids.map((id) => getDoc(doc(currentDb, 'legacy_history', id))));
    return snaps.flatMap((sn, i) => sn.exists() ? ((sn.data().events as LegacyEvent[]) || []).map((event) => ({ ...event, legacyId: ids[i] })) : []);
  };

  /** All of one runner's check-ins (server query: staff only load recent ones). */
  const fetchRunnerCheckins = async (email: string): Promise<CheckInRecord[]> => {
    const clean = email.toLowerCase();
    if (!isFirebaseConfigured || !db) return checkins.filter((c) => c.userEmail.toLowerCase() === clean);
    const snap = await getDocs(query(collection(db, 'checkins'), where('userEmail', '==', clean)));
    const records = snap.docs.map((d) => d.data() as CheckInRecord);
    const known = new Map(meetupEvents.map((event) => [event.id, event]));
    const missing = [...new Set(records.filter((record) => record.runId && record.eventTitle === undefined && !known.has(record.runId)).map((record) => record.runId!))];
    const fetched = await fetchMeetups(missing);
    const meetups = new Map([...meetupEvents, ...fetched].map((event) => [event.id, event]));
    if (fetched.length) ctx.setMeetupEvents((previous) => [...new Map([...previous, ...fetched.map((event) => ({ ...event, codeWord: ctx.staffCodeWords?.current[event.id] || previous.find((old) => old.id === event.id)?.codeWord || '' }))].map((event) => [event.id, event])).values()]);
    return records.map((record) => {
      const event = meetups.get(record.runId || '');
      return event && record.eventTitle === undefined ? { ...record, eventTitle: event.title, eventSpecial: event.specialEvent || 'none' } : record;
    });
  };

  /** Recalculate badges + streaks for a profile from all its dated history and save them. */
  const refreshDerivedStats = async (user: UserProfile, legacyEvents?: LegacyEvent[]): Promise<UserProfile> => {
    const epoch = ctx.privateSessionEpoch?.current;
    let events = legacyEvents ?? [];
    const calculate = async (current: UserProfile) => {
      events = legacyEvents ?? (await fetchLegacyEvents(current.linkedLegacyIds || []));
      const own = await fetchRunnerCheckins(current.email);
      return { ...current, ...recomputeBadges(current, badges, datedEventsFrom(events, own, meetupEvents)) };
    };
    const key = await memberKeyFor(user.email);
    let updated: UserProfile;
    if (isFirebaseConfigured && db) {
      const firestore = db;
      const initial = await getDoc(doc(firestore, 'users', user.email));
      if (!initial.exists()) throw new Error('Profile unavailable.');
      const base = initial.data() as UserProfile;
      const history = await fetchRunnerCheckins(user.email);
      events = legacyEvents ?? await fetchLegacyEvents(base.linkedLegacyIds || []);
      const proofs = await prepareRewardProofs(firestore, base, history, events, meetupEvents);
      const desired = recomputeBadges(base, badges, datedEventsFrom(events, history, meetupEvents));
      const changed = [...new Set([...Object.keys(base.badgeCounts || {}), ...Object.keys(desired.badgeCounts || {}), ...base.unlockedBadgeIds])].filter((id) => (base.badgeCounts?.[id] || 0) !== (desired.badgeCounts?.[id] || 0));
      updated = base;
      const needsStreak = base.currentStreakWeeks !== desired.currentStreakWeeks || base.longestStreakWeeks !== desired.longestStreakWeeks || base.streakProofWeek !== proofs.streakProofWeek || base.longestStreakProofWeek !== proofs.longestStreakProofWeek;
      for (let offset = 0; offset < Math.max(needsStreak ? 1 : 0, changed.length); offset += 2) {
        const ids = changed.slice(offset, offset + 2);
        updated = await runTransaction(firestore, async (tx) => {
          const ref = doc(firestore, 'users', user.email);
          const snapshot = await tx.get(ref);
          if (!snapshot.exists()) throw new Error('Profile unavailable.');
          const current = snapshot.data() as UserProfile;
          if (current.deleting || (current.rewardEpoch || 0) !== (base.rewardEpoch || 0) || current.loggedRuns !== base.loggedRuns || current.lastCheckInUpdatedAt !== base.lastCheckInUpdatedAt || current.totalRuns !== base.totalRuns || current.runCount !== base.runCount || current.walkCount !== base.walkCount || current.petRunCount !== base.petRunCount || JSON.stringify(current.distanceCounts) !== JSON.stringify(base.distanceCounts) ||
              JSON.stringify(current.linkedLegacyIds || []) !== JSON.stringify(base.linkedLegacyIds || [])) throw new Error('Attendance changed. Please refresh your rewards.');
          const counts = { ...(current.badgeCounts || {}) };
          for (const id of ids) {
            if (desired.badgeCounts?.[id]) counts[id] = desired.badgeCounts[id]; else delete counts[id];
          }
          const rewardChanges = [...new Set([...Object.keys(counts), ...Object.keys(current.badgeCounts || {})])].filter((id) => counts[id] !== current.badgeCounts?.[id]);
          const result = { ...current, rewardChanges, badgeCounts: counts, unlockedBadgeIds: Object.keys(counts),
            currentStreakWeeks: desired.currentStreakWeeks, longestStreakWeeks: desired.longestStreakWeeks, ...proofs };
          tx.set(ref, cleanFirestoreData(result));
          tx.set(doc(firestore, 'members', key), toPublicMember(result, key));
          return result;
        });
      }
    } else updated = await calculate(user);
    if (epoch !== ctx.privateSessionEpoch?.current) return updated;
    setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === user.email.toLowerCase() ? updated : u)));
    setMembers((prev) => [memberFromUser(updated, key, isFirebaseConfigured), ...prev.filter((m) => m.id !== key)]);
    if (user.email.toLowerCase() === currentUserEmail.toLowerCase()) setOwnLegacyEvents(events);
    return updated;
  };

  /** Publish only a fresh profile; a concurrent write retries instead of losing totals. */
  const syncMemberProjection = async (email: string) => {
    if (!isFirebaseConfigured || !db) return;
    const firestore = db;
    const key = await memberKeyFor(email);
    await runTransaction(firestore, async (tx) => {
      const [owner, row] = await Promise.all([tx.get(doc(firestore, 'users', email)), tx.get(doc(firestore, 'members', key))]);
      if (!owner.exists() || owner.data().deleting) return;
      const member = toPublicMember(owner.data() as UserProfile, key);
      if (stableJson(row.data()) !== stableJson(member)) tx.set(doc(firestore, 'members', key), member);
    });
  };

  /**
   * Runner claims one legacy name. The rules only accept it if the name is
   * still unclaimed and the totals grow by exactly that name's counts.
   */
  const claimLegacyProfile = async (user: UserProfile, legacyId: string): Promise<UserProfile> => {
    const session = ctx.privateSessionEpoch?.current;
    const email = user.email.toLowerCase();
    const key = await memberKeyFor(email);
    if ((user.linkedLegacyIds || []).includes(legacyId)) return user;
    const claimedAt = new Date().toISOString();
    const apply = (u: UserProfile, lp: LegacyMember): UserProfile => {
      if (u.deleting) throw new Error('This profile is being deleted.');
      if (isLegacyClaimed(lp)) throw new Error(`${lp!.name} has already been claimed.`);
      return { ...u, linkedLegacyIds: [...(u.linkedLegacyIds || []), legacyId],
        linkedLegacyNames: [...(u.linkedLegacyNames || []), lp!.name],
        pre2021Runs: u.pre2021Runs + lp!.oldCount,
        legacyEventRuns: (u.legacyEventRuns || 0) + lp!.newCount,
        totalRuns: u.totalRuns + lp!.oldCount + lp!.newCount };
    };
    let updated: UserProfile;
    if (isFirebaseConfigured && db) {
      const firestore = db;
      updated = await runTransaction(firestore, async (tx) => {
        const lpRef = doc(firestore, 'legacy_profiles', legacyId);
        const uRef = doc(firestore, 'users', email);
        const [lpSnap, uSnap, lock] = await Promise.all([
          tx.get(lpRef), tx.get(uRef), tx.get(doc(firestore, 'settings', 'legacy_import')),
        ]);
        if (lock.data()?.active) throw new Error('Historical records are being updated. Please try again shortly.');
        if (!lpSnap.exists() || !uSnap.exists()) throw new Error('Profile no longer exists.');
        const current = uSnap.data() as UserProfile;
        if ((current.linkedLegacyIds || []).includes(legacyId)) return current;
        const result = apply(current, lpSnap.data() as LegacyMember);
        tx.update(lpRef, { claimedBy: key, claimedAt });
        tx.set(uRef, cleanFirestoreData(result));
        tx.set(doc(firestore, 'members', key), toPublicMember(result, key));
        return result;
      });
    } else {
      const lp = legacyPool.find((m) => m.id === legacyId);
      if (!lp) throw new Error('That old profile no longer exists.');
      updated = apply(user, lp);
    }
    if (session !== ctx.privateSessionEpoch?.current) throw new Error('The signed-in account changed. Sign in again to continue.');
    setLegacyMembers((prev) => prev.map((m) => (m.id === legacyId ? { ...m, claimedBy: key, claimedAt } : m)));
    setUsers((prev) => [updated, ...prev.filter((u) => u.email.toLowerCase() !== email)]);
    return updated;
  };

  /**
   * Admin: assign a legacy name to a runner (toEmail) or unclaim it (null).
   * Moves its counts off the previous claimer and onto the new one in one batch.
   */
  const adminSetLegacyClaim = async (legacyId: string, toEmail: string | null): Promise<void> => {
    const session = ctx.privateSessionEpoch?.current;
    let lp = legacyMembers.find((m) => m.id === legacyId);
    if (!lp) throw new Error('Unknown legacy profile.');
    const target = toEmail ? users.find((u) => u.email.toLowerCase() === toEmail.toLowerCase()) : undefined;
    if (toEmail && !target) throw new Error('Runner not found.');

    const previous = users.find(
      (u) =>
        (u.linkedLegacyIds || []).includes(legacyId) ||
        (u.linkedLegacyNames || []).some((n) => n.toUpperCase() === lp!.name.toUpperCase())
    );
    if (!isFirebaseConfigured && previous && target && previous.email === target.email) return;

    const withoutClaim = (u: UserProfile): UserProfile => ({
      ...u,
      rewardEpoch: (u.rewardEpoch || 0) + 1,
      linkedLegacyIds: (u.linkedLegacyIds || []).filter((id) => id !== legacyId),
      linkedLegacyNames: (u.linkedLegacyNames || []).filter((n) => n.toUpperCase() !== lp!.name.toUpperCase()),
      pre2021Runs: Math.max(0, u.pre2021Runs - lp!.oldCount),
      legacyEventRuns: Math.max(0, (u.legacyEventRuns || 0) - lp!.newCount),
      totalRuns: Math.max(0, u.totalRuns - lp!.oldCount - lp!.newCount),
    });
    const withClaim = (u: UserProfile): UserProfile => ({
      ...u,
      linkedLegacyIds: [...(u.linkedLegacyIds || []), legacyId],
      linkedLegacyNames: [...(u.linkedLegacyNames || []), lp!.name],
      pre2021Runs: u.pre2021Runs + lp!.oldCount,
      legacyEventRuns: (u.legacyEventRuns || 0) + lp!.newCount,
      totalRuns: u.totalRuns + lp!.oldCount + lp!.newCount,
    });

    let changed: UserProfile[] = [];
    if (previous) changed.push(withoutClaim(previous));
    if (target) changed.push(withClaim(target));
    const toKey = target ? await memberKeyFor(target.email) : null;
    const claimedAt = target ? new Date().toISOString() : null;

    if (isFirebaseConfigured && db) {
      const firestore = db;
      changed = await runTransaction(firestore, async (tx) => {
        const ref = doc(firestore, 'legacy_profiles', legacyId);
        const [saved, lock] = await Promise.all([tx.get(ref), tx.get(doc(firestore, 'settings', 'legacy_import'))]);
        if (lock.data()?.active) throw new Error('Finish the historical import before changing claims.');
        if (!saved.exists()) throw new Error('Unknown legacy profile.');
        lp = saved.data() as LegacyMember;
        const owners = await getDocs(query(collection(firestore, 'users'), where('linkedLegacyIds', 'array-contains', legacyId)));
        const emails = [...new Set([...owners.docs.map((d) => d.id), ...(toEmail ? [toEmail.toLowerCase()] : [])])];
        const snapshots = await Promise.all(emails.map((email) => tx.get(doc(firestore, 'users', email))));
        const result: UserProfile[] = [];
        for (const snap of snapshots) {
          if (!snap.exists()) throw new Error('Runner not found.');
          const u = snap.data() as UserProfile;
          if (u.deleting) throw new Error('This profile is being deleted.');
          const owns = (u.linkedLegacyIds || []).includes(legacyId);
          const receives = u.email.toLowerCase() === toEmail?.toLowerCase();
          if (owns && !receives) result.push(withoutClaim(u));
          if (!owns && receives) result.push(withClaim(u));
        }
        const keys = await Promise.all(result.map((u) => memberKeyFor(u.email)));
        tx.update(ref, { claimedBy: toKey, claimedAt });
        result.forEach((u, i) => {
          tx.set(doc(firestore, 'users', u.email), cleanFirestoreData(u));
          tx.set(doc(firestore, 'members', keys[i]), toPublicMember(u, keys[i]));
        });
        return result;
      });
    }
    if (session !== ctx.privateSessionEpoch?.current) return;
    setLegacyMembers((prev) => prev.map((m) => (m.id === legacyId ? { ...m, claimedBy: toKey, claimedAt } : m)));
    setUsers((prev) => prev.map((u) => changed.find((c) => c.email === u.email) || u));
    for (const u of changed) {
      try { await refreshDerivedStats(u); }
      catch (error) { console.warn('Claim saved; derived rewards need a refresh:', error); ctx.setPrivateSyncError?.('The historical claim was saved. Rewards will refresh at the runner’s next sign-in.'); }
    }
  };

  /**
   * Admin: import (or re-import) the old app's two CSV exports. Existing claims
   * are kept, and claimers' totals are recalculated from the new counts.
   */
  const importLegacyData = async (totalsCsv: string, checkinsCsv: string, onProgress?: (msg: string) => void | Promise<void>) => {
    const session = ctx.privateSessionEpoch?.current;
    const imp = buildLegacyImport(totalsCsv, checkinsCsv);
    if (!isFirebaseConfigured || !db) {
      setLegacyMembers(imp.profiles.map((p) => ({ ...p, claimedBy: null, claimedByEmail: null, claimedAt: null })));
      return imp.stats;
    }
    assertDocumentFitsFirestore({ entries: imp.profiles }, 'The historical name index');
    for (const [id, events] of Object.entries(imp.histories)) assertDocumentFitsFirestore({ events }, `Historical attendance for ${id}`);
    const currentDb = db;
    // A failed import deliberately remains fenced. Re-importing the same files
    // resumes safely: each profile and its current claimer move atomically.
    const lockRef = doc(currentDb, 'settings', 'legacy_import');
    const job = await sha256Hex(JSON.stringify([totalsCsv, checkinsCsv]));
    const token = crypto.randomUUID();
    await runTransaction(currentDb, async (tx) => {
      const old = await tx.get(lockRef);
      if (old.data()?.active && (old.data()?.leaseUntil || 0) > Date.now()) throw new Error('Another historical import is running. Please wait for it to finish.');
      if (old.data()?.active && old.data()?.job !== job) throw new Error('An interrupted import must be resumed with the same two CSV files before starting another import.');
      tx.set(lockRef, { active: true, job, token, leaseUntil: Date.now() + 60000, startedAt: new Date().toISOString() });
    });
    const retotaled: UserProfile[] = [];
    try {
    const existingProfiles = await getDocs(collection(currentDb, 'legacy_profiles'));
    const importedIds = new Set(imp.profiles.map((p) => p.id));
    const profiles = imp.profiles.map((p) => ({ ...p, removed: false }));
    for (const saved of existingProfiles.docs) if (!importedIds.has(saved.id)) {
      const old = saved.data() as LegacyMember;
      profiles.push({ id: saved.id, name: old.name, oldCount: 0, newCount: 0, totalRuns: 0, removed: true });
    }
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      const changed = await runTransaction(currentDb, async (tx) => {
        const ref = doc(currentDb, 'legacy_profiles', p.id);
        const [old, lock] = await Promise.all([tx.get(ref), tx.get(lockRef)]);
        if (lock.data()?.token !== token || !lock.data()?.active) throw new Error('This import was resumed in another browser.');
        const owners = await getDocs(query(collection(currentDb, 'users'), where('linkedLegacyIds', 'array-contains', p.id)));
        const ownerSnaps = await Promise.all(owners.docs.map((d) => tx.get(d.ref)));
        const changed: UserProfile[] = [];
        for (const snap of ownerSnaps) {
          if (!snap.exists()) continue;
          const u = snap.data() as UserProfile;
          if (u.deleting || !(u.linkedLegacyIds || []).includes(p.id)) continue;
          const before = old.data();
          const updated = { ...u, rewardEpoch: (u.rewardEpoch || 0) + 1,
            ...(p.removed ? { linkedLegacyIds: (u.linkedLegacyIds || []).filter((id) => id !== p.id), linkedLegacyNames: (u.linkedLegacyNames || []).filter((name) => name !== p.name) } : {}),
            pre2021Runs: u.pre2021Runs + p.oldCount - (before?.oldCount || 0),
            legacyEventRuns: (u.legacyEventRuns || 0) + p.newCount - (before?.newCount || 0),
            totalRuns: u.totalRuns + p.oldCount + p.newCount - (before?.oldCount || 0) - (before?.newCount || 0) };
          changed.push(updated);
        }
        const keys = await Promise.all(changed.map((u) => memberKeyFor(u.email)));
        tx.update(lockRef, { leaseUntil: Date.now() + 60000 });
        if (p.removed) {
          tx.delete(ref);
          tx.delete(doc(currentDb, 'legacy_history', p.id));
        } else {
          const { removed: _removed, ...profile } = p;
          tx.set(ref, { ...profile, claimedBy: old.data()?.claimedBy || null, claimedAt: old.data()?.claimedAt || null });
          tx.set(doc(currentDb, 'legacy_history', p.id), { id: p.id, events: imp.histories[p.id] || [] });
        }
        changed.forEach((u, n) => {
          tx.set(doc(currentDb, 'users', u.email), cleanFirestoreData(u));
          tx.set(doc(currentDb, 'members', keys[n]), toPublicMember(u, keys[n]));
        });
        return changed;
      });
      retotaled.push(...changed);
      await onProgress?.(`Saved ${i + 1} of ${profiles.length} profiles…`);
    }
    // Publish discovery only when every referenced profile/history is available.
    await runTransaction(currentDb, async (tx) => {
      const lock = await tx.get(lockRef);
      if (lock.data()?.token !== token) throw new Error('This import was resumed in another browser.');
      tx.set(doc(currentDb, 'legacy_index', 'pool'), {
        entries: imp.profiles.map(({ id, name, oldCount, newCount }) => ({ id, name, oldCount, newCount })),
        importedAt: new Date().toISOString(),
      });
      tx.set(lockRef, { active: false, job });
    });
    } catch (error) {
      await runTransaction(currentDb, async (tx) => {
        const lock = await tx.get(lockRef);
        if (lock.data()?.token === token) tx.update(lockRef, { leaseUntil: 0 });
      }).catch(() => {});
      throw new Error(`${error instanceof Error ? error.message : 'Import failed.'} The import remains paused. Re-upload the same files to resume; check-in and historical claims reopen when it finishes.`);
    }
    if (session !== ctx.privateSessionEpoch?.current) return imp.stats;
    setUsers((prev) => prev.map((u) => [...retotaled].reverse().find((r) => r.email === u.email) || u));
    await loadLegacyPool().catch((error) => console.warn('Import completed; name pool needs a refresh:', error));
    let pendingRewards = 0;
    for (const u of new Map(retotaled.map((u) => [u.email, u])).values()) {
      try { await refreshDerivedStats(u); }
      catch (error) { pendingRewards++; console.warn('Import completed; derived rewards need a refresh:', error); }
    }
    if (pendingRewards && session === ctx.privateSessionEpoch?.current) ctx.setPrivateSyncError?.(`The historical import completed. Rewards for ${pendingRewards} runner(s) will refresh at their next sign-in.`);
    return imp.stats;
  };


  return { syncMemberProjection, loadLegacyPool, fetchLegacyEvents, fetchRunnerCheckins, refreshDerivedStats, claimLegacyProfile, adminSetLegacyClaim, importLegacyData };
}
