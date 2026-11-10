/** Club store operations: events. */
import { 
  MeetupEvent,
  RunEvent,
} from '../../types';
import { computeCheckInWindow } from '../../utils/checkInWindow';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDoc,
  getCountFromServer,
  runTransaction,
  doc,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { codeKeyFor } from '../../utils/memberKey';
import { assertDocumentFitsFirestore, cleanFirestoreData } from './helpers';
import type { StoreState } from './state';

export function createEventOps(ctx: StoreState) {
  const {
    meetupEvents,
    setMeetupEvents,
    setRuns,
    staffCodeWords,
  } = ctx;

  /**
   * Save / update a meetup event (Admin)
   */
  const saveMeetupEvent = async (event: MeetupEvent, run?: RunEvent) => {
    assertDocumentFitsFirestore(event, 'This meetup');
    const win = computeCheckInWindow(event.date, event.time);
    const runId = event.runId || event.id;
    const previous = meetupEvents.find((e) => e.id === runId);
    let word = (event.codeWord || previous?.codeWord || '').trim().toUpperCase();
    if (!word) throw new Error('Enter the check-in code word.');
    const details = run ? (({ attendees: _attendees, attendeeIds: _attendeeIds, ...rest }) => rest)(run) : undefined;
    const duplicateError = () => Object.assign(
      new Error(`The code word ${word} is already used by another run on ${event.date}. Pick a different word.`),
      { code: 'duplicate-code-word' }
    );
    if (isFirebaseConfigured && db) {
      const firestore = db;
      await runTransaction(firestore, async (transaction) => {
        const eventRef = doc(firestore, 'meetup_events', runId);
        const secretRef = doc(firestore, 'meetup_secrets', runId);
        const [savedEvent, savedSecret] = await Promise.all([transaction.get(eventRef), transaction.get(secretRef)]);
        const oldWord = (savedSecret.data()?.codeWord || '').trim().toUpperCase();
        const oldDate = savedEvent.data()?.date;
        const opens = savedEvent.data()?.checkInOpensAt?.toMillis?.();
        if (savedEvent.data()?.codeWordSet !== false && opens !== undefined && opens <= Date.now() &&
            (oldDate !== event.date || opens !== win.opensAt.getTime() || savedEvent.data()?.checkInClosesAt?.toMillis?.() !== win.closesAt.getTime()))
          throw new Error('The date and check-in window are locked after check-in opens. Schedule another run for a different time.');
        word = (event.codeWord || oldWord).trim().toUpperCase();
        if (!word) throw new Error('Enter the check-in code word.');
        const key = await codeKeyFor(event.date, word);
        const keyRef = doc(firestore, 'meetup_codes', key);
        const savedKey = await transaction.get(keyRef);
        if (savedKey.exists() && savedKey.data().runId !== runId) throw duplicateError();

        // The schedule, public choices, secret and lookup keys either all save
        // or all fail. A locked/duplicate word cannot leave a partially edited run.
        const { codeWord: _word, checkInOpensAt: _opens, checkInClosesAt: _closes, ...publicEvent } = event;
        transaction.set(eventRef, {
          ...cleanFirestoreData(publicEvent), id: runId, runId,
          codeWordSet: true,
          checkInOpensAt: Timestamp.fromDate(win.opensAt),
          checkInClosesAt: Timestamp.fromDate(win.closesAt),
        });
        if (!savedKey.exists()) transaction.set(keyRef, { runId, date: event.date });
        if (oldWord && oldDate) {
          const oldKey = await codeKeyFor(oldDate, oldWord);
          if (oldKey !== key) transaction.delete(doc(firestore, 'meetup_codes', oldKey));
        }
        if (word !== oldWord) transaction.set(secretRef, { codeWord: word });
        if (run) {
          for (const routeId of new Set([...(run.routeChoices || []).map((c) => c.routeId), ...(run.routeId ? [run.routeId] : [])]))
            transaction.update(doc(firestore, 'routes', routeId), { referenced: true });
        }
        if (details) transaction.update(doc(firestore, 'runs', runId), { ...cleanFirestoreData(details), ...(!('specialEvent' in details) || details.specialEvent === undefined ? { specialEvent: deleteField() } : {}) });
      });
    } else if (meetupEvents.some((e) => e.id !== runId && e.date === event.date && (e.codeWord || '').toUpperCase() === word)) {
      throw duplicateError();
    }
    const saved = { ...event, id: runId, runId, codeWord: word, codeWordSet: true,
      checkInOpensAt: win.opensAt.toISOString(), checkInClosesAt: win.closesAt.toISOString() };
    staffCodeWords.current[runId] = word;
    setMeetupEvents((prev) => prev.some((e) => e.id === runId) ? prev.map((e) => e.id === runId ? saved : e) : [saved, ...prev]);
    if (details) setRuns((prev) => prev.map((r) => r.id === runId ? { ...r, ...details } : r));
  };

  /** How many signed-in devices have signed up for phone notifications (admins). */
  const countPushDevices = async (): Promise<number> => {
    if (!isFirebaseConfigured || !db) return 0;
    return (await getCountFromServer(collection(db, 'push_devices'))).data().count;
  };

  /** Which run a code word belongs to on a date (signed-in lookup; never lists code words). */
  const resolveRunByCodeWord = async (date: string, codeWord: string): Promise<string | null> => {
    const word = codeWord.trim().toUpperCase();
    if (!word) return null;
    if (!isFirebaseConfigured || !db) {
      return meetupEvents.find((e) => e.date === date && (e.codeWord || '').toUpperCase() === word)?.id || null;
    }
    const snap = await getDoc(doc(db, 'meetup_codes', await codeKeyFor(date, word)));
    return snap.exists() ? ((snap.data().runId as string) || null) : null;
  };


  return { saveMeetupEvent, countPushDevices, resolveRunByCodeWord };
}
