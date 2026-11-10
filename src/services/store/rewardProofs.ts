/** Private, rule-validated attendance proofs for client-calculated rewards. */
import { collection, doc, getDocs, query, runTransaction, where, type Firestore } from 'firebase/firestore';
import type { CheckInRecord, MeetupEvent, UserProfile } from '../../types';
import { specialEventIdsFor, type LegacyEvent } from '../../utils/legacy';

export const attendanceWeek = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / 604800000 + 3 / 7);
export interface RewardSource { checkinId?: string; legacyId?: string; event?: { d: string; t: string; c: string } }
interface Attendance { date: string; source: RewardSource; id: string; specialIds: string[] }
export function rewardProofId(email: string, epoch: number, kind: string, key: string | number): string { return `${email}_${epoch}_${kind}_${key}`; }

export async function prepareRewardProofs(db: Firestore, user: UserProfile, checkins: CheckInRecord[], legacy: LegacyEvent[], meetups: MeetupEvent[]) {
  const epoch = user.rewardEpoch || 0;
  const email = user.email.toLowerCase();
  const byId = new Map(meetups.map((event) => [event.id, event]));
  const attendance: Attendance[] = [
    ...checkins.map((c) => {
      const event = byId.get(c.runId || '');
      return { date: c.date, source: { checkinId: c.id }, id: `checkin:${c.id}`,
        specialIds: specialEventIdsFor(c.codeWord || '', c.eventTitle ?? event?.title, c.eventSpecial ?? event?.specialEvent) };
    }),
    ...legacy.filter((e) => e.legacyId).map((e) => ({ date: e.d,
      source: { legacyId: e.legacyId!, event: { d: e.d, t: e.t, c: e.c } },
      id: `legacy:${e.legacyId}:${e.d}:${e.t}:${e.c}`, specialIds: specialEventIdsFor(e.c) })),
  ];
  const weeks = new Map<number, Attendance>();
  attendance.forEach((a) => { const week = attendanceWeek(a.date); if (Number.isFinite(week)) weeks.set(week, a); });
  const saved = await getDocs(query(collection(db, 'reward_proofs'), where('userEmail', '==', email)));
  const existing = new Map(saved.docs.filter((d) => d.data().epoch === epoch).map((d) => [d.id, d.data()]));
  let longestWeek = 0;
  let longest = 0;
  let lastWeek = 0;
  let lastCount = 0;
  for (const [week, a] of [...weeks].sort(([a], [b]) => a - b)) {
    const count = lastWeek === week - 1 ? lastCount + 1 : 1;
    const id = rewardProofId(email, epoch, 'week', week);
    if (existing.get(id)?.count !== count) {
      await runTransaction(db, async (tx) => {
        const owner = await tx.get(doc(db, 'users', email));
        if (!owner.exists() || owner.data().deleting || (owner.data().rewardEpoch || 0) !== epoch) throw new Error('Attendance changed. Please refresh your rewards.');
        tx.set(doc(db, 'reward_proofs', id), { userEmail: email, epoch, kind: 'week', week, count, source: a.source });
      });
    }
    lastWeek = week; lastCount = count;
    if (count > longest) { longest = count; longestWeek = week; }
  }
  for (const a of attendance) for (const specialId of a.specialIds) {
    const id = rewardProofId(email, epoch, 'special', specialId);
    if (existing.get(id)?.sources?.includes(a.id)) continue;
    const proof = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'reward_proofs', id);
      const [owner, old] = await Promise.all([tx.get(doc(db, 'users', email)), tx.get(ref)]);
      if (!owner.exists() || owner.data().deleting || (owner.data().rewardEpoch || 0) !== epoch) throw new Error('Attendance changed. Please refresh your rewards.');
      const previous = old.data()?.sources || [];
      if (previous.includes(a.id)) return old.data()!;
      const next = { userEmail: email, epoch, kind: 'special', specialId, count: previous.length + 1,
        sources: [...previous, a.id], sourceId: a.id, source: a.source };
      tx.set(ref, next);
      return next;
    });
    existing.set(id, proof);
  }
  return { streakProofWeek: lastWeek, longestStreakProofWeek: longestWeek };
}
