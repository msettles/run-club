/** Club store operations: checkIn. */
import { 
  Badge, 
  UserProfile,
  CheckInRecord,
  ActivityType,
  DistanceChoice,
  RouteOption,
  MilestoneAlert,
} from '../../types';
import {
  computeStreaks,
} from '../../utils/legacy';
import { 
  CLUB_MILESTONES,
} from '../../data/initialData';
import { isFirebaseConfigured, db } from '../firebase';
import {
  setDoc,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { memberKeyFor } from '../../utils/memberKey';
import { cleanFirestoreData, memberFromUser, toPublicMember } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';
import type { createPrivateSyncOps } from './privateSync';
import type { createMemberOps } from './members';

export function createCheckInOps(ctx: StoreState & ReturnType<typeof createLegacyOps> & ReturnType<typeof createPrivateSyncOps> & ReturnType<typeof createMemberOps>) {
  const {
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

    // 5. Check if runner already has a check-in for this event date (allow updates!)
    // One check-in per runner per run
    const checkinId = `${eventId}_${cleanEmail}`;
    const existingCheckIn = checkins.find((c) => c.id === checkinId);
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

    // 6. Compute updated totals & badges (pure: no React state updaters involved)
    const earnedBadges: Badge[] = [];

    const newTotalRuns = isUpdate ? u.totalRuns : u.totalRuns + 1;
    const newLoggedRuns = isUpdate ? u.loggedRuns : u.loggedRuns + 1;
    const oldMiles = existingCheckIn ? existingCheckIn.actualMiles : 0;
    const newTotalMiles = Math.round((u.totalMiles - oldMiles + computedActualMiles) * 100) / 100;

    let newRunCount = u.runCount;
    let newWalkCount = u.walkCount;
    if (!isUpdate) {
      if (activity === 'running') newRunCount++;
      if (activity === 'walking') newWalkCount++;
    } else if (existingCheckIn && existingCheckIn.activity !== activity) {
      if (activity === 'running') {
        newRunCount++;
        newWalkCount = Math.max(0, newWalkCount - 1);
      } else {
        newWalkCount++;
        newRunCount = Math.max(0, newRunCount - 1);
      }
    }

    let newPetRunCount = u.petRunCount || 0;
    if (!isUpdate) {
      if (withPet) newPetRunCount++;
    } else if (existingCheckIn) {
      if (!existingCheckIn.withPet && withPet) newPetRunCount++;
      if (existingCheckIn.withPet && !withPet) newPetRunCount = Math.max(0, newPetRunCount - 1);
    }

    const newDistanceCounts: Record<string, number> = { ...(u.distanceCounts || {}) };
    if (isUpdate && existingCheckIn) {
      const oldM = existingCheckIn.actualMiles;
      const oldLegacyBucket = oldM <= 2.0 ? '1' : oldM <= 4.0 ? '3' : '5';
      const oldRoundedKey = (Math.round(oldM * 10) / 10).toFixed(1);
      if (newDistanceCounts[oldLegacyBucket]) newDistanceCounts[oldLegacyBucket] = Math.max(0, newDistanceCounts[oldLegacyBucket] - 1);
      if (newDistanceCounts[oldRoundedKey]) newDistanceCounts[oldRoundedKey] = Math.max(0, newDistanceCounts[oldRoundedKey] - 1);
      if (newDistanceCounts[`${oldRoundedKey} mi`]) newDistanceCounts[`${oldRoundedKey} mi`] = Math.max(0, newDistanceCounts[`${oldRoundedKey} mi`] - 1);
    }
    const roundedDistKey = (Math.round(computedActualMiles * 10) / 10).toFixed(1);
    const legacyBucket = computedActualMiles <= 2.0 ? '1' : computedActualMiles <= 4.0 ? '3' : '5';
    newDistanceCounts[legacyBucket] = (newDistanceCounts[legacyBucket] || 0) + 1;
    newDistanceCounts[roundedDistKey] = (newDistanceCounts[roundedDistKey] || 0) + 1;
    newDistanceCounts[`${roundedDistKey} mi`] = (newDistanceCounts[`${roundedDistKey} mi`] || 0) + 1;

    const unlocked = [...(u.unlockedBadgeIds || [])];
    const counts: Record<string, number> = { ...(u.badgeCounts || {}) };

    // Helper to award / increment an achievement badge
    const awardBadge = (badgeId: string, customMultiplier?: number) => {
      const isFirstTime = !unlocked.includes(badgeId);
      const b = badges.find((x) => x.id === badgeId);
      if (isFirstTime) {
        unlocked.push(badgeId);
        if (b) earnedBadges.push(b);
      }
      if (customMultiplier !== undefined) {
        const prevCount = counts[badgeId] || 0;
        if (customMultiplier > prevCount && !isFirstTime && b) earnedBadges.push(b);
        counts[badgeId] = customMultiplier;
      } else {
        counts[badgeId] = (counts[badgeId] || 0) + 1;
        if (!isFirstTime && b) earnedBadges.push(b);
      }
    };

    // Weekly streaks from every dated run: claimed old-app sign-ins + this app's check-ins
    const streaks = computeStreaks([
      ...(cleanEmail === currentUserEmail.toLowerCase() ? ownLegacyEvents.map((e) => e.d) : []),
      ...checkins.filter((c) => c.userEmail.toLowerCase() === cleanEmail).map((c) => c.date),
      eventDate,
    ]);

    // Unified badge evaluation (handles built-in and admin-created custom badges)
    for (const badge of badges) {
      const cfg = badge.triggerConfig;
      if (!cfg) {
        // Fallback for any badge without triggerConfig
        if (badge.id === 'first-chuck' && newTotalRuns >= 1) awardBadge(badge.id, 1);
        if (badge.id === 'milestone-5' && newTotalRuns >= 5) awardBadge(badge.id, Math.floor(newTotalRuns / 5));
        if (badge.id === 'milestone-50' && newTotalRuns >= 50) awardBadge(badge.id, Math.floor(newTotalRuns / 50));
        if (badge.id === 'milestone-100' && newTotalRuns >= 100) awardBadge(badge.id, Math.floor(newTotalRuns / 100));
        if (badge.id === 'milestone-200' && newTotalRuns >= 200) awardBadge(badge.id, Math.floor(newTotalRuns / 200));
        if (badge.id === 'power-walker' && newWalkCount >= 10) awardBadge(badge.id, Math.floor(newWalkCount / 10));
        if (badge.id === 'streak-4' && streaks.longest >= 4) awardBadge(badge.id, Math.floor(streaks.longest / 4));
        if (badge.id === 'streak-10' && streaks.longest >= 10) awardBadge(badge.id, Math.floor(streaks.longest / 10));
        if (badge.id === 'pet-runner' && newPetRunCount >= 1) awardBadge(badge.id, newPetRunCount);
        continue;
      }

      switch (cfg.type) {
        case 'milestone': {
          const threshold = cfg.minTotalRuns || 1;
          if (newTotalRuns >= threshold) {
            const mult = cfg.isIncremental ? Math.floor(newTotalRuns / (cfg.step || threshold)) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'activity': {
          const isWalk = cfg.activityType === 'walking';
          const count = isWalk ? newWalkCount : newRunCount;
          const threshold = cfg.activityCount || 10;
          if (count >= threshold) {
            const mult = cfg.isIncremental ? Math.floor(count / (cfg.step || threshold)) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'distance': {
          const distKey = (cfg.distanceChoice || cfg.distanceTier || '3.1').toString();
          const count = newDistanceCounts[distKey] || 0;
          const threshold = cfg.distanceCount || 1;
          if (count >= threshold) {
            const mult = cfg.isIncremental ? Math.floor(count / (cfg.step || threshold)) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'special_event': {
          // Only credit special-event badges once per night (not again on a same-night edit)
          if (isUpdate) break;
          const seId = cfg.specialEventId || badge.id.replace(/^special-/, '');
          const cw = (event.codeWord || codeWordEntered).toUpperCase();
          const isMatch = (event.specialEvent && event.specialEvent === seId) ||
            (seId === 'turkey_trot' && (cw.includes('TURKEY') || event.title.toLowerCase().includes('turkey'))) ||
            (seId === 'halloween' && (cw.includes('HALLOWEEN') || cw.includes('SPOOKY') || event.title.toLowerCase().includes('halloween'))) ||
            (seId === 'anniversary' && (cw.includes('ANNIVERSARY') || event.title.toLowerCase().includes('anniversary')));
          if (isMatch) {
            awardBadge(badge.id);
          }
          break;
        }
        case 'streak': {
          // Consecutive weeks with a run, across claimed legacy history and app check-ins
          const weeks = cfg.streakWeeks || 4;
          if (streaks.longest >= weeks) {
            const mult = cfg.isIncremental ? Math.floor(streaks.longest / weeks) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'pet': {
          if (newPetRunCount >= 1) {
            awardBadge(badge.id, newPetRunCount);
          }
          break;
        }
        case 'attendance': {
          if (newTotalRuns >= 1) {
            awardBadge(badge.id, 1);
          }
          break;
        }
      }
    }

    const updatedUser: UserProfile = {
      ...u,
      totalRuns: newTotalRuns,
      loggedRuns: newLoggedRuns,
      totalMiles: newTotalMiles,
      runCount: newRunCount,
      walkCount: newWalkCount,
      petRunCount: newPetRunCount,
      distanceCounts: newDistanceCounts,
      unlockedBadgeIds: unlocked,
      badgeCounts: counts,
      lastCheckInDate: eventDate,
      lastCheckInRunId: eventId,
      currentStreakWeeks: streaks.current,
      longestStreakWeeks: streaks.longest,
    };

    // 7. Milestone gear alert — only when this check-in is what crossed the milestone
    //    (never on a same-night edit), with a deterministic ID so it can't duplicate.
    let unlockedMilestone: MilestoneAlert | undefined;
    if (!isUpdate) {
      const milestoneBadge = badges.find(
        (b) => b.category === 'milestone' && Boolean(b.triggerConfig?.reward) && b.triggerConfig?.minTotalRuns === newTotalRuns
      );
      const mDef = milestoneBadge ? undefined : CLUB_MILESTONES.find((m) => m.runsRequired === newTotalRuns);
      if (milestoneBadge || mDef) {
        unlockedMilestone = {
          id: `m${newTotalRuns}_${cleanEmail}`,
          userEmail: cleanEmail,
          runnerName: updatedUser.displayName,
          shirtSize: updatedUser.shirtSize,
          milestoneRuns: newTotalRuns,
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
    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'checkins', checkinId), cleanFirestoreData(newCheckIn));
        batch.set(doc(db, 'users', cleanEmail), cleanFirestoreData(updatedUser));
        batch.set(doc(db, 'members', memberKey), toPublicMember(updatedUser, memberKey));
        if (unlockedMilestone && !milestoneAlerts.some((a) => a.id === unlockedMilestone!.id)) {
          batch.set(doc(db, 'milestone_alerts', unlockedMilestone.id), cleanFirestoreData(unlockedMilestone));
        }
        await batch.commit();
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
