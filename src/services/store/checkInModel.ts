import type { ActivityType, DistanceChoice, UserProfile, MeetupEvent, CheckInRecord, RouteOption, Badge, MilestoneAlert, MilestoneReward } from '../../types';
import { milestoneMeasure, milestoneTarget } from '../../utils/milestones';
import { adjustDistanceCounts, recomputeBadges, datedEventsFrom, type LegacyEvent } from '../../utils/legacy';

export interface CheckInParams { eventId: string; userEmail: string; codeWordEntered: string; activity: ActivityType; distanceChoice: DistanceChoice; loops?: number; withPet?: boolean; now?: Date }

export function calculateCheckIn(params: CheckInParams, u: UserProfile, event: MeetupEvent, existingCheckIn: CheckInRecord | undefined, history: CheckInRecord[], legacyEvents: LegacyEvent[], badges: Badge[], meetupEvents: MeetupEvent[], milestones: MilestoneReward[]) {
  const { eventId, activity, distanceChoice, loops, withPet, codeWordEntered } = params;
  const cleanEmail = params.userEmail.trim().toLowerCase();
  const checkinId = `${eventId}_${cleanEmail}`;
  const eventDate = event.date;
  const routeOption: RouteOption | undefined = event.routes[String(distanceChoice)];
  if (!routeOption || (event.activeDistances && !event.activeDistances.includes(String(distanceChoice)))) throw new Error('This route is no longer available. Please reopen check-in.');
  if (u.deleting || event.deleting) throw new Error('This run or profile is being removed.');
  if (loops !== undefined && (!Number.isInteger(loops) || loops < 1 || loops > 20)) throw new Error('Choose between 1 and 20 loops.');
  // The route's loop setting is a hard limit; the rules refuse anything above it.
  const loopLimit = Math.min(20, routeOption.maxLoops || 4);
  if (routeOption.isLoop && loops !== undefined && loops > loopLimit) throw new Error(`This route allows up to ${loopLimit} loop${loopLimit === 1 ? '' : 's'}. Please choose again.`);
  const isUpdate = Boolean(existingCheckIn);
    // 3b. Compute effective loops and actual credited mileage
    const effectiveLoops = routeOption.isLoop && loops && Number.isInteger(loops) && loops > 0 ? loops : 1;
    const baseLoopMiles = routeOption.baseMiles || routeOption.actualMiles;
    const computedActualMiles = Math.round((effectiveLoops > 1 ? baseLoopMiles : routeOption.actualMiles) * effectiveLoops * 100) / 100;
    const computedRouteName = effectiveLoops > 1
      ? `${routeOption.name} (${effectiveLoops} Loops)`
      : routeOption.name;

    const creditedRoute: RouteOption = {
      ...routeOption,
      name: computedRouteName,
      actualMiles: computedActualMiles,
    };

    const now = params.now || new Date();
    const nowIso = now.toISOString();
    const timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);

    const newCheckIn: CheckInRecord = {
      ...(existingCheckIn || { eventTitle: event.title || '', eventSpecial: event.specialEvent || 'none' }),
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
      lastCheckInUpdatedAt: nowIso,
      lastCheckInDate: eventDate,
      lastCheckInRunId: eventId,
    };

    // Newly unlocked badges, or ones whose level went up, are celebrated.
    const before = (id: string) => u.badgeCounts?.[id] ?? ((u.unlockedBadgeIds || []).includes(id) ? 1 : 0);
    const earnedBadges = badges.filter((b) => (derived.badgeCounts?.[b.id] || 0) > before(b.id));

    // 7. Milestone alerts: only when this check-in is what crossed the milestone, with a deterministic ID
    //    so it can't duplicate. A run-count milestone is never re-announced on a same-night edit; a miles
    //    milestone is crossed when the runner's total miles passes it. Milestones without gear are recognition only.
    const unlockedMilestones: MilestoneAlert[] = [];
    if (!isUpdate) {
      const base = { userEmail: cleanEmail, runnerName: updatedUser.displayName, shirtSize: updatedUser.shirtSize, date: eventDate, time: timeStr, runId: eventId, fulfilled: false };
      const runMilestone = milestones.find((m) => milestoneMeasure(m) === 'runs' && milestoneTarget(m) === updatedUser.totalRuns);
      if (runMilestone) {
        unlockedMilestones.push({ ...base, id: `m${updatedUser.totalRuns}_${cleanEmail}`, milestoneRuns: updatedUser.totalRuns, milestoneName: runMilestone.name, reward: runMilestone.reward, perks: runMilestone.perks, hasGear: runMilestone.hasGear !== false });
      }
      // Several mileage milestones can be crossed at once; each gets its own alert, lowest first.
      for (const m of milestones.filter((x) => milestoneMeasure(x) === 'miles').sort((x, y) => milestoneTarget(x) - milestoneTarget(y))) {
        const miles = milestoneTarget(m);
        if (u.totalMiles < miles && updatedUser.totalMiles >= miles) {
          unlockedMilestones.push({ ...base, id: `mi${miles}_${cleanEmail}`, milestoneRuns: updatedUser.totalRuns, milestoneMiles: miles, milestoneName: m.name, reward: m.reward, perks: m.perks, hasGear: m.hasGear !== false });
        }
      }
    }
    const unlockedMilestone: MilestoneAlert | undefined = unlockedMilestones[0];

  return { newCheckIn, updatedUser, creditedRoute, earnedBadges, unlockedMilestone, unlockedMilestones, isUpdate };
}
