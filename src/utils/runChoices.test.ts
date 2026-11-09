import { expect, it } from 'vitest';
import { buildMeetupFromRun, deriveRunStats, getRunChoices, resolveChoices } from './runChoices';
import type { GPXRoute } from '../types';

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

it('keys check-in choices by route ID as well as distance and retains code words on edits', () => {
  const run = { id: 'run', title: 'Wednesday', date: '2026-11-11', time: '06:00 PM', routeChoices: [{ routeId: 'short' }] };
  const original = buildMeetupFromRun(run, routes, ' acorn ');
  const edited = buildMeetupFromRun(run, routes, '', { ...original, notes: 'Bring lights' });
  expect(edited.codeWord).toBe('ACORN');
  expect(edited.notes).toBe('Bring lights');
  expect(edited.activeDistances).toEqual(['short']);
  expect(edited.routes.short).toBe(edited.routes['1.2']);
  expect(edited.routes.short.actualMiles).toBe(1.23);
});
