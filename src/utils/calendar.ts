/**
 * "Add to calendar" (.ics, RFC 5545) for a run: real start time (sent in UTC),
 * a 90-minute duration, a stable UID, escaped text and folded lines, so the
 * file imports cleanly into Apple, Google and Outlook calendars.
 */
import type { RunEvent } from '../types';
import { eventStart } from './checkInWindow';

const RUN_LENGTH_MS = 90 * 60 * 1000;

/** 2026-11-11T02:00:00.000Z -> 20261111T020000Z */
const icsUtc = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Escape TEXT values: backslash, semicolon, comma and line breaks. */
const escapeText = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines longer than 75 octets (continuation lines start with a space). */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines carry a leading space
    if (enc.encode(cur + ch).length > limit) {
      parts.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function buildRunIcs(
  run: Pick<RunEvent, 'id' | 'title' | 'date' | 'time' | 'description' | 'locationName' | 'address' | 'surface' | 'distanceMiles'>,
  distanceText: string,
  now = new Date()
): string {
  const start = eventStart(run.date, run.time);
  const end = new Date(start.getTime() + RUN_LENGTH_MS);
  const description = [run.description, `Distance: ${distanceText}`, `Surface: ${run.surface}`].filter(Boolean).join('\n');
  const location = [run.locationName, run.address].filter(Boolean).join(', ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Woodland Woodchuckers Run Club//Runs//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${run.id}@woodland-woodchuckers.web.app`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(end)}`,
    `SUMMARY:${escapeText(`Woodchuckers: ${run.title}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(fold)
    .join('\r\n') + '\r\n';
}
