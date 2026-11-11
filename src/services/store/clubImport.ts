/**
 * Admin: write an imported club history, and recompute rewards from check-ins.
 *
 * The import writes only what the files carry (profiles, runs, check-ins, held aliases).
 * Totals, badges, streaks and reward proofs are NOT written by the import: they are derived from
 * the check-ins by `recomputeRewards`, which the import runs at the end for every member it touched,
 * and which an admin can run again at any time (for example after changing the badge catalog).
 */
import { collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, setDoc, where, writeBatch } from 'firebase/firestore';
import type { CheckInRecord, RunEvent, UserProfile } from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import { codeKeyFor, memberKeyFor } from '../../utils/memberKey';
import { datedEventsFrom, recomputeBadges, type LegacyEvent } from '../../utils/legacy';
import { totalsFromCheckins } from '../../utils/memberTotals';
import type { ImportCommit } from '../../utils/importCommit';
import { assertDocumentFitsFirestore, cleanFirestoreData, toPublicMember } from './helpers';
import { prepareRewardProofs } from './rewardProofs';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';

type Progress = (message: string) => void | Promise<void>;
/**
 * Firestore rules may look up only ~20 other documents per batch, and every run and check-in rule looks up
 * the run, the member and the check-in event. So runs are written one batch each and check-ins one write each,
 * several at a time, rather than in big batches.
 */
const CONCURRENCY = 20;
async function inParallel<T>(items: T[], work: (item: T) => Promise<void>, onEach?: (done: number) => void | Promise<void>): Promise<void> {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) { await work(items[i]); await onEach?.(++done); }
  }));
}
const chunks = <T,>(items: T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

interface PoolEntry { id: string; name: string; oldCount: number; newCount: number }
const sortKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(sortKeys) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortKeys(v)])) : value;

export interface ClubImportResult {
  membersCreated: number; membersUpdated: number; membersUnchanged: number;
  runsWritten: number; runsUpdated: number; runsUnchanged: number;
  /** Runs made in the app (closed to edits): an import never changes them. */
  runsLocked: number;
  codeWordsSkipped: number;
  checkinsWritten: number; checkinsUpdated: number; checkinsUnchanged: number;
  aliasesHeld: number; aliasesUpdated: number; aliasesUnchanged: number;
  /** Updated names that someone has already claimed (their totals were adjusted). */
  aliasesClaimedUpdated: number;
  rewards: { updated: number; failed: number };
}

export function createClubImportOps(ctx: StoreState & ReturnType<typeof createLegacyOps>) {
  /**
   * Rebuild one member's totals, badges, streaks and reward proofs from their check-ins
   * (plus any claimed old sign-ins). Safe to repeat: it only writes what differs.
   */
  const recomputeMember = async (email: string): Promise<UserProfile> => {
    if (!isFirebaseConfigured || !db) throw new Error('Recomputing rewards needs the live club database.');
    const firestore = db;
    const clean = email.toLowerCase();
    const snapshot = await getDoc(doc(firestore, 'users', clean));
    if (!snapshot.exists()) throw new Error(`${clean} has no profile.`);
    const base = snapshot.data() as UserProfile;
    if (base.deleting) throw new Error(`${clean} is being deleted.`);
    const [history, legacy] = await Promise.all([ctx.fetchRunnerCheckins(clean), ctx.fetchLegacyEvents(base.linkedLegacyIds || [])]);
    const totals = totalsFromCheckins(base, history);
    const withTotals: UserProfile = { ...base, ...totals };
    const streakSteps = ctx.badges.filter((b) => b.triggerConfig?.type === 'streak' && b.triggerConfig.isIncremental).map((b) => b.triggerConfig!.streakWeeks || 4);
    const proofs = await prepareRewardProofs(firestore, base, history, legacy, ctx.meetupEvents, streakSteps);
    const derived = recomputeBadges(withTotals, ctx.badges, datedEventsFrom(legacy, history, ctx.meetupEvents));
    const next: UserProfile = { ...withTotals, ...derived, ...proofs };
    const key = await memberKeyFor(clean);
    await runTransaction(firestore, async (tx) => {
      const ref = doc(firestore, 'users', clean);
      const current = await tx.get(ref);
      if (!current.exists()) throw new Error(`${clean} has no profile.`);
      const now = current.data() as UserProfile;
      // Attendance changed while this ran: refuse rather than overwrite it with stale totals.
      if (now.deleting || (now.rewardEpoch || 0) !== (base.rewardEpoch || 0) || now.loggedRuns !== base.loggedRuns || now.lastCheckInUpdatedAt !== base.lastCheckInUpdatedAt ||
          JSON.stringify(now.linkedLegacyIds || []) !== JSON.stringify(base.linkedLegacyIds || [])) throw new Error(`${clean} changed while rewards were being recomputed. Run it again.`);
      tx.set(ref, cleanFirestoreData(next));
      tx.set(doc(firestore, 'members', key), toPublicMember(next, key));
    });
    ctx.setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === clean ? next : u)));
    return next;
  };

  /** Admin: recompute rewards for the given members, or for everyone when none are given. */
  const recomputeRewards = async (emails?: string[], onProgress?: Progress): Promise<{ updated: number; failed: { email: string; reason: string }[] }> => {
    if (!isFirebaseConfigured || !db) throw new Error('Recomputing rewards needs the live club database.');
    const targets = emails?.length ? [...new Set(emails.map((e) => e.toLowerCase()))] : (await getDocs(collection(db, 'users'))).docs.map((d) => d.id);
    let updated = 0;
    const failed: { email: string; reason: string }[] = [];
    for (let i = 0; i < targets.length; i++) {
      try { await recomputeMember(targets[i]); updated++; }
      catch (error) { failed.push({ email: targets[i], reason: error instanceof Error ? error.message : 'Failed.' }); }
      if ((i + 1) % 5 === 0 || i + 1 === targets.length) await onProgress?.(`Recomputed ${i + 1} of ${targets.length} members…`);
    }
    return { updated, failed };
  };

  /**
   * Admin: write an import. Records that are new are created; records that already exist are updated where the
   * files differ (importing the same file again changes nothing, an edited file changes what was edited).
   * Nothing is ever deleted: a row missing from a file leaves its record as it is.
   */
  const importClubData = async (commit: ImportCommit, onProgress?: Progress): Promise<ClubImportResult> => {
    if (!isFirebaseConfigured || !db) throw new Error('Importing needs the live club database.');
    const firestore = db;
    const result: ClubImportResult = {
      membersCreated: 0, membersUpdated: 0, membersUnchanged: 0,
      runsWritten: 0, runsUpdated: 0, runsUnchanged: 0, runsLocked: 0, codeWordsSkipped: 0,
      checkinsWritten: 0, checkinsUpdated: 0, checkinsUnchanged: 0,
      aliasesHeld: 0, aliasesUpdated: 0, aliasesUnchanged: 0, aliasesClaimedUpdated: 0,
      rewards: { updated: 0, failed: 0 },
    };
    const touched = new Set<string>();

    // 1. Members: created when new; when they exist, only the fields the files gave are changed, and only if they differ.
    for (const group of chunks(commit.members, 20)) {
      const snaps = await Promise.all(group.map((m) => getDoc(doc(firestore, 'users', m.profile.email))));
      const creates: ImportCommit['members'] = [];
      for (let i = 0; i < group.length; i++) {
        const { profile, given } = group[i];
        if (!snaps[i].exists()) { creates.push(group[i]); continue; }
        const current = snaps[i].data() as UserProfile;
        if (current.deleting) { result.membersUnchanged++; continue; }
        const patch: Partial<UserProfile> = {};
        if (given.name && current.displayName !== profile.displayName) Object.assign(patch, { displayName: profile.displayName, firstName: profile.firstName, lastName: profile.lastName });
        if (given.birthday && current.birthday !== profile.birthday) patch.birthday = profile.birthday;
        // The file's "no check-in runs" is kept apart from runs a claim added, so changing it only moves the difference.
        if (given.noCheckInRuns && (current.importedRuns || 0) !== (profile.importedRuns || 0)) {
          patch.importedRuns = profile.importedRuns;
          patch.pre2021Runs = Math.max(0, (current.pre2021Runs || 0) - (current.importedRuns || 0) + (profile.importedRuns || 0));
        }
        if (!Object.keys(patch).length) { result.membersUnchanged++; continue; }
        await runTransaction(firestore, async (tx) => {
          const ref = doc(firestore, 'users', profile.email);
          const latest = await tx.get(ref);
          if (!latest.exists() || latest.data().deleting) return;
          tx.set(ref, cleanFirestoreData({ ...(latest.data() as UserProfile), ...patch }));
        });
        touched.add(profile.email);
        result.membersUpdated++;
      }
      for (const created of chunks(creates, 200)) {
        const batch = writeBatch(firestore);
        for (const { profile } of created) {
          const key = await memberKeyFor(profile.email);
          batch.set(doc(firestore, 'users', profile.email), cleanFirestoreData(profile));
          batch.set(doc(firestore, 'members', key), toPublicMember(profile, key));
          touched.add(profile.email);
        }
        await batch.commit();
        result.membersCreated += created.length;
      }
      await onProgress?.(`Members: ${result.membersCreated} created, ${result.membersUpdated} updated…`);
    }

    // 2. Runs. Code words are unique within a day: decide each one up front so parallel writes cannot collide.
    const claimedCodes = new Set<string>();
    const codeKeys = new Map<string, string>();
    for (const { run, codeWord } of commit.runs) {
      if (!codeWord) continue;
      const key = await codeKeyFor(run.date, codeWord);
      claimedCodes.add(key);
      codeKeys.set(run.id, key);
    }
    await inParallel(commit.runs, async ({ run, meetup, codeWord }) => {
      const [runSnap, eventSnap, secretSnap] = await Promise.all([getDoc(doc(firestore, 'runs', run.id)), getDoc(doc(firestore, 'meetup_events', run.id)), getDoc(doc(firestore, 'meetup_secrets', run.id))]);
      const { codeWord: _word, ...publicEvent } = meetup;
      assertDocumentFitsFirestore(publicEvent, `The run on ${run.date}`);
      const key = codeKeys.get(run.id);
      const oldWord = (secretSnap.data()?.codeWord as string | undefined) || '';
      if (runSnap.exists()) {
        // A run made in the app has a check-in window and is closed to edits; only imported runs can be corrected.
        const existing = eventSnap.data() || {};
        if (existing.checkInOpensAt || existing.checkInClosesAt) { result.runsLocked++; return; }
        const before = runSnap.data() as RunEvent;
        // Keep any distance option an earlier import credited, and add the new ones.
        const mergedRoutes = { ...(existing.routes || {}), ...publicEvent.routes };
        const mergedDistances = [...new Set([...(existing.activeDistances || []), ...publicEvent.activeDistances])];
        const nextRun = cleanFirestoreData({ ...before, ...run, attendees: before.attendees || [], ...(before.attendeeIds ? { attendeeIds: before.attendeeIds } : {}) });
        const nextEvent = cleanFirestoreData({ ...existing, ...publicEvent, routes: mergedRoutes, activeDistances: mergedDistances });
        const runChanged = JSON.stringify(sortKeys(before)) !== JSON.stringify(sortKeys(nextRun));
        const eventChanged = JSON.stringify(sortKeys(existing)) !== JSON.stringify(sortKeys(nextEvent));
        const wordChanged = Boolean(codeWord) && codeWord !== oldWord;
        if (!runChanged && !eventChanged && !wordChanged) { result.runsUnchanged++; return; }
        const batch = writeBatch(firestore);
        if (runChanged) batch.set(doc(firestore, 'runs', run.id), nextRun);
        if (eventChanged) batch.set(doc(firestore, 'meetup_events', run.id), nextEvent);
        if (wordChanged) {
          const taken = key ? (await getDoc(doc(firestore, 'meetup_codes', key))).exists() : true;
          if (taken) result.codeWordsSkipped++;
          else {
            if (oldWord) batch.delete(doc(firestore, 'meetup_codes', await codeKeyFor(run.date, oldWord)));
            batch.set(doc(firestore, 'meetup_secrets', run.id), { codeWord });
            batch.set(doc(firestore, 'meetup_codes', key!), { runId: run.id, date: run.date });
          }
        }
        await batch.commit();
        result.runsUpdated++;
        return;
      }
      const batch = writeBatch(firestore);
      batch.set(doc(firestore, 'runs', run.id), cleanFirestoreData(run));
      batch.set(doc(firestore, 'meetup_events', run.id), cleanFirestoreData(publicEvent));
      if (codeWord && key) {
        if ((await getDoc(doc(firestore, 'meetup_codes', key))).exists()) result.codeWordsSkipped++;
        else { batch.set(doc(firestore, 'meetup_secrets', run.id), { codeWord }); batch.set(doc(firestore, 'meetup_codes', key), { runId: run.id, date: run.date }); }
      }
      await batch.commit();
      result.runsWritten++;
    }, (n) => (n % 10 === 0 || n === commit.runs.length ? onProgress?.(`Runs: ${n} of ${commit.runs.length}…`) : undefined));

    // 3. Check-ins: new ones are created, changed ones are updated. A check-in's run, date, person, title and special event
    //    cannot be edited in place (the rules forbid it), so a check-in whose run's title or special event changed is replaced.
    await inParallel(commit.checkins, async (c) => {
      const ref = doc(firestore, 'checkins', c.id);
      const existing = await getDoc(ref);
      const desired = cleanFirestoreData(c as CheckInRecord);
      if (!existing.exists()) { await setDoc(ref, desired); result.checkinsWritten++; touched.add(c.userEmail); return; }
      const before = existing.data() as CheckInRecord;
      if (JSON.stringify(sortKeys(before)) === JSON.stringify(sortKeys(desired))) { result.checkinsUnchanged++; return; }
      // The app's own check-ins (made at a run) are never replaced by an import.
      if (before.source === 'pwa') { result.checkinsUnchanged++; return; }
      const fixed = (['createdAt', 'eventTitle', 'eventSpecial', 'date', 'runId', 'userEmail', 'id'] as const).some((f) => before[f] !== desired[f]);
      if (fixed) await deleteDoc(ref);
      await setDoc(ref, desired);
      result.checkinsUpdated++; touched.add(c.userEmail);
    }, (n) => (n % 25 === 0 || n === commit.checkins.length ? onProgress?.(`Check-ins: ${n} of ${commit.checkins.length}…`) : undefined));

    // 4. Held aliases: created unclaimed; when one exists and differs it is updated, and its claimer's totals follow.
    if (commit.aliases.length) {
      const poolRef = doc(firestore, 'legacy_index', 'pool');
      const pool = await getDoc(poolRef);
      const entries = new Map(((pool.exists() && pool.data().entries) || []).map((e: PoolEntry) => [e.id, e] as const));
      let poolChanged = false;
      for (const alias of commit.aliases) {
        assertDocumentFitsFirestore({ events: alias.events }, `Held sign-ins for ${alias.name}`);
        const newCount = alias.events.length;
        const ref = doc(firestore, 'legacy_profiles', alias.id);
        const historyRef = doc(firestore, 'legacy_history', alias.id);
        const [saved, history] = await Promise.all([getDoc(ref), getDoc(historyRef)]);
        const profile = { id: alias.id, name: alias.name, oldCount: alias.oldCount, newCount, totalRuns: alias.oldCount + newCount };
        if (!saved.exists()) {
          const batch = writeBatch(firestore);
          batch.set(ref, { ...profile, claimedBy: null, claimedAt: null });
          batch.set(historyRef, { id: alias.id, events: alias.events });
          await batch.commit();
          entries.set(alias.id, { id: alias.id, name: alias.name, oldCount: alias.oldCount, newCount });
          poolChanged = true; result.aliasesHeld++;
          continue;
        }
        const old = saved.data() as { name: string; oldCount: number; newCount: number; claimedBy?: string | null };
        const sameEvents = JSON.stringify(((history.data()?.events as LegacyEvent[]) || []).map((e) => sortKeys(e))) === JSON.stringify(alias.events.map((e) => sortKeys(e)));
        if (old.name === alias.name && old.oldCount === alias.oldCount && old.newCount === newCount && sameEvents) { result.aliasesUnchanged++; continue; }
        // Update the name's record, and the totals of whoever has claimed it, together.
        const owners = await getDocs(query(collection(firestore, 'users'), where('linkedLegacyIds', 'array-contains', alias.id)));
        await runTransaction(firestore, async (tx) => {
          const snaps = await Promise.all(owners.docs.map((d) => tx.get(d.ref)));
          const changed: UserProfile[] = [];
          for (const snap of snaps) {
            if (!snap.exists()) continue;
            const u = snap.data() as UserProfile;
            if (u.deleting) continue;
            changed.push({ ...u, rewardEpoch: (u.rewardEpoch || 0) + 1, pre2021Runs: Math.max(0, u.pre2021Runs + alias.oldCount - old.oldCount),
              legacyEventRuns: Math.max(0, (u.legacyEventRuns || 0) + newCount - old.newCount),
              totalRuns: Math.max(0, u.totalRuns + alias.oldCount + newCount - old.oldCount - old.newCount) });
          }
          const keys = await Promise.all(changed.map((u) => memberKeyFor(u.email)));
          tx.update(ref, profile);
          tx.set(historyRef, { id: alias.id, events: alias.events });
          changed.forEach((u, i) => { tx.set(doc(firestore, 'users', u.email), cleanFirestoreData(u)); tx.set(doc(firestore, 'members', keys[i]), toPublicMember(u, keys[i])); touched.add(u.email); });
        });
        entries.set(alias.id, { id: alias.id, name: alias.name, oldCount: alias.oldCount, newCount });
        poolChanged = true;
        if (owners.size) result.aliasesClaimedUpdated++;
        result.aliasesUpdated++;
      }
      if (poolChanged) {
        const merged = [...entries.values()];
        assertDocumentFitsFirestore({ entries: merged }, 'The historical name index');
        await setDoc(poolRef, { entries: merged, importedAt: new Date().toISOString() });
      }
      await onProgress?.(`Past names: ${result.aliasesHeld} held, ${result.aliasesUpdated} updated…`);
    }

    // 5. Rewards: recomputed from the check-ins for every member the import changed.
    const rewards = await recomputeRewards([...touched], onProgress);
    result.rewards = { updated: rewards.updated, failed: rewards.failed.length };
    return result;
  };

  return { recomputeMember, recomputeRewards, importClubData };
}
