/** Private, rule-validated attendance proofs for client-calculated rewards. */
import { collection, doc, getDocs, query, runTransaction, where, type Firestore } from 'firebase/firestore';
import type { CheckInRecord, MeetupEvent, UserProfile } from '../../types';
import { legacySpecialEventIds, specialEventIdsFor, type LegacyEvent } from '../../utils/legacy';
import { historicalRunKey, uniqueHistoricalAttendance } from '../../utils/attendanceIdentity';

export const attendanceWeek = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / 604800000 + 3 / 7);
/** How many separate streaks are written at once on a first sync. */
const STREAK_WRITERS = 6;
export interface RewardSource { checkinId?: string; legacyId?: string; event?: { d: string; t: string; c: string; s?: string; r?: string } }
interface Attendance { date: string; source: RewardSource; id: string; specialIds: string[] }
export function rewardProofId(email: string, epoch: number, kind: string, key: string | number): string { return `${email}_${epoch}_${kind}_${key}`; }

export async function prepareRewardProofs(db: Firestore, user: UserProfile, checkins: CheckInRecord[], legacy: LegacyEvent[], meetups: MeetupEvent[], streakSteps: number[] = []) {
  const epoch = user.rewardEpoch || 0;
  const email = user.email.toLowerCase();
  const byId = new Map(meetups.map((event) => [event.id, event]));
  const attendance: Attendance[] = [
    ...checkins.map((c) => {
      const event = byId.get(c.runId || '');
      return { date: c.date, source: { checkinId: c.id }, id: historicalRunKey({d:c.date,r:c.runId}),
        specialIds: specialEventIdsFor(c.eventSpecial ?? event?.specialEvent) };
    }),
    ...uniqueHistoricalAttendance(legacy, checkins).filter((e) => e.legacyId).map((e) => ({ date: e.d,
      source: { legacyId: e.legacyId!, event: { d: e.d, t: e.t, c: e.c, ...(e.s ? { s: e.s } : {}), ...(e.r ? { r: e.r } : {}) } },
      id: historicalRunKey(e), specialIds: legacySpecialEventIds(e.s) })),
  ];
  const weeks = new Map<number, Attendance>();
  attendance.forEach((a) => { const week = attendanceWeek(a.date); if (Number.isFinite(week)) weeks.set(week, a); });
  // Proofs from earlier epochs are superseded; do not pay to read them.
  const saved = await getDocs(query(collection(db, 'reward_proofs'), where('userEmail', '==', email), where('epoch', '==', epoch)));
  const existing = new Map(saved.docs.map((d) => [d.id, d.data()]));
  let longestWeek = 0;
  let longest = 0;
  let lastWeek = 0;
  let lastCount = 0;
  // A week's proof builds on the previous week's, so each unbroken streak is written
  // in order. Separate streaks do not depend on each other and are written side by side.
  const streaks: Array<Array<{ week: number; count: number; source: RewardSource }>> = [];
  for (const [week, a] of [...weeks].sort(([a], [b]) => a - b)) {
    const count = lastWeek === week - 1 ? lastCount + 1 : 1;
    if (count === 1) streaks.push([]);
    streaks[streaks.length - 1].push({ week, count, source: a.source });
    lastWeek = week; lastCount = count;
    if (count > longest) { longest = count; longestWeek = week; }
  }
  const writeStreak = async (streak: (typeof streaks)[number]) => {
    for (const { week, count, source } of streak) {
      const id = rewardProofId(email, epoch, 'week', week);
      if (existing.get(id)?.count === count) continue;
      await runTransaction(db, async (tx) => {
        const owner = await tx.get(doc(db, 'users', email));
        if (!owner.exists() || owner.data().deleting || (owner.data().rewardEpoch || 0) !== epoch) throw new Error('Attendance changed. Please refresh your rewards.');
        tx.set(doc(db, 'reward_proofs', id), { userEmail: email, epoch, kind: 'week', week, count, source });
      });
    }
  };
  const queue = streaks.filter((streak) => streak.some(({ week, count }) => existing.get(rewardProofId(email, epoch, 'week', week))?.count !== count));
  await Promise.all(Array.from({ length: Math.min(STREAK_WRITERS, queue.length) }, async () => {
    for (let streak = queue.shift(); streak; streak = queue.shift()) await writeStreak(streak);
  }));
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
  // Streak badges level up for every full block of `step` weeks in any streak. Each block's final week
  // is proven separately, so the server can count them: the week whose running streak is a multiple of the step.
  for (const step of new Set(streakSteps.filter((n) => Number.isInteger(n) && n >= 1 && n <= 1000))) {
    const id = rewardProofId(email, epoch, 'streakstep', step);
    for (const entry of streaks.flat().filter((e) => e.count % step === 0)) {
      if (existing.get(id)?.sources?.includes(entry.week)) continue;
      const proof = await runTransaction(db, async (tx) => {
        const ref = doc(db, 'reward_proofs', id);
        const [owner, old] = await Promise.all([tx.get(doc(db, 'users', email)), tx.get(ref)]);
        if (!owner.exists() || owner.data().deleting || (owner.data().rewardEpoch || 0) !== epoch) throw new Error('Attendance changed. Please refresh your rewards.');
        const previous = (old.data()?.sources || []) as number[];
        if (previous.includes(entry.week)) return old.data()!;
        const next = { userEmail: email, epoch, kind: 'streakstep', step, week: entry.week, count: previous.length + 1, sources: [...previous, entry.week], source: entry.source };
        tx.set(ref, next);
        return next;
      });
      existing.set(id, proof);
    }
  }
  return { streakProofWeek: lastWeek, longestStreakProofWeek: longestWeek };
}
