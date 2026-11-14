import { createHash } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertAssistedCheckIn, assistedStreakWeeks, type AssistedCheckInInput } from '../../src/utils/assistedCheckIn';
import { calculateCheckIn } from '../../src/services/store/checkInModel';
import { cleanFirestoreData, meetupFromPublicDoc, toPublicMember } from '../../src/services/store/helpers';
import type { LegacyEvent } from '../../src/utils/legacy';
import type { Badge, CheckInRecord, MilestoneReward, UserProfile, Attendee } from '../../src/types';

export const assistedCheckIn = onCall({ region: 'us-central1', maxInstances: 3, timeoutSeconds: 120 }, async (request) => {
  const actorEmail = request.auth?.token.email;
  if (!request.auth || request.auth.token.email_verified !== true || typeof actorEmail !== 'string') throw new HttpsError('unauthenticated', 'Sign in with a verified staff account.');
  const input = request.data as AssistedCheckInInput;
  if (!input || typeof input.eventId !== 'string' || !input.eventId || input.eventId.length > 128 || input.eventId.includes('/') ||
      typeof input.userEmail !== 'string' || input.userEmail.length > 150 || !/^[^@/\s]+@[^@/\s]+\.[^@/\s]+$/.test(input.userEmail) ||
      !['running', 'walking'].includes(input.activity) || typeof input.distanceChoice !== 'string' || input.distanceChoice.length > 100 ||
      (input.loops !== undefined && (!Number.isInteger(input.loops) || input.loops < 1 || input.loops > 20)) ||
      (input.withPet !== undefined && typeof input.withPet !== 'boolean')) throw new HttpsError('invalid-argument', 'Choose a registered runner, route, activity and valid loop count.');
  const email = input.userEmail.trim().toLowerCase();
  const actor = actorEmail.toLowerCase();
  const db = getFirestore();
  const key = createHash('sha256').update(`woodchuckers:${email}`).digest('hex');
  const id = `${input.eventId}_${email}`;
  try {
    return await db.runTransaction(async (tx) => {
      const runRef = db.collection('runs').doc(input.eventId), userRef = db.collection('users').doc(email), ciRef = db.collection('checkins').doc(id);
      const [staff, runner, run, eventDoc, secret, maintenance, fence, existing] = await Promise.all([
        tx.get(db.collection('users').doc(actor)), tx.get(userRef), tx.get(runRef), tx.get(db.collection('meetup_events').doc(input.eventId)),
        tx.get(db.collection('meetup_secrets').doc(input.eventId)), tx.get(db.collection('settings').doc('maintenance')),
        tx.get(db.collection('settings').doc('legacy_import')), tx.get(ciRef),
      ]);
      if (!staff.exists || !runner.exists || !run.exists || run.data()?.deleting || !eventDoc.exists || !secret.exists || !secret.data()?.codeWord) throw new Error('The staff profile, runner or published run is unavailable.');
      const now = new Date();
      const event = meetupFromPublicDoc({ ...eventDoc.data(), id: input.eventId });
      const profile = runner.data() as UserProfile;
      assertAssistedCheckIn({ ...staff.data(), email: actor } as UserProfile, profile, event, Boolean(maintenance.data()?.active), Boolean(fence.data()?.active), now);
      const route = event.routes[input.distanceChoice];
      if (!route || !event.activeDistances.includes(String(input.distanceChoice)) || !Number.isFinite(route.actualMiles) || route.actualMiles <= 0 || route.actualMiles > 500 ||
          (route.isLoop && (!Number.isFinite(route.baseMiles || route.actualMiles) || (route.baseMiles || route.actualMiles) <= 0 || !Number.isInteger(route.maxLoops || 4) || (route.maxLoops || 4) > 20))) throw new Error('This route is unavailable or has invalid mileage.');
      if (existing.exists) return { success: true, alreadyCheckedIn: true, message: 'This runner is already checked in. No attendance or mileage was added.' };
      const [history, badgeDocs, milestoneDocs, legacyDocs] = await Promise.all([
        tx.get(db.collection('checkins').where('userEmail', '==', email)), tx.get(db.collection('badges')), tx.get(db.collection('milestones')),
        Promise.all((profile.linkedLegacyIds || []).map((legacyId) => tx.get(db.collection('legacy_history').doc(legacyId)))),
      ]);
      if (legacyDocs.some((doc) => !doc.exists)) throw new Error('Historical attendance is unavailable. Ask an admin to reconcile this runner first.');
      const missingMeetups = [...new Set(history.docs.map((doc) => doc.data() as CheckInRecord).filter((c) => c.runId && c.eventSpecial === undefined && c.runId !== event.id).map((c) => c.runId!))];
      const priorEvents = await Promise.all(missingMeetups.map((id) => tx.get(db.collection('meetup_events').doc(id))));
      const allEvents = [event, ...priorEvents.filter((doc) => doc.exists).map((doc) => meetupFromPublicDoc({ ...doc.data(), id: doc.id }))];
      const legacy = legacyDocs.flatMap((doc) => (doc.data()?.events || []) as LegacyEvent[]);
      const params = { ...input, userEmail: email, now, codeWordEntered: secret.data()!.codeWord as string, source: 'admin' as const };
      const calculated = calculateCheckIn(params, profile, event, undefined, history.docs.map((doc) => doc.data() as CheckInRecord), legacy,
        badgeDocs.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Badge), allEvents, milestoneDocs.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as MilestoneReward));
      if ([calculated.updatedUser.totalRuns, calculated.updatedUser.loggedRuns, calculated.updatedUser.runCount, calculated.updatedUser.walkCount, calculated.updatedUser.petRunCount || 0].some((value) => !Number.isFinite(value) || value < 0 || value > 100000) || !Number.isFinite(calculated.updatedUser.totalMiles) || calculated.updatedUser.totalMiles < 0 || calculated.updatedUser.totalMiles > 1000000) throw new Error('This runner needs an admin attendance review before another check-in.');
      if (((run.data()?.attendees || []) as Attendee[]).filter((entry) => entry.memberId !== key).length >= 500) throw new Error('This run has reached its attendee limit. Ask an admin for help.');
      Object.assign(calculated.updatedUser, assistedStreakWeeks([...legacy.map((e) => e.d), ...history.docs.map((doc) => doc.data().date as string), event.date]));
      const alertDocs = await Promise.all(calculated.unlockedMilestones.map((alert) => tx.get(db.collection('milestone_alerts').doc(alert.id))));
      const attendees = ((run.data()?.attendees || []) as Attendee[]).filter((entry) => entry.memberId !== key);
      const previous = ((run.data()?.attendees || []) as Attendee[]).find((entry) => entry.memberId === key);
      attendees.push({ memberId: key, name: profile.displayName, checkedIn: true, checkedInAt: now.toISOString(), rsvpDate: previous?.rsvpDate || now.toISOString() });
      tx.set(ciRef, cleanFirestoreData(calculated.newCheckIn));
      tx.set(userRef, cleanFirestoreData(calculated.updatedUser));
      tx.set(db.collection('members').doc(key), toPublicMember(calculated.updatedUser, key));
      tx.update(runRef, { attendees, attendeeIds: [...new Set([...(run.data()?.attendeeIds || []), key])] });
      calculated.unlockedMilestones.forEach((alert, index) => { if (!alertDocs[index].exists) tx.set(db.collection('milestone_alerts').doc(alert.id), cleanFirestoreData(alert)); });
      tx.set(db.collection('assisted_checkins').doc(id), { runId: input.eventId, userEmail: email, assistedBy: actor, assistedAt: now.toISOString(), activity: input.activity,
        distanceChoice: input.distanceChoice, loops: calculated.newCheckIn.loops, actualMiles: calculated.newCheckIn.actualMiles, withPet: Boolean(input.withPet) });
      return { success: true, alreadyCheckedIn: false, message: `${profile.displayName} is checked in for ${calculated.newCheckIn.actualMiles} miles.` };
    });
  } catch (error) { throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Check-in could not be saved. Please refresh and try again.'); }
});
