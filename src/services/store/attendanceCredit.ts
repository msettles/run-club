import { collection, doc, getDocs, query, where, type Firestore, type Transaction } from 'firebase/firestore';
import type { CheckInRecord, UserProfile } from '../../types';
import { appAttendanceKeys, historicalRunKeys, legacyAttendanceCredit, ATTENDANCE_POLICY_VERSION } from '../../utils/attendanceIdentity';
import type { LegacyEvent } from '../../utils/legacy';

/** Admin mutations read all claimed histories inside the profile transaction. Originals are never removed. */
export async function rebuildAttendanceCredit(tx: Transaction, db: Firestore, user: UserProfile, overrides = new Map<string, LegacyEvent[]>()): Promise<UserProfile> {
  const histories = await Promise.all((user.linkedLegacyIds || []).map(async id => {
    if (overrides.has(id)) return overrides.get(id)!;
    const saved = await tx.get(doc(db, 'legacy_history', id));
    if (!saved.exists()) throw new Error(`Historical attendance is missing for ${id}. Restore it before recomputing.`);
    return (saved.data().events || []) as LegacyEvent[];
  }));
  // Every check-in also mutates the profile read by the caller, so a concurrent write retries this transaction.
  const records = await getDocs(query(collection(db, 'checkins'), where('userEmail', '==', user.email.toLowerCase())));
  const appRunKeys = appAttendanceKeys(records.docs.map(d => d.data() as CheckInRecord));
  const legacyRunKeys = historicalRunKeys(histories.flat(), [...histories.flat(), ...records.docs.map(d => { const c = d.data() as CheckInRecord; return { d: c.date, r: c.runId }; })]);
  const legacyEventRuns = legacyAttendanceCredit(legacyRunKeys, appRunKeys);
  return { ...user, attendancePolicyVersion: ATTENDANCE_POLICY_VERSION, legacyRunKeys, appRunKeys, legacyEventRuns,
    totalRuns: user.pre2021Runs + legacyEventRuns + records.size };
}
