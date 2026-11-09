/** Club store operations: events. */
import { 
  MeetupEvent,
} from '../../types';
import { computeCheckInWindow } from '../../utils/checkInWindow';
import { isFirebaseConfigured, db } from '../firebase';
import {
  collection,
  getDoc,
  getCountFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { codeKeyFor } from '../../utils/memberKey';
import { cleanFirestoreData } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';
import type { createPrivateSyncOps } from './privateSync';
import type { createMemberOps } from './members';
import type { createCheckInOps } from './checkIn';

export function createEventOps(ctx: StoreState & ReturnType<typeof createLegacyOps> & ReturnType<typeof createPrivateSyncOps> & ReturnType<typeof createMemberOps> & ReturnType<typeof createCheckInOps>) {
  const {
    meetupEvents,
    setMeetupEvents,
  } = ctx;

  /**
   * Save / update a meetup event (Admin)
   */
  const saveMeetupEvent = async (event: MeetupEvent) => {
    const win = computeCheckInWindow(event.date, event.time);
    const runId = event.runId || event.id;
    event = { ...event, id: runId, runId, checkInOpensAt: win.opensAt.toISOString(), checkInClosesAt: win.closesAt.toISOString() };
    const previous = meetupEvents.find((e) => e.id === runId);
    const newWord = (event.codeWord || '').trim().toUpperCase();
    const oldWord = (previous?.codeWord || '').trim().toUpperCase();
    const wordOrDateChanged = Boolean(newWord) && (newWord !== oldWord || previous?.date !== event.date);

    // Code words must be unique within a day: they decide which run a runner checks into.
    // (The database enforces this too; this gives a clearer message first.)
    if (wordOrDateChanged && meetupEvents.some((e) => e.id !== runId && e.date === event.date && (e.codeWord || '').toUpperCase() === newWord)) {
      throw Object.assign(new Error(`The code word ${newWord} is already used by another run on ${event.date}. Pick a different word.`), {
        code: 'duplicate-code-word',
      });
    }

    if (isFirebaseConfigured && db) {
      // Public doc: everything except the code word, plus the check-in window the rules enforce
      // (opens 2 hours before the start, closes at midnight).
      const { codeWord: _cw, checkInOpensAt: _o, checkInClosesAt: _c, ...publicEvent } = event;
      await setDoc(
        doc(db, 'meetup_events', runId),
        {
          ...cleanFirestoreData(publicEvent),
          codeWord: deleteField(),
          // A live run stays live while its word changes (a refused change keeps the old word);
          // a run without a word only goes live once the word below is saved.
          codeWordSet: Boolean(previous && previous.codeWordSet !== false && oldWord) || (!wordOrDateChanged && Boolean(oldWord)),
          checkInOpensAt: Timestamp.fromDate(win.opensAt),
          checkInClosesAt: Timestamp.fromDate(win.closesAt),
        },
        { merge: true }
      );
      if (wordOrDateChanged) {
        // Is the word really taken that day? Check the lookup key first, so a lock
        // refusal is never reported as a duplicate.
        const keyRef = doc(db, 'meetup_codes', await codeKeyFor(event.date, newWord));
        const existingKey = await getDoc(keyRef);
        if (existingKey.exists() && existingKey.data().runId !== runId) {
          throw Object.assign(new Error(`The code word ${newWord} is already used by another run on ${event.date}. Pick a different word.`), {
            code: 'duplicate-code-word',
          });
        }
        if (!existingKey.exists()) {
          await setDoc(keyRef, { runId, date: event.date }); // refused only if the word is locked
        }
        if (previous && oldWord) {
          await deleteDoc(doc(db, 'meetup_codes', await codeKeyFor(previous.date, oldWord))).catch((err) =>
            console.warn('Old code word key not removed:', err)
          );
        }
        await setDoc(doc(db, 'meetup_secrets', runId), { codeWord: newWord });
        await updateDoc(doc(db, 'meetup_events', runId), { codeWordSet: true });
      }
    }

    event = { ...event, codeWordSet: Boolean(newWord || oldWord) };
    setMeetupEvents((prev) => (prev.some((e) => e.id === runId) ? prev.map((e) => (e.id === runId ? event : e)) : [event, ...prev]));
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
