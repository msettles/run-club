import type { ActivityType, DistanceChoice, MeetupEvent, UserProfile } from '../types';
import { checkInWindow } from './checkInWindow';
import { isStaffProfile } from './roles';
export interface AssistedCheckInInput { eventId: string; userEmail: string; activity: ActivityType; distanceChoice: DistanceChoice; loops?: number; withPet?: boolean }
/** The server uses its own clock. No organizer/admin window bypass is provided. */
export function assertAssistedCheckIn(actor: UserProfile, runner: UserProfile, event: MeetupEvent, maintenance: boolean, importing: boolean, now: Date) {
  if (!isStaffProfile(actor) || actor.deleting) throw new Error('Only active organizers and admins may assist check-in.');
  if (maintenance || importing) throw new Error('Club updates are in progress. Assisted check-in is paused.');
  if (runner.role === 'guest' || runner.deleting || runner.pendingLegacyClaim) throw new Error('This runner must finish registration or their historical claim first.');
  if (event.deleting || event.codeWordSet === false) throw new Error('This run is unavailable for check-in.');
  const window = checkInWindow(event);
  if (!Number.isFinite(window.opensAt.getTime()) || !Number.isFinite(window.closesAt.getTime()) || now < window.opensAt || now > window.closesAt) throw new Error('Assisted check-in is only available during the normal check-in window.');
}

/** Keep public streak freshness aligned with the same Monday-based weeks used by reward proofs. */
export function assistedStreakWeeks(dates: string[]) {
  const weeks = [...new Set(dates.map((date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 604800000 + 3 / 7)).filter(Number.isFinite))].sort((a, b) => a - b);
  let previous = 0, count = 0, longest = 0, longestWeek = 0;
  for (const week of weeks) {
    count = previous === week - 1 ? count + 1 : 1;
    previous = week;
    if (count > longest) { longest = count; longestWeek = week; }
  }
  return { streakProofWeek: previous, longestStreakProofWeek: longestWeek };
}
