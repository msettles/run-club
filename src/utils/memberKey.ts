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
