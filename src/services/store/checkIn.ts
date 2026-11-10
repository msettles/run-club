/** Atomic runner check-in: every retry reads the profile and check-in it changes. */
import type { Attendee, UserProfile, CheckInRecord, MeetupEvent, MilestoneAlert } from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import { doc, runTransaction, getDocFromServer } from 'firebase/firestore';
import { memberKeyFor } from '../../utils/memberKey';
import { cleanFirestoreData, memberFromUser, meetupFromPublicDoc } from './helpers';
import { calculateCheckIn, type CheckInParams } from './checkInModel';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';

export function createCheckInOps(ctx: StoreState & ReturnType<typeof createLegacyOps>) {
  const checkInRunner = async (params: CheckInParams) => {
    const privateEpoch = ctx.privateSessionEpoch?.current;
    const email = params.userEmail.trim().toLowerCase();
    const id = `${params.eventId}_${email}`;
    const key = await memberKeyFor(email);
    try {
      const prepare = async (user: UserProfile, event: MeetupEvent, existing?: CheckInRecord) => {
        if (!user || user.role === 'guest') throw new Error('Please join the club first.');
        // Queries occur after the transaction's profile read. All attendance and
        // claim mutations also change that profile, so concurrent writes retry
        // the complete calculation, including these history queries.
        const [history, legacy] = await Promise.all([ctx.fetchRunnerCheckins(email), ctx.fetchLegacyEvents(user.linkedLegacyIds || [])]);
        return calculateCheckIn(params, user, event, existing, history, legacy, ctx.badges, ctx.meetupEvents);
      };
      let result: Awaited<ReturnType<typeof prepare>>;
      let attendees: Attendee[];
      let rewardPreview: UserProfile | undefined;
      if (isFirebaseConfigured && db) {
        const firestore = db;
        let observed = '';
        let observedRun = '';
        const commit = () => runTransaction(firestore, async (tx) => {
          const runRef = doc(firestore, 'runs', params.eventId);
          const userRef = doc(firestore, 'users', email);
          const ciRef = doc(firestore, 'checkins', id);
          const [run, user, ci, event, importLock] = await Promise.all([
            tx.get(runRef), tx.get(userRef), tx.get(ciRef), tx.get(doc(firestore, 'meetup_events', params.eventId)), tx.get(doc(firestore, 'settings', 'legacy_import')),
          ]);
          observed = JSON.stringify(user.data());
          observedRun = JSON.stringify(run.data());
          if (importLock.data()?.active) throw new Error('Historical records are being updated. Check-in will reopen when the import finishes.');
          if (!run.exists() || !user.exists() || !event.exists() || run.data().deleting) throw new Error('This run or profile is no longer available.');
          const computed = await prepare(user.data() as UserProfile, meetupFromPublicDoc(event.data()), ci.exists() ? ci.data() as CheckInRecord : undefined);
          // Keep the reward preview separate from the authoritative persisted fields.
          const persistedUser = { ...computed.updatedUser };
          for (const field of ['unlockedBadgeIds', 'badgeCounts', 'currentStreakWeeks', 'longestStreakWeeks'] as const) {
            Object.assign(persistedUser, { [field]: user.data()[field] });
          }
          let alert: MilestoneAlert | undefined = computed.unlockedMilestone;
          if (alert && (await tx.get(doc(firestore, 'milestone_alerts', alert.id))).exists()) alert = undefined;
          const mine: Attendee = { memberId: key, name: computed.updatedUser.displayName, checkedIn: true, checkedInAt: computed.newCheckIn.createdAt, rsvpDate: computed.newCheckIn.createdAt };
          const current = (run.data().attendees || []) as Attendee[];
          const previous = current.find((a) => a.memberId === key);
          const next = [...current.filter((a) => a.memberId !== key), { ...mine, ...(previous ? { rsvpDate: previous.rsvpDate } : {}) }];
          tx.update(runRef, { attendees: next });
          tx.set(ciRef, cleanFirestoreData(computed.newCheckIn));
          tx.set(userRef, cleanFirestoreData(persistedUser));
          if (alert) tx.set(doc(firestore, 'milestone_alerts', alert.id), cleanFirestoreData(alert));
          return { preview: computed.updatedUser, computed: { ...computed, updatedUser: persistedUser, unlockedMilestone: alert }, attendees: next };
        });
        let saved;
        for (let attempt = 0; ; attempt++) {
          try { saved = await commit(); break; }
          catch (error) {
            if ((error as { code?: string }).code !== 'permission-denied' || attempt >= 4) throw error;
            const [current, run] = await Promise.all([getDocFromServer(doc(firestore, 'users', email)), getDocFromServer(doc(firestore, 'runs', params.eventId))]);
            // Rules can see a concurrent commit before the server reports a conflict.
            if (JSON.stringify(current.data()) === observed && JSON.stringify(run.data()) === observedRun) throw error;
          }
        }
        result = saved.computed;
        rewardPreview = saved.preview;
        attendees = saved.attendees;
      } else {
        const event = ctx.meetupEvents.find((e) => e.id === params.eventId);
        const user = ctx.users.find((u) => u.email.toLowerCase() === email) || (ctx.currentUser.email.toLowerCase() === email ? ctx.currentUser : undefined);
        if (!event || !user) throw new Error('This run or profile is no longer available.');
        if (event.codeWord.trim().toUpperCase() !== params.codeWordEntered.trim().toUpperCase()) throw new Error('Incorrect code word.');
        result = await prepare(user, event, ctx.checkins.find((c) => c.id === id));
        if (ctx.milestoneAlerts.some((a) => a.id === result.unlockedMilestone?.id)) result.unlockedMilestone = undefined;
        const run = ctx.runs?.find((r) => r.id === params.eventId);
        const previous = run?.attendees.find((a) => a.memberId === key);
        attendees = [...(run?.attendees || []).filter((a) => a.memberId !== key), { memberId: key, name: user.displayName, checkedIn: true, checkedInAt: result.newCheckIn.createdAt, rsvpDate: previous?.rsvpDate || result.newCheckIn.createdAt }];
      }
      const { newCheckIn, creditedRoute, earnedBadges, unlockedMilestone, isUpdate } = result;
      const { updatedUser } = result;
      let rewardsReady: Promise<unknown> | undefined;
      if (privateEpoch === ctx.privateSessionEpoch?.current) {
      ctx.setRuns((prev) => prev.map((run) => run.id === params.eventId ? { ...run, attendees } : run));
      if (isFirebaseConfigured && db) {
        rewardsReady = Promise.allSettled([ctx.refreshDerivedStats(updatedUser), ctx.syncMemberProjection(email)]).then((results) => {
          for (const result of results) if (result.status === 'rejected') {
            console.warn('Check-in saved; a secondary refresh needs a retry:', result.reason);
            if (privateEpoch === ctx.privateSessionEpoch?.current) ctx.setPrivateSyncError?.('Your check-in is saved. Rewards or leaderboard data could not be refreshed. Please retry loading.');
          }
        });
      }
      ctx.setCheckins((prev) => [newCheckIn, ...prev.filter((c) => c.id !== id)]);
      ctx.setUsers((prev) => [updatedUser, ...prev.filter((u) => u.email.toLowerCase() !== email)]);
      ctx.setMembers((prev) => [memberFromUser(updatedUser, key, isFirebaseConfigured), ...prev.filter((m) => m.id !== key)]);
      if (unlockedMilestone) ctx.setMilestoneAlerts((prev) => [unlockedMilestone, ...prev.filter((a) => a.id !== unlockedMilestone.id)]);
      }
      return { rewardsReady, success: true, message: isUpdate ? 'Check-in updated!' : 'Checked in successfully!', checkIn: newCheckIn, user: rewardPreview || updatedUser, route: creditedRoute, newBadges: earnedBadges, milestoneAlert: unlockedMilestone };
    } catch (error) {
      console.error('Check-in failed:', error);
      const err = error as { code?: string; message?: string };
      return { success: false, message: err.code === 'permission-denied' ? 'Check-in was not accepted. Refresh this run and verify its code word and check-in window.' : err.message || 'Could not save check-in. Check your connection and try again.' };
    }
  };
  const markMilestoneFulfilled = async (id: string, fulfilledBy: string) => {
    const fulfilledAt = new Date().toISOString();
    if (isFirebaseConfigured && db) {
      const firestore = db;
      await runTransaction(firestore, async (tx) => {
        const ref = doc(firestore, 'milestone_alerts', id);
        if (!(await tx.get(ref)).exists()) throw new Error('This gear alert no longer exists. Refresh the queue.');
        tx.update(ref, { fulfilled: true, fulfilledAt, fulfilledBy });
      });
    }
    ctx.setMilestoneAlerts((prev) => prev.map((a) => a.id === id ? { ...a, fulfilled: true, fulfilledAt, fulfilledBy } : a));
  };
  return { checkInRunner, markMilestoneFulfilled };
}
