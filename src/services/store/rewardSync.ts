/**
 * Remembers, on this device, the profile state the last reward refresh ran against.
 * Badges and streaks are derived from attendance, so when none of the inputs have
 * changed since then a sign-in can skip re-reading the runner's whole history.
 * Only a hash is stored. A new device, or any change to the inputs, refreshes once.
 */
import type { Badge, UserProfile } from '../../types';
import { clubYmd } from '../../utils/dateUtils';
import { sha256Hex } from '../../utils/hash';
import { attendanceWeek } from './rewardProofs';
import { ATTENDANCE_POLICY_VERSION } from '../../utils/attendanceIdentity';

const KEY = 'woodchuckers_reward_sync_v1';
const sorted = (record: Record<string, number> | undefined) => Object.entries(record || {}).sort(([a], [b]) => a.localeCompare(b));

/** Everything a reward refresh depends on, plus what it last produced. */
export function rewardSyncFingerprint(user: UserProfile, badges: Badge[]): Promise<string> {
  return sha256Hex(JSON.stringify([
    user.email.toLowerCase(), user.attendancePolicyVersion || 0, user.rewardEpoch || 0, user.totalRuns, user.loggedRuns, user.runCount, user.walkCount, user.petRunCount || 0,
    sorted(user.distanceCounts), user.lastCheckInUpdatedAt || '', user.linkedLegacyIds || [],
    sorted(user.badgeCounts), [...(user.unlockedBadgeIds || [])].sort(),
    user.currentStreakWeeks || 0, user.longestStreakWeeks || 0, user.streakProofWeek || 0, user.longestStreakProofWeek || 0,
    badges.map((badge) => [badge.id, badge.triggerConfig || null]).sort(([a], [b]) => String(a).localeCompare(String(b))),
  ]));
}

/** A saved current streak ends once its last attended week is older than last week. */
export function streakLapsed(user: UserProfile, today = clubYmd()): boolean {
  if (!user.currentStreakWeeks) return false;
  return !user.streakProofWeek || user.streakProofWeek < attendanceWeek(today) - 1;
}

export async function rewardsAreCurrent(user: UserProfile, badges: Badge[]): Promise<boolean> {
  try {
    if (user.attendancePolicyVersion !== ATTENDANCE_POLICY_VERSION || user.pendingLegacyClaim || user.claimGearPending) return false;
    if (streakLapsed(user)) return false;
    return localStorage.getItem(KEY) === await rewardSyncFingerprint(user, badges);
  } catch {
    return false;
  }
}

export async function rememberRewardSync(user: UserProfile, badges: Badge[]): Promise<void> {
  try {
    localStorage.setItem(KEY, await rewardSyncFingerprint(user, badges));
  } catch {
    // No storage (private mode, tests): the next sign-in simply refreshes again.
  }
}
