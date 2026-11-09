/**
 * Public leaderboard key for a runner: sha256("woodchuckers:" + lowercase email) as hex.
 * Used as the members/{memberKey} doc ID and RSVP attendee ID so the public
 * collections never contain email addresses.
 * Must match memberKeyFor() in firestore.rules.
 */
export async function memberKeyFor(email: string): Promise<string> {
  const data = new TextEncoder().encode(`woodchuckers:${email.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
