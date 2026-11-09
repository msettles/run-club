/** Club store operations: privateSync. */
import { 
  RunEvent, 
  UserProfile,
  CheckInRecord,
  MilestoneAlert,
} from '../../types';
import { computeCheckInWindow, eventStart } from '../../utils/checkInWindow';
import { 
  INITIAL_ROUTES, 
} from '../../data/initialData';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  query,
  where,
  writeBatch,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { codeKeyFor, memberKeyFor } from '../../utils/memberKey';
import { PRIVATE_STORAGE_KEYS, STORAGE_KEYS, formatRouteForFirestore, hydrateRouteFromFirestore, meetupFromPublicDoc, recentCheckinCutoff, toPublicMember } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';

export function createPrivateSyncOps(ctx: StoreState & ReturnType<typeof createLegacyOps>) {
  const {
    setUsers,
    setMeetupEvents,
    setCheckins,
    setOwnLegacyEvents,
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

    try {
      // Own claimed legacy history feeds streaks and badges at check-in.
      const ownSnap = await getDoc(doc(currentDb, 'users', cleanEmail));
      const ownIds = (ownSnap.exists() && (ownSnap.data().linkedLegacyIds as string[])) || [];
      fetchLegacyEvents(ownIds).then(setOwnLegacyEvents).catch((err) => console.warn('Legacy history load failed:', err));
      if (isStaff) loadLegacyPool().catch((err) => console.warn('Legacy pool load failed:', err));

      if (!isStaff) {
        const own = await getDocs(query(collection(currentDb, 'checkins'), where('userEmail', '==', cleanEmail)));
        const ownCheckins = own.docs.map((d) => d.data() as CheckInRecord);
        setCheckins((prev) => {
          const ids = new Set(ownCheckins.map((c) => c.id));
          return [...ownCheckins, ...prev.filter((c) => !ids.has(c.id) && c.userEmail.toLowerCase() !== cleanEmail)];
        });
        return;
      }

      const usersSnap = await getDocs(collection(currentDb, 'users'));
      const remoteUsers = usersSnap.docs
        .map((d) => d.data() as UserProfile);
      if (remoteUsers.length > 0) {
        const remoteEmails = new Set(remoteUsers.map((u) => u.email.toLowerCase()));
        setUsers((prev) => [...remoteUsers, ...prev.filter((u) => !remoteEmails.has(u.email.toLowerCase()))]);
      }

      // Check-ins grow every week: staff load the last RECENT_CHECKIN_DAYS for the
      // Check-In Log, plus all of their own (for their streaks). Anything that
      // recalculates another runner's stats queries that runner's check-ins.
      const [recentSnap, ownSnap2] = await Promise.all([
        getDocs(query(collection(currentDb, 'checkins'), where('date', '>=', recentCheckinCutoff()))),
        getDocs(query(collection(currentDb, 'checkins'), where('userEmail', '==', cleanEmail))),
      ]);
      const loaded = new Map<string, CheckInRecord>();
      [...recentSnap.docs, ...ownSnap2.docs].forEach((d) => loaded.set(d.id, d.data() as CheckInRecord));
      setCheckins([...loaded.values()]);

      const alertsSnap = await getDocs(collection(currentDb, 'milestone_alerts'));
      const remoteAlerts = alertsSnap.docs
        .map((d) => d.data() as MilestoneAlert)
        .filter((a) => Boolean(a.userEmail));
      if (remoteAlerts.length > 0) {
        const remoteIds = new Set(remoteAlerts.map((a) => a.id));
        setMilestoneAlerts((prev) => [...remoteAlerts, ...prev.filter((a) => !remoteIds.has(a.id))]);
      }

      // Save any official club route that isn't in Firestore yet (staff only; runners can't write routes).
      const savedRouteIds = new Set((await getDocs(collection(currentDb, 'routes'))).docs.map((d) => d.id));
      const unsavedOfficial = INITIAL_ROUTES.filter((r) => !savedRouteIds.has(r.id)).map(hydrateRouteFromFirestore);
      if (unsavedOfficial.length) {
        const results = await Promise.allSettled(
          unsavedOfficial.map((r) => setDoc(doc(currentDb, 'routes', r.id), formatRouteForFirestore(r)))
        );
        const failed = results.filter((x) => x.status === 'rejected').length;
        if (failed) console.warn(`Saving official club routes: ${failed} of ${unsavedOfficial.length} failed.`);
      }

      // Code words (staff), keyed by run ID.
      const secretsSnap = await getDocs(collection(currentDb, 'meetup_secrets'));
      const codeWords: Record<string, string> = {};
      secretsSnap.docs.forEach((d) => {
        const cw = d.data().codeWord;
        if (typeof cw === 'string') codeWords[d.id] = cw;
      });

      // One-time migration (admins): check-in events and check-ins used to be keyed
      // by date. Re-key each to its run (one check-in per runner per run) and add
      // the code word lookup key. Dates with no run, or more than one, are skipped.
      let migrated = false;
      if (isAdmin) {
        const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;
        const [evSnap, runsSnap] = await Promise.all([
          getDocs(collection(currentDb, 'meetup_events')),
          getDocs(collection(currentDb, 'runs')),
        ]);
        const allRuns = runsSnap.docs.map((d) => d.data() as RunEvent);
        for (const d of evSnap.docs) {
          if (!DATE_ID.test(d.id)) continue;
          const data = d.data();
          const date: string = data.date || d.id;
          const matches = allRuns.filter((r) => r.date === date);
          if (matches.length !== 1) {
            console.warn(`Not migrating check-in event ${d.id}: ${matches.length} runs on that date.`);
            continue;
          }
          const runId = matches[0].id;
          const word = (codeWords[d.id] || (typeof data.codeWord === 'string' ? data.codeWord : '')).trim().toUpperCase();
          const win = computeCheckInWindow(date, data.time);
          const { codeWord: _legacyWord, ...rest } = data;
          try {
            const batch = writeBatch(currentDb);
            batch.set(doc(currentDb, 'meetup_events', runId), {
              ...rest,
              id: runId,
              runId,
              date,
              checkInOpensAt: data.checkInOpensAt instanceof Timestamp ? data.checkInOpensAt : Timestamp.fromDate(win.opensAt),
              checkInClosesAt: data.checkInClosesAt instanceof Timestamp ? data.checkInClosesAt : Timestamp.fromDate(win.closesAt),
            });
            if (word) {
              batch.set(doc(currentDb, 'meetup_secrets', runId), { codeWord: word });
              batch.set(doc(currentDb, 'meetup_codes', await codeKeyFor(date, word)), { runId, date });
            }
            const ciSnap = await getDocs(query(collection(currentDb, 'checkins'), where('date', '==', date)));
            for (const c of ciSnap.docs) {
              const cd = c.data() as CheckInRecord;
              if (cd.runId) continue;
              const newId = `${runId}_${cd.userEmail}`;
              batch.set(doc(currentDb, 'checkins', newId), { ...cd, id: newId, runId });
              batch.delete(c.ref);
            }
            batch.delete(d.ref);
            if (codeWords[d.id] !== undefined) batch.delete(doc(currentDb, 'meetup_secrets', d.id));
            await batch.commit();
            if (word) codeWords[runId] = word;
            delete codeWords[d.id];
            migrated = true;
          } catch (err) {
            console.warn(`Migrating check-in event ${d.id} failed:`, err);
          }
        }
      }

      // Older migration: code word left on a public doc, or no check-in window yet.
      const publicSnap = await getDocs(collection(currentDb, 'meetup_events'));
      for (const d of publicSnap.docs) {
        const data = d.data();
        const legacyCodeWord = typeof data.codeWord === 'string' ? data.codeWord.trim().toUpperCase() : '';
        const needsWindow = !(data.checkInOpensAt instanceof Timestamp);
        if (!legacyCodeWord && !needsWindow) continue;
        if (legacyCodeWord && !codeWords[d.id]) {
          codeWords[d.id] = legacyCodeWord;
          await setDoc(doc(currentDb, 'meetup_secrets', d.id), { codeWord: legacyCodeWord });
        }
        const start = eventStart(data.date || d.id, data.time);
        await updateDoc(doc(currentDb, 'meetup_events', d.id), {
          codeWord: deleteField(),
          checkInOpensAt: Timestamp.fromDate(new Date(start.getTime() - 2 * 60 * 60 * 1000)),
          checkInClosesAt: Timestamp.fromDate(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59)),
        });
      }
      const freshEvents = migrated
        ? (await getDocs(collection(currentDb, 'meetup_events'))).docs.map((d) => meetupFromPublicDoc(d.data()))
        : null;
      setMeetupEvents((prev) =>
        (freshEvents || prev).map((e) => (codeWords[e.id] ? { ...e, codeWord: codeWords[e.id] } : e))
      );
      if (migrated) {
        const ciSnap = await getDocs(query(collection(currentDb, 'checkins'), where('date', '>=', recentCheckinCutoff())));
        setCheckins(ciSnap.docs.map((d) => d.data() as CheckInRecord));
      }

      // Make sure every profile has an up-to-date hashed leaderboard row.
      // Only admins may write other people's rows.
      // Background maintenance (no one is waiting on it): report failures in one warning.
      if (isAdmin) {
        const results = await Promise.allSettled(
          remoteUsers.map(async (u) => {
            const key = await memberKeyFor(u.email);
            await setDoc(doc(currentDb, 'members', key), toPublicMember(u, key));
          })
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed) console.warn(`Leaderboard refresh: ${failed} of ${remoteUsers.length} rows could not be updated.`);
      }
    } catch (err) {
      console.warn('Private Firestore sync failed:', err);
    }
  };

  /** Drop other people's data from memory and this device on sign-out. */
  const clearPrivateData = () => {
    // In local (no-Firebase) mode the browser IS the database, so keep it.
    if (!isFirebaseConfigured) return;
    setUsers([]);
    setCheckins([]);
    setMilestoneAlerts([]);
    setMeetupEvents((prev) => prev.map((e) => ({ ...e, codeWord: '' })));
    for (const k of PRIVATE_STORAGE_KEYS) {
      try {
        localStorage.removeItem(STORAGE_KEYS[k]);
      } catch {
        // ignore
      }
    }
  };


  return { syncPrivateData, clearPrivateData };
}
