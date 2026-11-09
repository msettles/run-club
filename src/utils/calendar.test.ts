import { expect, it } from 'vitest';
import { buildRunIcs } from './calendar';

it('exports local Pacific start times as UTC, with a stable UID and 90-minute duration', () => {
  const ics = buildRunIcs({ id: 'run-1', title: 'Social; Run, Friends', date: '2026-11-11', time: '06:00 PM', description: 'Bring lights\nMeet outside', locationName: 'Blue Note', address: 'Main St', surface: 'Pavement', distanceMiles: 3.1 }, '3.1 mi', new Date('2026-11-09T12:00:00Z'));
  expect(ics).toContain('UID:run-1@woodland-woodchuckers.web.app\r\n');
  expect(ics).toContain('DTSTART:20261112T020000Z\r\n');
  expect(ics).toContain('DTEND:20261112T033000Z\r\n');
  expect(ics).toContain('SUMMARY:Woodchuckers: Social\\; Run\\, Friends');
  expect(ics.replace(/\r\n /g, '')).toContain('DESCRIPTION:Bring lights\\nMeet outside\\nDistance: 3.1 mi');
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
});

it('folds Unicode text by UTF-8 bytes without corrupting the title', () => {
  const title = '🦫 Trail '.repeat(25);
  const ics = buildRunIcs({ id: 'run', title, date: '2026-07-08', time: '06:00 PM', description: '', locationName: '', address: '', surface: 'Trail', distanceMiles: 5 }, '5 mi');
  for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(ics.replace(/\r\n /g, '')).toContain(`SUMMARY:Woodchuckers: ${title}`);
  expect(ics).toContain('DTSTART:20260709T010000Z');
});
