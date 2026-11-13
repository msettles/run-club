import { expect, it, vi } from 'vitest';
import { importedRouteId, planRouteImport } from './routeImport';

vi.mock('./gpxParser', () => ({ parseGPX: () => ({ points: [{ lat: 38.6, lon: -121.7 }, { lat: 38.61, lon: -121.7 }], distanceMiles: 1.2, elevationGainFt: 20, difficulty: 'Easy' }) }));
const header = 'Run name,Collection name,Date created,Loop,GPX path,Garmin Link,RunGo Link,Strava Link\n';
const row = '"The 1, 2, 3",The 123,10/11/21,loop,gpx_downloads/COURSE_123.gpx,https://connect.garmin.com/app/course/123,https://routes.rungoapp.com/route/abc,https://www.strava.com/routes/456';
const file = { name: 'COURSE_123.gpx', text: async () => '<gpx />' };

it('preserves quoted names, source dates, collections, loops and all links', async () => {
  const plan = await planRouteImport('\uFEFF' + header + row, [file]);
  expect(plan.errors).toEqual([]);
  expect(plan.entries[0]).toMatchObject({ id: 'route-garmin-123', route: {
    name: 'The 1, 2, 3', collectionName: 'The 123', createdAt: '2021-10-11T00:00:00.000Z',
    isLoop: true, surface: 'Pavement', distanceMiles: 1.2,
    externalLinks: { garminUrl: 'https://connect.garmin.com/app/course/123', rungoUrl: 'https://routes.rungoapp.com/route/abc', stravaUrl: 'https://www.strava.com/routes/456' },
  } });
});

it('normalizes Garmin URL variants to the same import identity', () => {
  expect(importedRouteId('https://connect.garmin.com/modern/course/123/?share=1')).toBe(importedRouteId('https://connect.garmin.com/app/course/123'));
  expect(() => importedRouteId('https://example.com/app/course/123')).toThrow();
});

it('reports missing and ambiguous GPX files, mismatched course IDs and missing columns', async () => {
  expect((await planRouteImport(header + row, [])).errors[0]).toContain('select this GPX');
  expect((await planRouteImport(header + row, [file, file])).errors[0]).toContain('multiple files');
  expect((await planRouteImport(header + row.replace('COURSE_123.gpx', 'COURSE_999.gpx'), [{ ...file, name: 'COURSE_999.gpx' }])).errors[0]).toContain('does not match');
  expect((await planRouteImport('Run name\nOnly name', [])).errors[0]).toContain('Missing CSV columns');
});

it('rejects impossible dates, unsupported loop settings, duplicate courses and unsafe links', async () => {
  for (const [from, to, message] of [
    ['10/11/21', '2/30/21', 'valid'],
    [',loop,', ',maybe,', 'Loop'],
    ['https://www.strava.com/routes/456', 'javascript:alert(1)', 'HTTPS'],
  ]) expect((await planRouteImport(header + row.replace(from, to), [file])).errors[0]).toContain(message);
  expect((await planRouteImport(header + row + '\n' + row, [file])).errors[0]).toContain('more than once');
});
