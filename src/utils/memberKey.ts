import { sha256Hex } from './hash';

const memberKeys = new Map<string, Promise<string>>();

/**
 * Public leaderboard key for a runner: sha256("woodchuckers:" + lowercase email) as hex.
 * Used as the members/{memberKey} doc ID and RSVP attendee ID so the public
 * collections never contain email addresses.
 * Must match memberKeyFor() in firestore.rules.
 */
export function memberKeyFor(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const cached = memberKeys.get(normalized);
  if (cached) return cached;
  if (memberKeys.size >= 512) memberKeys.delete(memberKeys.keys().next().value!);
  const key = sha256Hex(`woodchuckers:${normalized}`).catch((error) => {
    memberKeys.delete(normalized);
    throw error;
  });
  memberKeys.set(normalized, key);
  return key;
}

/**
 * Lookup key for a run's code word: sha256("<date>:<CODEWORD>") as hex.
 * meetup_codes/{key} = { runId, date }. One key per word per day, so a code word
 * is unique within a day and tells the app which run a runner is checking into.
 * Must match codeKeyFor() in firestore.rules.
 */
export function codeKeyFor(date: string, codeWord: string): Promise<string> {
  return sha256Hex(`${date}:${codeWord.trim().toUpperCase()}`);
}
