import { expect, it } from 'vitest';
import { buildMeetupFromRun, deriveRunStats, getRunChoices, resolveChoices } from './runChoices';
import type { GPXRoute, RouteTurnStep } from '../types';

const route = (id: string, distanceMiles: number, surface: GPXRoute['surface'] = 'Pavement'): GPXRoute => ({
  id, name: id, distanceMiles, surface, description: '', elevationGainFt: 20, points: [], difficulty: 'Easy', createdAt: '',
});
const routes = [route('short', 1.23), route('long', 5.26, 'Trail')];

it('resolves choices in distance order, drops deleted routes, and preserves exact mileage and custom labels', () => {
  const resolved = resolveChoices([{ routeId: 'long', customLabel: 'Long course' }, { routeId: 'deleted' }, { routeId: 'short' }], routes);
  expect(resolved.map((c) => c.id)).toEqual(['short', 'long']);
  expect(resolved[0]).toMatchObject({ label: '1.2 mi • short', miles: 1.2, actualMiles: 1.23 });
  expect(resolved[1].label).toBe('Long course');
  expect(deriveRunStats(resolved)).toEqual({ distanceMiles: 5.3, elevationGainFt: 20, surface: 'Mixed' });
});

it('supports a legacy single route and safely handles a missing one', () => {
  expect(getRunChoices({ routeId: 'short' }, routes)).toEqual([{ routeId: 'short' }]);
  expect(getRunChoices({ routeId: 'missing' }, routes)).toEqual([]);
  expect(deriveRunStats([]).distanceMiles).toBe(0);
});

it('stores each check-in choice once by route ID and retains code words on edits', () => {
  const run = { id: 'run', title: 'Wednesday', date: '2026-11-11', time: '06:00 PM', routeChoices: [{ routeId: 'short' }] };
  const original = buildMeetupFromRun(run, routes, ' acorn ');
  const edited = buildMeetupFromRun(run, routes, '', { ...original, notes: 'Bring lights' });
  expect(edited.codeWord).toBe('ACORN');
  expect(edited.notes).toBe('Bring lights');
  expect(edited.activeDistances).toEqual(['short']);
  expect(Object.keys(edited.routes)).toEqual(['short']);
  expect(edited.routes['1.2']).toBeUndefined();
  expect(edited.routes.short.actualMiles).toBe(1.23);
});

it('keeps a full 20-route meetup below the document limit without copied directions or aliases', () => {
  const large = Array.from({ length: 20 }, (_, index) => ({ ...route(`route-${index}`, 3.1), directions: Array.from({ length: 190 }, (_, step): RouteTurnStep => ({ step, cue: 'L', instruction: 'Continue through the intersection for the next block', instruction_concise: 'Left at intersection', street: 'Main', distance_m: 20, distance: '66 ft', at_km: step / 10, point: [-121, 38] })) }));
  const event = buildMeetupFromRun({ id: 'run', date: '2026-11-11', time: '18:00', title: 'Club', routeChoices: large.map((r) => ({ routeId: r.id })) }, large, 'ACORN');
  expect(Object.keys(event.routes)).toHaveLength(20);
  expect(new TextEncoder().encode(JSON.stringify(event)).length).toBeLessThan(100_000);
  expect(Object.values(event.routes).every((option) => !option.directionsList)).toBe(true);
});
