/**
 * Public calendar feed: https://<site>/calendar.ics (Hosting rewrite -> this function).
 * Serves every live run from a month ago onward as an iCalendar feed that Apple, Google
 * and Outlook calendars can subscribe to. Read-only; no user data is touched.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildCalendarFeed } from '../../src/utils/calendar';
import type { RunEvent } from '../../src/types';

initializeApp();

const PAST_DAYS = 30;

export const calendar = onRequest({ region: 'us-central1', maxInstances: 3, memory: '256MiB', cors: true }, async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method not allowed');
    return;
  }
  const db = getFirestore();
  const since = new Date(Date.now() - PAST_DAYS * 86400e3).toISOString().slice(0, 10);
  const [runsSnap, eventsSnap] = await Promise.all([
    db.collection('runs').where('date', '>=', since).get(),
    db.collection('meetup_events').where('date', '>=', since).get(),
  ]);
  // Runs without a saved code word aren't live yet and stay out of the public feed.
  const notLive = new Set(eventsSnap.docs.filter((d) => d.data().codeWordSet === false).map((d) => d.id));
  const hasEvent = new Set(eventsSnap.docs.map((d) => d.id));
  const runs = runsSnap.docs
    .map((d) => ({ ...(d.data() as RunEvent), id: d.id }))
    .filter((r) => hasEvent.has(r.id) && !notLive.has(r.id) && !r.deleting)
    .sort((a, b) => a.date.localeCompare(b.date));

  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="woodchuckers.ics"',
    // The Hosting CDN keeps one copy for an hour, so subscribers never multiply Firestore reads.
    'Cache-Control': 'public, max-age=300, s-maxage=3600',
  });
  res.status(200).send(req.method === 'HEAD' ? '' : buildCalendarFeed(runs));
});
