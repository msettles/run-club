/** Club store operations: checkIn. */
import { 
  Attendee,
  Badge, 
  UserProfile,
  CheckInRecord,
  ActivityType,
  DistanceChoice,
  RouteOption,
  MilestoneAlert,
} from '../../types';
import {
  adjustDistanceCounts,
  datedEventsFrom,
  recomputeBadges,
  type LegacyEvent,
} from '../../utils/legacy';
import { 
  CLUB_MILESTONES,
} from '../../data/initialData';
import { isFirebaseConfigured, db } from '../firebase';
import {
  setDoc,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { memberKeyFor } from '../../utils/memberKey';
import { cleanFirestoreData, memberFromUser, toPublicMember } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';

export function createCheckInOps(ctx: StoreState & ReturnType<typeof createLegacyOps>) {
  const {
    setRuns,
    setMembers,
    badges,
    users,
    setUsers,
    meetupEvents,
    checkins,
    setCheckins,
    ownLegacyEvents,
    currentUserEmail,
    milestoneAlerts,
    setMilestoneAlerts,
    currentUser,
    fetchLegacyEvents,
    fetchRunnerCheckins,
  } = ctx;

  /**
   * Check in a runner to a scheduled meetup event
   */
  const checkInRunner = async (params: {
    eventId: string; // the run's ID
    userEmail: string;
    codeWordEntered: string;
    activity: ActivityType;
    distanceChoice: DistanceChoice;
    loops?: number;
    withPet?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    route?: RouteOption;
    checkIn?: CheckInRecord;
    user?: UserProfile;
    newBadges?: Badge[];
    milestoneAlert?: MilestoneAlert;
  }> => {
    const { eventId, userEmail, codeWordEntered, activity, distanceChoice, loops, withPet } = params;
    const cleanEmail = userEmail.trim().toLowerCase();

    // 1. Locate exactly this run's check-in event (never fall back to another run)
    const event = meetupEvents.find((e) => e.id === eventId);
    if (!event) {
      return { success: false, message: "Check-in isn't set up for this run." };
    }
    const eventDate = event.date;

    // 2. Validate Code Word. With Firebase the code word is secret and the
    //    Firestore rules verify it; locally we compare against the stored one.
    if (!isFirebaseConfigured) {
      if (codeWordEntered.trim().toUpperCase() !== (event.codeWord || '').trim().toUpperCase()) {
        return {
          success: false,
          message: `Incorrect code word! Today's code word was announced by the organizer before the run.`,
        };
      }
    }

    // 3. Locate route option and actual measured miles
    let routeOption: RouteOption | undefined = event.routes[String(distanceChoice)];
    if (!routeOption) {
      const allRoutes = Object.values(event.routes || {});
      const numDist = typeof distanceChoice === 'number' ? distanceChoice : parseFloat(String(distanceChoice)) || 0;
      routeOption = allRoutes.find(
        (r) => r.routeId === String(distanceChoice) ||
               (numDist > 0 && Math.abs(r.actualMiles - numDist) < 0.25) ||
               r.name.toLowerCase() === String(distanceChoice).toLowerCase()
      );
    }
    if (!routeOption) {
      const numDist = typeof distanceChoice === 'number' ? distanceChoice : parseFloat(String(distanceChoice)) || 3.0;
      routeOption = {
        name: `${distanceChoice}-Mile Club Route`,
        actualMiles: numDist,
        baseMiles: numDist,
        directions: 'Follow group leader from Blue Note Brewing.',
      };
    }

    // 3b. Compute effective loops and actual credited mileage
    const effectiveLoops = (loops && loops > 0) ? loops : 1;
    const baseLoopMiles = routeOption.baseMiles || routeOption.actualMiles;
    const computedActualMiles = effectiveLoops > 1
      ? Math.round(baseLoopMiles * effectiveLoops * 100) / 100
      : routeOption.actualMiles;
    const computedRouteName = effectiveLoops > 1
      ? `${routeOption.name} (${effectiveLoops} Loops)`
      : routeOption.name;

    const creditedRoute: RouteOption = {
      ...routeOption,
      name: computedRouteName,
      actualMiles: computedActualMiles,
    };

    // 4. Find the runner. Never fall back to the signed-in user for someone else's email.
    const u = users.find((x) => x.email.toLowerCase() === cleanEmail)
      || (currentUser.email.toLowerCase() === cleanEmail ? currentUser : undefined);
    if (!u || u.role === 'guest') {
      return { success: false, message: 'No runner profile found for this email. Please join the club first.' };
    }

    // 5. The runner's full history from the server: whether this is an edit of
    //    tonight's check-in, and the dated runs that streaks and badges come from.
    //    (Staff only load recent check-ins, and sign-in loading may still be running.)
    const checkinId = `${eventId}_${cleanEmail}`;
    let history: CheckInRecord[];
    let legacyEvents: LegacyEvent[];
    try {
      const isSelf = cleanEmail === currentUserEmail.toLowerCase();
      [history, legacyEvents] = await Promise.all([
        fetchRunnerCheckins(cleanEmail),
        isSelf && ownLegacyEvents.length ? Promise.resolve(ownLegacyEvents) : fetchLegacyEvents(u.linkedLegacyIds || []),
      ]);
    } catch (err) {
      console.error('Loading runner history failed:', err);
      return { success: false, message: 'Could not reach the club server. Please check your connection and try again.' };
    }
    const existingCheckIn = history.find((c) => c.id === checkinId) || checkins.find((c) => c.id === checkinId);
    const isUpdate = Boolean(existingCheckIn);

    const now = new Date();
    const nowIso = now.toISOString();
    const timeStr = now.toTimeString().split(' ')[0]; // "HH:MM:SS"

    const newCheckIn: CheckInRecord = {
      ...(existingCheckIn || {}),
      id: checkinId,
      runId: eventId,
      date: eventDate,
      time: timeStr,
      userEmail: cleanEmail,
      runnerName: u.displayName,
      activity,
      distanceChoice,
      actualMiles: computedActualMiles,
      routeName: computedRouteName,
      loops: effectiveLoops,
      withPet: Boolean(withPet),
      source: 'pwa',
      codeWord: codeWordEntered.trim().toUpperCase(),
      createdAt: existingCheckIn?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    // 6. Updated totals (an edit swaps the old check-in's numbers for the new ones)
    const oldMiles = existingCheckIn ? existingCheckIn.actualMiles : 0;
    let runCount = u.runCount;
    let walkCount = u.walkCount;
    let petRunCount = u.petRunCount || 0;
    let distanceCounts = u.distanceCounts || {};
    if (existingCheckIn) {
      if (existingCheckIn.activity === 'running') runCount = Math.max(0, runCount - 1);
      if (existingCheckIn.activity === 'walking') walkCount = Math.max(0, walkCount - 1);
      if (existingCheckIn.withPet) petRunCount = Math.max(0, petRunCount - 1);
      distanceCounts = adjustDistanceCounts(distanceCounts, existingCheckIn.actualMiles, -1);
    }
    if (activity === 'running') runCount++;
    if (activity === 'walking') walkCount++;
    if (withPet) petRunCount++;
    distanceCounts = adjustDistanceCounts(distanceCounts, computedActualMiles, 1);

    const withTotals: UserProfile = {
      ...u,
      totalRuns: isUpdate ? u.totalRuns : u.totalRuns + 1,
      loggedRuns: isUpdate ? u.loggedRuns : u.loggedRuns + 1,
      totalMiles: Math.round((u.totalMiles - oldMiles + computedActualMiles) * 100) / 100,
      runCount,
      walkCount,
      petRunCount,
      distanceCounts,
    };

    // Badges and streaks: the same rules as every other recalculation (recomputeBadges),
    // over claimed old-app sign-ins plus this app's check-ins with tonight's in place.
    const derived = recomputeBadges(
      withTotals,
      badges,
      datedEventsFrom(legacyEvents, [...history.filter((c) => c.id !== checkinId), newCheckIn], meetupEvents)
    );
    const updatedUser: UserProfile = {
      ...withTotals,
      ...derived,
      lastCheckInDate: eventDate,
      lastCheckInRunId: eventId,
    };

    // Newly unlocked badges, or ones whose level went up, are celebrated.
    const before = (id: string) => u.badgeCounts?.[id] ?? ((u.unlockedBadgeIds || []).includes(id) ? 1 : 0);
    const earnedBadges = badges.filter((b) => (derived.badgeCounts?.[b.id] || 0) > before(b.id));

    // 7. Milestone gear alert — only when this check-in is what crossed the milestone
    //    (never on a same-night edit), with a deterministic ID so it can't duplicate.
    let unlockedMilestone: MilestoneAlert | undefined;
    if (!isUpdate) {
      const milestoneBadge = badges.find(
        (b) => b.category === 'milestone' && Boolean(b.triggerConfig?.reward) && b.triggerConfig?.minTotalRuns === updatedUser.totalRuns
      );
      const mDef = milestoneBadge ? undefined : CLUB_MILESTONES.find((m) => m.runsRequired === updatedUser.totalRuns);
      if (milestoneBadge || mDef) {
        unlockedMilestone = {
          id: `m${updatedUser.totalRuns}_${cleanEmail}`,
          userEmail: cleanEmail,
          runnerName: updatedUser.displayName,
          shirtSize: updatedUser.shirtSize,
          milestoneRuns: updatedUser.totalRuns,
          milestoneName: milestoneBadge ? milestoneBadge.name : mDef!.name,
          reward: milestoneBadge ? milestoneBadge.triggerConfig!.reward! : mDef!.reward,
          perks: milestoneBadge ? (milestoneBadge.triggerConfig?.perks || '$1 off draft beers at Blue Note') : mDef!.perks,
          date: eventDate,
          time: timeStr,
          runId: eventId,
          fulfilled: false,
        };
      }
    }

    // 8. Persist atomically. The Firestore rules verify the code word, the check-in
    //    window, and that the stats/leaderboard changes match this check-in.
    const memberKey = await memberKeyFor(cleanEmail);
    const attendee: Attendee = {
      memberId: memberKey,
      name: u.displayName,
      checkedIn: false,
      rsvpDate: nowIso,
    };
    if (isFirebaseConfigured && db) {
      const firestore = db;
      try {
        await runTransaction(firestore, async (batch) => {
          // Reading the run in this transaction preserves concurrent RSVPs and
          // avoids adding a second entry when the runner already RSVP'd.
          const runRef = doc(firestore, 'runs', eventId);
          const runSnapshot = await batch.get(runRef);
          if (!runSnapshot.exists()) throw new Error('Run no longer exists.');
          const attendees = (runSnapshot.data().attendees || []) as Attendee[];
          if (!attendees.some((a) => a.memberId === memberKey)) {
            batch.update(runRef, { attendees: [...attendees, attendee] });
          }
          batch.set(doc(firestore, 'checkins', checkinId), cleanFirestoreData(newCheckIn));
          batch.set(doc(firestore, 'users', cleanEmail), cleanFirestoreData(updatedUser));
          batch.set(doc(firestore, 'members', memberKey), toPublicMember(updatedUser, memberKey));
          if (unlockedMilestone && !milestoneAlerts.some((a) => a.id === unlockedMilestone!.id)) {
            batch.set(doc(firestore, 'milestone_alerts', unlockedMilestone.id), cleanFirestoreData(unlockedMilestone));
          }
        });
      } catch (err: any) {
        console.error('Check-in rejected by server:', err);
        return {
          success: false,
          message: err?.code === 'permission-denied'
            ? "Check-in wasn't accepted. Double-check this run's code word — check-in opens 2 hours before the run."
            : 'Could not reach the club server. Please check your connection and try again.',
        };
      }
    }

    // 9. Server accepted it (or local mode): update local state
    setRuns((prev) => prev.map((run) =>
      run.id !== eventId || run.attendees.some((a) => a.memberId === memberKey)
        ? run
        : { ...run, attendees: [...run.attendees, attendee] }
    ));
    setCheckins((prev) => [
      newCheckIn,
      ...prev.filter((c) => c.id !== checkinId),
    ]);
    setUsers((prev) => {
      const exists = prev.some((x) => x.email.toLowerCase() === cleanEmail);
      return exists
        ? prev.map((x) => (x.email.toLowerCase() === cleanEmail ? updatedUser : x))
        : [updatedUser, ...prev];
    });
    setMembers((prev) => [memberFromUser(updatedUser, memberKey), ...prev.filter((m) => m.id !== memberKey)]);
    if (unlockedMilestone) {
      const alert = unlockedMilestone;
      setMilestoneAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
    }

    return {
      success: true,
      message: isUpdate
        ? `Check-in updated to ${computedRouteName} (${computedActualMiles} mi)!`
        : `Checked in successfully! That's Run #${updatedUser.totalRuns} for you!`,
      route: creditedRoute,
      checkIn: newCheckIn,
      user: updatedUser,
      newBadges: earnedBadges,
      milestoneAlert: unlockedMilestone,
    };
  };

  /**
   * Mark a milestone reward as fulfilled / handed out by an organizer
   */
  const markMilestoneFulfilled = async (alertId: string, fulfilledBy: string) => {
    const fulfilledAt = new Date().toISOString();
    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'milestone_alerts', alertId), { fulfilled: true, fulfilledAt, fulfilledBy }, { merge: true });
    }
    setMilestoneAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, fulfilled: true, fulfilledAt, fulfilledBy } : a)));
  };


  return { checkInRunner, markMilestoneFulfilled };
}
