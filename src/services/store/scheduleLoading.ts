import { collection, documentId, getDocs, limit, onSnapshot, orderBy, query, startAfter, where, type QueryConstraint } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { clubYmd } from '../../utils/dateUtils';
import type { MeetupEvent, RunEvent } from '../../types';
import { meetupFromPublicDoc } from './helpers';
import type { StoreState } from './state';

export const RUN_PAGE_SIZE = 20;
export function mergeById<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  return [...new Map([...previous, ...incoming].map((row) => [row.id, row])).values()];
}
export async function fetchMeetups(ids: string[]): Promise<MeetupEvent[]> {
  if (!db || !ids.length) return [];
  const firestore = db;
  const chunks = Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => ids.slice(i * 30, i * 30 + 30));
  const snapshots = await Promise.all(chunks.map((chunk) => getDocs(query(collection(firestore, 'meetup_events'), where(documentId(), 'in', chunk)))));
  return snapshots.flatMap((snapshot) => snapshot.docs.map((doc) => meetupFromPublicDoc({ ...doc.data(), id: doc.id })));
}
export function createScheduleLoadingOps(ctx: StoreState) {
  const loadPriorRuns = async (reset = false) => {
    if (!isFirebaseConfigured || !db || ctx.priorRunsPending.current || (!reset && ctx.priorRunsComplete.current)) return;
    const firestore = db;
    ctx.priorRunsPending.current = true; ctx.setPriorRunsLoading(true); ctx.setPriorRunsError(null);
    try {
      const cursor = reset ? undefined : ctx.priorRunsCursor.current;
      const constraints: QueryConstraint[] = [where('date', '<', clubYmd()), orderBy('date', 'desc'), limit(RUN_PAGE_SIZE + 1)];
      if (cursor) constraints.push(startAfter(cursor));
      const snapshot = await getDocs(query(collection(firestore, 'runs'), ...constraints));
      const page = snapshot.docs.slice(0, RUN_PAGE_SIZE);
      const runs = page.map((doc) => ({ ...doc.data(), id: doc.id }) as RunEvent);
      const meetups = await fetchMeetups(runs.map((run) => run.id));
      ctx.priorRunsCursor.current = page[page.length - 1] || cursor;
      ctx.priorRunsComplete.current = snapshot.size <= RUN_PAGE_SIZE;
      ctx.setHasMorePriorRuns(!ctx.priorRunsComplete.current);
      ctx.setRuns((previous) => mergeById(reset ? previous.filter((run) => run.date >= clubYmd()) : previous, runs));
      ctx.setMeetupEvents((previous) => mergeById(reset ? previous.filter((event) => event.date >= clubYmd()) : previous,
        meetups.map((event) => ({ ...event, codeWord: ctx.staffCodeWords.current[event.id] || '' }))));
      ctx.setPriorRunsLoaded(true);
    } catch (error) {
      ctx.setPriorRunsError('Prior runs could not be loaded. Please retry.');
      throw error;
    } finally { ctx.priorRunsPending.current = false; ctx.setPriorRunsLoading(false); }
  };
  return { loadPriorRuns, loadMoreUpcomingRuns: () => ctx.setUpcomingRunLimit((n) => n + RUN_PAGE_SIZE) };
}

/** Subscribe only to the live schedule and its corresponding public meetup data. */
export function subscribeSchedule(ctx: Pick<StoreState, 'upcomingRunLimit' | 'setScheduleDataLoaded' | 'setScheduleError' | 'setHasMoreUpcomingRuns' | 'setRuns' | 'setMeetupEvents' | 'staffCodeWords'>, today: string): () => void {
  if (!db || !isFirebaseConfigured) return () => {};
  const firestore = db;
  let active = true;
  let idsKey = '';
  let meetupStops: Array<() => void> = [];
  const fail = (error: unknown) => {
    if (!active) return;
    console.warn('Schedule subscription failed:', error);
    ctx.setScheduleDataLoaded(false); ctx.setScheduleError('The run schedule could not be loaded. Please retry.');
  };
  ctx.setScheduleDataLoaded(false); ctx.setScheduleError(null);
  const stop = onSnapshot(query(collection(firestore, 'runs'), where('date', '>=', today), orderBy('date'), limit(ctx.upcomingRunLimit + 1)), { includeMetadataChanges: true }, (snapshot) => {
    if (!active || (snapshot.metadata.fromCache && snapshot.empty)) return;
    const runs = snapshot.docs.slice(0, ctx.upcomingRunLimit).map((doc) => ({ ...doc.data(), id: doc.id }) as RunEvent);
    ctx.setHasMoreUpcomingRuns(snapshot.size > ctx.upcomingRunLimit);
    ctx.setRuns((previous) => mergeById(previous.filter((run) => run.date < today), runs));
    const ids = runs.map((run) => run.id);
    const key = JSON.stringify(ids);
    if (key === idsKey) return;
    idsKey = key;
    meetupStops.forEach((unsubscribe) => unsubscribe()); meetupStops = [];
    ctx.setScheduleDataLoaded(false);
    if (!ids.length) {
      ctx.setMeetupEvents((previous) => previous.filter((event) => event.date < today));
      ctx.setScheduleDataLoaded(true); return;
    }
    const chunks = Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => ids.slice(i * 30, i * 30 + 30));
    const values = new Map<number, MeetupEvent[]>();
    chunks.forEach((chunk, index) => {
      meetupStops.push(onSnapshot(query(collection(firestore, 'meetup_events'), where(documentId(), 'in', chunk)), { includeMetadataChanges: true }, (meetups) => {
        if (!active || idsKey !== key || (meetups.metadata.fromCache && meetups.empty)) return;
        values.set(index, meetups.docs.map((doc) => meetupFromPublicDoc({ ...doc.data(), id: doc.id })));
        const current = [...values.values()].flat().map((event) => ({ ...event, codeWord: ctx.staffCodeWords.current[event.id] || '' }));
        ctx.setMeetupEvents((previous) => mergeById(previous.filter((event) => event.date < today), current));
        ctx.setScheduleDataLoaded(values.size === chunks.length); ctx.setScheduleError(null);
      }, fail));
    });
  }, fail);
  return () => { active = false; stop(); meetupStops.forEach((unsubscribe) => unsubscribe()); };
}
