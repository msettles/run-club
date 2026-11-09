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
  writeBatch,
} from 'firebase/firestore';
import { memberKeyFor } from '../../utils/memberKey';
import { cleanFirestoreData, memberFromUser, toPublicMember } from './helpers';
import type { StoreState } from './state';

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
    return snaps.flatMap((sn) => (sn.exists() ? ((sn.data().events as LegacyEvent[]) || []) : []));
  };

  /** All of one runner's check-ins (server query: staff only load recent ones). */
  const fetchRunnerCheckins = async (email: string): Promise<CheckInRecord[]> => {
    const clean = email.toLowerCase();
    if (!isFirebaseConfigured || !db) return checkins.filter((c) => c.userEmail.toLowerCase() === clean);
    const snap = await getDocs(query(collection(db, 'checkins'), where('userEmail', '==', clean)));
    return snap.docs.map((d) => d.data() as CheckInRecord);
  };

  /** Recalculate badges + streaks for a profile from all its dated history and save them. */
  const refreshDerivedStats = async (user: UserProfile, legacyEvents?: LegacyEvent[]): Promise<UserProfile> => {
    const events = legacyEvents ?? (await fetchLegacyEvents(user.linkedLegacyIds || []));
    const own = await fetchRunnerCheckins(user.email);
    const derived = recomputeBadges(user, badges, datedEventsFrom(events, own, meetupEvents));
    const updated: UserProfile = { ...user, ...derived };
    const key = await memberKeyFor(user.email);
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.email), cleanFirestoreData({ ...derived }));
      batch.set(doc(db, 'members', key), toPublicMember(updated, key));
      await batch.commit();
    }
    setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === user.email.toLowerCase() ? updated : u)));
    setMembers((prev) => [memberFromUser(updated, key), ...prev.filter((m) => m.id !== key)]);
    if (user.email.toLowerCase() === currentUserEmail.toLowerCase()) setOwnLegacyEvents(events);
    return updated;
  };

  /**
   * Runner claims one legacy name. The rules only accept it if the name is
   * still unclaimed and the totals grow by exactly that name's counts.
   */
  const claimLegacyProfile = async (user: UserProfile, legacyId: string): Promise<UserProfile> => {
    const email = user.email.toLowerCase();
    const key = await memberKeyFor(email);
    if ((user.linkedLegacyIds || []).includes(legacyId)) return user;
    let lp = legacyPool.find((m) => m.id === legacyId);
    if (isFirebaseConfigured && db) {
      const snap = await getDoc(doc(db, 'legacy_profiles', legacyId));
      if (!snap.exists()) throw new Error('That old profile no longer exists.');
      lp = { ...(snap.data() as LegacyMember), claimedByEmail: null };
    }
    if (!lp) throw new Error('That old profile no longer exists.');
    if (isLegacyClaimed(lp)) throw new Error(`${lp.name} has already been claimed.`);

    const updated: UserProfile = {
      ...user,
      linkedLegacyIds: [...(user.linkedLegacyIds || []), legacyId],
      linkedLegacyNames: [...(user.linkedLegacyNames || []), lp.name],
      pre2021Runs: user.pre2021Runs + lp.oldCount,
      legacyEventRuns: (user.legacyEventRuns || 0) + lp.newCount,
      totalRuns: user.totalRuns + lp.oldCount + lp.newCount,
    };
    const claimedAt = new Date().toISOString();
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'legacy_profiles', legacyId), { claimedBy: key, claimedAt });
      batch.set(doc(db, 'users', email), cleanFirestoreData(updated));
      batch.set(doc(db, 'members', key), toPublicMember(updated, key));
      await batch.commit();
    }
    setLegacyMembers((prev) => prev.map((m) => (m.id === legacyId ? { ...m, claimedBy: key, claimedAt } : m)));
    setUsers((prev) => [updated, ...prev.filter((u) => u.email.toLowerCase() !== email)]);
    return updated;
  };

  /**
   * Admin: assign a legacy name to a runner (toEmail) or unclaim it (null).
   * Moves its counts off the previous claimer and onto the new one in one batch.
   */
  const adminSetLegacyClaim = async (legacyId: string, toEmail: string | null): Promise<void> => {
    const lp = legacyMembers.find((m) => m.id === legacyId);
    if (!lp) throw new Error('Unknown legacy profile.');
    const target = toEmail ? users.find((u) => u.email.toLowerCase() === toEmail.toLowerCase()) : undefined;
    if (toEmail && !target) throw new Error('Runner not found.');

    const previous = users.find(
      (u) =>
        (u.linkedLegacyIds || []).includes(legacyId) ||
        (u.linkedLegacyNames || []).some((n) => n.toUpperCase() === lp.name.toUpperCase())
    );
    if (previous && target && previous.email === target.email) return;

    const withoutClaim = (u: UserProfile): UserProfile => ({
      ...u,
      linkedLegacyIds: (u.linkedLegacyIds || []).filter((id) => id !== legacyId),
      linkedLegacyNames: (u.linkedLegacyNames || []).filter((n) => n.toUpperCase() !== lp.name.toUpperCase()),
      pre2021Runs: Math.max(0, u.pre2021Runs - lp.oldCount),
      legacyEventRuns: Math.max(0, (u.legacyEventRuns || 0) - lp.newCount),
      totalRuns: Math.max(0, u.totalRuns - lp.oldCount - lp.newCount),
    });
    const withClaim = (u: UserProfile): UserProfile => ({
      ...u,
      linkedLegacyIds: [...(u.linkedLegacyIds || []), legacyId],
      linkedLegacyNames: [...(u.linkedLegacyNames || []), lp.name],
      pre2021Runs: u.pre2021Runs + lp.oldCount,
      legacyEventRuns: (u.legacyEventRuns || 0) + lp.newCount,
      totalRuns: u.totalRuns + lp.oldCount + lp.newCount,
    });

    const changed: UserProfile[] = [];
    if (previous) changed.push(withoutClaim(previous));
    if (target) changed.push(withClaim(target));
    const toKey = target ? await memberKeyFor(target.email) : null;
    const claimedAt = target ? new Date().toISOString() : null;

    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'legacy_profiles', legacyId), { claimedBy: toKey, claimedAt });
      for (const u of changed) {
        const key = await memberKeyFor(u.email);
        batch.set(doc(db, 'users', u.email), cleanFirestoreData(u));
        batch.set(doc(db, 'members', key), toPublicMember(u, key));
      }
      await batch.commit();
    }
    setLegacyMembers((prev) => prev.map((m) => (m.id === legacyId ? { ...m, claimedBy: toKey, claimedAt } : m)));
    setUsers((prev) => prev.map((u) => changed.find((c) => c.email === u.email) || u));
    for (const u of changed) await refreshDerivedStats(u);
  };

  /**
   * Admin: import (or re-import) the old app's two CSV exports. Existing claims
   * are kept, and claimers' totals are recalculated from the new counts.
   */
  const importLegacyData = async (totalsCsv: string, checkinsCsv: string, onProgress?: (msg: string) => void) => {
    const imp = buildLegacyImport(totalsCsv, checkinsCsv);
    if (!isFirebaseConfigured || !db) {
      setLegacyMembers(imp.profiles.map((p) => ({ ...p, claimedBy: null, claimedByEmail: null, claimedAt: null })));
      return imp.stats;
    }
    const currentDb = db;
    const existing = await getDocs(query(collection(currentDb, 'legacy_profiles'), where('claimedBy', '!=', null)));
    const claims = new Map(existing.docs.map((d) => [d.id, d.data()]));

    type Write = (b: ReturnType<typeof writeBatch>) => void;
    const writes: Write[] = [
      (b) =>
        b.set(doc(currentDb, 'legacy_index', 'pool'), {
          entries: imp.profiles.map(({ id, name, oldCount, newCount }) => ({ id, name, oldCount, newCount })),
          importedAt: new Date().toISOString(),
        }),
    ];
    for (const p of imp.profiles) {
      const c = claims.get(p.id);
      writes.push((b) =>
        b.set(doc(currentDb, 'legacy_profiles', p.id), {
          ...p,
          claimedBy: (c?.claimedBy as string) || null,
          claimedAt: (c?.claimedAt as string) || null,
        })
      );
      writes.push((b) => b.set(doc(currentDb, 'legacy_history', p.id), { id: p.id, events: imp.histories[p.id] || [] }));
    }

    // Re-total every claimer from the imported counts (ids that no longer exist are dropped).
    const byId = new Map(imp.profiles.map((p) => [p.id, p]));
    const retotaled: UserProfile[] = [];
    for (const u of users) {
      if (!(u.linkedLegacyIds || []).length) continue;
      const lps = (u.linkedLegacyIds || []).filter((id) => byId.has(id)).map((id) => byId.get(id)!);
      const pre = lps.reduce((sum, p) => sum + p.oldCount, 0);
      const ev = lps.reduce((sum, p) => sum + p.newCount, 0);
      retotaled.push({
        ...u,
        linkedLegacyIds: lps.map((p) => p.id),
        linkedLegacyNames: lps.map((p) => p.name),
        pre2021Runs: pre,
        legacyEventRuns: ev,
        totalRuns: pre + ev + u.loggedRuns,
      });
    }
    for (const u of retotaled) {
      const key = await memberKeyFor(u.email);
      writes.push((b) => b.set(doc(currentDb, 'users', u.email), cleanFirestoreData(u)));
      writes.push((b) => b.set(doc(currentDb, 'members', key), toPublicMember(u, key)));
    }

    const CHUNK = 400;
    for (let i = 0; i < writes.length; i += CHUNK) {
      const batch = writeBatch(currentDb);
      writes.slice(i, i + CHUNK).forEach((w) => w(batch));
      await batch.commit();
      onProgress?.(`Saved ${Math.min(i + CHUNK, writes.length)} of ${writes.length} records…`);
    }

    setUsers((prev) => prev.map((u) => retotaled.find((r) => r.email === u.email) || u));
    await loadLegacyPool();
    for (const u of retotaled) await refreshDerivedStats(u);
    return imp.stats;
  };


  return { loadLegacyPool, fetchLegacyEvents, fetchRunnerCheckins, refreshDerivedStats, claimLegacyProfile, adminSetLegacyClaim, importLegacyData };
}
