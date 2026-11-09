/** Club store operations: runs. */
import { 
  RunEvent, 
  GPXRoute, 
  UserProfile,
  MeetupEvent,
  CheckInRecord,
} from '../../types';
import { computeCheckInWindow } from '../../utils/checkInWindow';
import { buildMeetupFromRun } from '../../utils/runChoices';
import {
  adjustDistanceCounts,
  datedEventsFrom,
  recomputeBadges,
  lastCheckInFields,
} from '../../utils/legacy';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { codeKeyFor, memberKeyFor } from '../../utils/memberKey';
import { isAdminProfile } from '../../utils/roles';
import { assertRouteFitsFirestore, cleanFirestoreData, formatRouteForFirestore, memberFromUser, toPublicMember } from './helpers';
import type { StoreState } from './state';
import type { createEventOps } from './events';
import type { createLegacyOps } from './legacy';

export function createRunOps(ctx: StoreState & ReturnType<typeof createLegacyOps> & ReturnType<typeof createEventOps>) {
  const {
    runs,
    saveMeetupEvent,
    setRuns,
    routes,
    setRoutes,
    setMembers,
    badges,
    setUsers,
    meetupEvents,
    setMeetupEvents,
    checkins,
    setCheckins,
    currentUserEmail,
    setMilestoneAlerts,
    currentUser,
    users,
    currentMember,
    fetchLegacyEvents,
    fetchRunnerCheckins,
  } = ctx;

  /** RSVP / un-RSVP the signed-in runner. Saves first; throws if the server refuses. */
  const toggleRSVP = async (runId: string) => {
    if (!currentUserEmail || currentMember.id === 'guest') return;
    const run = runs.find((r) => r.id === runId);
    if (!run) return;
    const mineBefore = run.attendees.find((a) => a.memberId === currentMember.id);
    const mine = mineBefore || {
      memberId: currentMember.id,
      name: currentMember.name,
      checkedIn: false,
      rsvpDate: new Date().toISOString(),
    };
    if (isFirebaseConfigured && db) {
      // Only touch our own attendee entry (rules reject any other change by runners).
      await updateDoc(doc(db, 'runs', runId), { attendees: mineBefore ? arrayRemove(mine) : arrayUnion(mine) });
    }
    setRuns((prev) =>
      prev.map((r) =>
        r.id !== runId
          ? r
          : {
              ...r,
              attendees: mineBefore
                ? r.attendees.filter((a) => a.memberId !== currentMember.id)
                : [...r.attendees.filter((a) => a.memberId !== currentMember.id), mine],
            }
      )
    );
  };

  /**
   * Create a run together with its check-in event, code word and code word
   * lookup key in ONE write, so a run never exists without a working check-in.
   * If the code word is already used by another run that day, nothing is saved.
   * The creator is not RSVP'd automatically.
   */
  const createRunWithCheckIn = async (newRun: Omit<RunEvent, 'id' | 'attendees'>, codeWord: string): Promise<RunEvent> => {
    const word = codeWord.trim().toUpperCase();
    if (!word) throw new Error('Enter the check-in code word.');
    const duplicateError = () =>
      Object.assign(new Error(`The code word ${word} is already used by another run on ${newRun.date}. Pick a different word.`), {
        code: 'duplicate-code-word',
      });
    if (meetupEvents.some((e) => e.date === newRun.date && (e.codeWord || '').toUpperCase() === word)) throw duplicateError();

    const id = `run-${Date.now()}`;
    const run: RunEvent = { ...newRun, id, attendees: [] };
    const win = computeCheckInWindow(run.date, run.time);
    const event: MeetupEvent = {
      ...buildMeetupFromRun(run, routes, word),
      codeWordSet: true,
      checkInOpensAt: win.opensAt.toISOString(),
      checkInClosesAt: win.closesAt.toISOString(),
    };

    if (isFirebaseConfigured && db) {
      const key = await codeKeyFor(run.date, word);
      if ((await getDoc(doc(db, 'meetup_codes', key))).exists()) throw duplicateError();
      const { codeWord: _cw, checkInOpensAt: _o, checkInClosesAt: _c, ...publicEvent } = event;
      const batch = writeBatch(db);
      batch.set(doc(db, 'runs', id), cleanFirestoreData(run));
      batch.set(doc(db, 'meetup_events', id), {
        ...cleanFirestoreData(publicEvent),
        checkInOpensAt: Timestamp.fromDate(win.opensAt),
        checkInClosesAt: Timestamp.fromDate(win.closesAt),
      });
      batch.set(doc(db, 'meetup_secrets', id), { codeWord: word });
      batch.set(doc(db, 'meetup_codes', key), { runId: id, date: run.date });
      // The duplicate check above already ran; any refusal here is reported as-is.
      await batch.commit();
    }
    setRuns((prev) => [run, ...prev]);
    setMeetupEvents((prev) => [event, ...prev.filter((e) => e.id !== id)]);
    return run;
  };

  /** Save a newly parsed GPX route (staff). Saves first; throws if the server refuses. */
  const addRoute = async (routeData: Omit<GPXRoute, 'id'>): Promise<GPXRoute> => {
    const newRoute: GPXRoute = { ...routeData, id: `route-${Date.now()}` };
    if (isFirebaseConfigured && db) {
      const formatted = formatRouteForFirestore(newRoute);
      assertRouteFitsFirestore(formatted);
      await setDoc(doc(db, 'routes', newRoute.id), formatted);
    }
    setRoutes((prev) => [newRoute, ...prev]);
    return newRoute;
  };

  /** Update an existing route (staff). Saves first; throws if the server refuses. */
  const updateRoute = async (routeId: string, updates: Partial<GPXRoute>): Promise<GPXRoute> => {
    const existing = routes.find((r) => r.id === routeId);
    const updatedObj: GPXRoute = {
      ...(existing || ({} as GPXRoute)),
      ...updates,
      id: routeId,
      updatedAt: new Date().toISOString(),
    };
    if (isFirebaseConfigured && db) {
      const formatted = formatRouteForFirestore(updatedObj);
      assertRouteFitsFirestore(formatted);
      // Replace the complete route so cleared links and old raw GPX fields disappear.
      await setDoc(doc(db, 'routes', routeId), formatted);
    }
    setRoutes((prev) => prev.map((r) => (r.id === routeId ? updatedObj : r)));
    return updatedObj;
  };

  /**
   * Delete an existing route (Organizer / Admin)
   */
  const deleteRoute = async (routeId: string): Promise<void> => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, 'routes', routeId));
    }
    setRoutes((prev) => prev.filter((r) => r.id !== routeId));
  };

  /**
   * Update an existing run's details (staff). The RSVP list is left alone: it may
   * have changed since the edit form opened, and only runners change their own RSVP.
   */
  const updateRun = async (updatedRun: RunEvent, codeWord: string) => {
    const existing = meetupEvents.find((e) => e.id === updatedRun.id);
    await saveMeetupEvent(buildMeetupFromRun(updatedRun, routes, codeWord, existing), updatedRun);
  };

  /** Undo one check-in's effect on a runner's totals (badges/streaks are recomputed separately). */
  const rollBackCheckIn = (u: UserProfile, c: CheckInRecord): UserProfile => {
    const m = c.actualMiles || 0;
    return {
      ...u,
      totalRuns: Math.max(0, u.totalRuns - 1),
      loggedRuns: Math.max(0, u.loggedRuns - 1),
      runCount: c.activity === 'running' ? Math.max(0, u.runCount - 1) : u.runCount,
      walkCount: c.activity === 'walking' ? Math.max(0, u.walkCount - 1) : u.walkCount,
      petRunCount: c.withPet ? Math.max(0, (u.petRunCount || 0) - 1) : u.petRunCount,
      totalMiles: Math.max(0, Math.round((u.totalMiles - m) * 100) / 100),
      distanceCounts: adjustDistanceCounts(u.distanceCounts, m, -1),
    };
  };

  /** How many runners checked into a run (server count in Firebase mode). */
  const countRunCheckIns = async (runId: string): Promise<number> => {
    if (isFirebaseConfigured && db) {
      const snap = await getDocs(query(collection(db, 'checkins'), where('runId', '==', runId)));
      return snap.size;
    }
    return checkins.filter((c) => c.runId === runId).length;
  };

  /**
   * Delete a run, its check-in event and code word. If runners checked in, their
   * check-ins are removed too and each runner's runs, miles, badges, streaks and
   * unfulfilled gear alerts from that run are rolled back (admins only: it rewrites
   * other runners' stats). Each runner is one atomic write, so a retry after a
   * partial failure carries on safely.
   */
  const deleteRun = async (runId: string) => {
    const ev = meetupEvents.find((e) => e.id === runId);
    const remainingEvents = meetupEvents.filter((e) => e.id !== runId);
    const touchedUsers: UserProfile[] = [];

    if (isFirebaseConfigured && db) {
      const currentDb = db;
      const [ciSnap, alertSnap] = await Promise.all([
        getDocs(query(collection(currentDb, 'checkins'), where('runId', '==', runId))),
        getDocs(query(collection(currentDb, 'milestone_alerts'), where('runId', '==', runId))),
      ]);
      if (!ciSnap.empty && !isAdminProfile(currentUser)) {
        throw Object.assign(
          new Error(`${ciSnap.size} runner${ciSnap.size === 1 ? ' has' : 's have'} checked into this run. Only an admin can delete it, because their run counts and miles are adjusted.`),
          { code: 'needs-admin' }
        );
      }

      for (const cDoc of ciSnap.docs) {
        const c = cDoc.data() as CheckInRecord;
        const email = c.userEmail.toLowerCase();
        const batch = writeBatch(currentDb);
        batch.delete(cDoc.ref);
        alertSnap.docs
          .filter((a) => (a.data().userEmail || '').toLowerCase() === email && !a.data().fulfilled)
          .forEach((a) => batch.delete(a.ref));

        const userSnap = await getDoc(doc(currentDb, 'users', email));
        if (userSnap.exists()) {
          const rolled = rollBackCheckIn(userSnap.data() as UserProfile, c);
          const legacy = await fetchLegacyEvents(rolled.linkedLegacyIds || []);
          const remaining = (await fetchRunnerCheckins(email)).filter((x) => x.id !== c.id);
          const final: UserProfile = { ...rolled, ...recomputeBadges(rolled, badges, datedEventsFrom(legacy, remaining, remainingEvents)), ...lastCheckInFields(remaining) };
          const key = await memberKeyFor(email);
          batch.set(doc(currentDb, 'users', email), cleanFirestoreData(final));
          batch.set(doc(currentDb, 'members', key), toPublicMember(final, key));
          touchedUsers.push(final);
        }
        await batch.commit();
      }

      const cleanup = writeBatch(currentDb);
      cleanup.delete(doc(currentDb, 'runs', runId));
      cleanup.delete(doc(currentDb, 'meetup_events', runId));
      if (ev?.codeWord) cleanup.delete(doc(currentDb, 'meetup_codes', await codeKeyFor(ev.date, ev.codeWord)));
      if (isAdminProfile(currentUser)) cleanup.delete(doc(currentDb, 'meetup_secrets', runId));
      await cleanup.commit();

    } else {
      for (const c of checkins.filter((c) => c.runId === runId)) {
        const user = users.find((u) => u.email.toLowerCase() === c.userEmail.toLowerCase());
        if (!user) continue;
        const remaining = checkins.filter((x) => x.id !== c.id && x.userEmail.toLowerCase() === c.userEmail.toLowerCase());
        const rolled = rollBackCheckIn(user, c);
        const legacy = await fetchLegacyEvents(user.linkedLegacyIds || []);
        touchedUsers.push({ ...rolled, ...recomputeBadges(rolled, badges, datedEventsFrom(legacy, remaining, remainingEvents)), ...lastCheckInFields(remaining) });
      }
    }
    if (touchedUsers.length) {
      const byEmail = new Map(touchedUsers.map((u) => [u.email.toLowerCase(), u]));
      setUsers((prev) => prev.map((u) => byEmail.get(u.email.toLowerCase()) || u));
      const keyed = await Promise.all(touchedUsers.map(async (u) => [await memberKeyFor(u.email), u] as const));
      setMembers((prev) => [
        ...keyed.map(([key, u]) => memberFromUser(u, key)),
        ...prev.filter((m) => !keyed.some(([key]) => key === m.id)),
      ]);
    }

    setCheckins((prev) => prev.filter((c) => c.runId !== runId));
    setMilestoneAlerts((prev) => prev.filter((a) => !(a.runId === runId && !a.fulfilled)));
    setRuns((prev) => prev.filter((r) => r.id !== runId));
    setMeetupEvents((prev) => prev.filter((e) => e.id !== runId));
  };


  return { toggleRSVP, createRunWithCheckIn, addRoute, updateRoute, deleteRoute, updateRun, rollBackCheckIn, countRunCheckIns, deleteRun };
}
