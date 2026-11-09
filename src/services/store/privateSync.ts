/** Club store operations: privateSync. */
import {
  UserProfile,
  CheckInRecord,
  MilestoneAlert,
} from '../../types';
import {
  INITIAL_ROUTES,
} from '../../data/initialData';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { memberKeyFor } from '../../utils/memberKey';
import { formatRouteForFirestore, hydrateRouteFromFirestore, recentCheckinCutoff, toPublicMember } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';

/** Order-insensitive comparison of two plain JSON-like values. */
function sameJson(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(norm)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function createPrivateSyncOps(ctx: StoreState & ReturnType<typeof createLegacyOps>) {
  const {
    setUsers,
    setMeetupEvents,
    staffCodeWords,
    setCheckins,
    setOwnLegacyEvents,
    setLegacyMembers,
    setMilestoneAlerts,
    fetchLegacyEvents,
    loadLegacyPool,
  } = ctx;

  /**
   * Load private data for the signed-in viewer. Staff get the full roster,
   * check-in log, gear queue and code words; runners get only their own check-ins.
   */
  const syncPrivateData = async (email: string, isStaff: boolean, isAdmin = false) => {
    if (!isFirebaseConfigured || !db) return;
    const currentDb = db;
    const cleanEmail = email.trim().toLowerCase();
    const ownCheckinsQuery = query(collection(currentDb, 'checkins'), where('userEmail', '==', cleanEmail));

    try {
      // Own claimed legacy history feeds streaks and badges at check-in.
      getDoc(doc(currentDb, 'users', cleanEmail))
        .then((snap) => fetchLegacyEvents((snap.exists() && (snap.data().linkedLegacyIds as string[])) || []))
        .then(setOwnLegacyEvents)
        .catch((err) => console.warn('Legacy history load failed:', err));

      if (!isStaff) {
        const own = await getDocs(ownCheckinsQuery);
        const ownCheckins = own.docs.map((d) => d.data() as CheckInRecord);
        setCheckins((prev) => {
          const ids = new Set(ownCheckins.map((c) => c.id));
          return [...ownCheckins, ...prev.filter((c) => !ids.has(c.id) && c.userEmail.toLowerCase() !== cleanEmail)];
        });
        return;
      }

      loadLegacyPool().catch((err) => console.warn('Legacy pool load failed:', err));

      // Check-ins grow every week: staff load the last RECENT_CHECKIN_DAYS for the
      // Check-In Log, plus all of their own (for their streaks). Anything that
      // recalculates another runner's stats queries that runner's check-ins.
      const [usersSnap, recentSnap, ownSnap, alertsSnap, routesSnap, secretsSnap] = await Promise.all([
        getDocs(collection(currentDb, 'users')),
        getDocs(query(collection(currentDb, 'checkins'), where('date', '>=', recentCheckinCutoff()))),
        getDocs(ownCheckinsQuery),
        getDocs(collection(currentDb, 'milestone_alerts')),
        getDocs(collection(currentDb, 'routes')),
        getDocs(collection(currentDb, 'meetup_secrets')),
      ]);

      const remoteUsers = usersSnap.docs.map((d) => d.data() as UserProfile);
      setUsers(remoteUsers);

      const loaded = new Map<string, CheckInRecord>();
      [...recentSnap.docs, ...ownSnap.docs].forEach((d) => loaded.set(d.id, d.data() as CheckInRecord));
      setCheckins([...loaded.values()]);

      setMilestoneAlerts(alertsSnap.docs.map((d) => d.data() as MilestoneAlert).filter((a) => Boolean(a.userEmail)));

      // Code words (staff), keyed by run ID.
      const codeWords: Record<string, string> = {};
      secretsSnap.docs.forEach((d) => {
        const cw = d.data().codeWord;
        if (typeof cw === 'string') codeWords[d.id] = cw;
      });
      staffCodeWords.current = codeWords;
      setMeetupEvents((prev) => prev.map((e) => (codeWords[e.id] ? { ...e, codeWord: codeWords[e.id] } : e)));

      // Save any official club route that isn't in Firestore yet (staff only; runners can't write routes).
      const savedRouteIds = new Set(routesSnap.docs.map((d) => d.id));
      const unsavedOfficial = INITIAL_ROUTES.filter((r) => !savedRouteIds.has(r.id)).map(hydrateRouteFromFirestore);
      if (unsavedOfficial.length) {
        const results = await Promise.allSettled(
          unsavedOfficial.map((r) => setDoc(doc(currentDb, 'routes', r.id), formatRouteForFirestore(r)))
        );
        const failed = results.filter((x) => x.status === 'rejected').length;
        if (failed) console.warn(`Saving official club routes: ${failed} of ${unsavedOfficial.length} failed.`);
      }

      // Make sure every profile has an up-to-date hashed leaderboard row. Only
      // admins may write other people's rows, and only rows that differ are written
      // (reads are much cheaper than writes on the free plan).
      if (isAdmin) {
        const rowsSnap = await getDocs(collection(currentDb, 'members'));
        const rows = new Map(rowsSnap.docs.map((d) => [d.id, d.data()]));
        const results = await Promise.allSettled(
          remoteUsers.map(async (u) => {
            const key = await memberKeyFor(u.email);
            const row = toPublicMember(u, key);
            if (!sameJson(rows.get(key), row)) await setDoc(doc(currentDb, 'members', key), row);
          })
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed) console.warn(`Leaderboard refresh: ${failed} of ${remoteUsers.length} rows could not be updated.`);
      }
    } catch (err) {
      console.warn('Private Firestore sync failed:', err);
    }
  };

  /** Drop other people's data (and our own private history) from memory on sign-out. */
  const clearPrivateData = () => {
    // In local (no-Firebase) mode the browser IS the database, so keep it.
    if (!isFirebaseConfigured) return;
    setUsers([]);
    setCheckins([]);
    setMilestoneAlerts([]);
    setOwnLegacyEvents([]);
    setLegacyMembers([]);
    staffCodeWords.current = {};
    setMeetupEvents((prev) => prev.map((e) => ({ ...e, codeWord: '' })));
  };


  return { syncPrivateData, clearPrivateData };
}
