import { expect, it } from 'vitest';
import type { GPXRoute } from '../types';
import { emptyRouteFilters, filterRoutes } from './routeSearch';
const routes = [
  { id: 'b', name: 'River Loop', distanceMiles: 5, surface: 'Trail', isLoop: true },
  { id: 'a', name: 'Park Path', distanceMiles: 3, surface: 'Pavement', isLoop: false },
  { id: 'c', name: 'River Short', distanceMiles: 2, surface: 'Trail', isLoop: false },
] as GPXRoute[];
it('combines trimmed case-insensitive name, inclusive mileage, surface and loop filters', () => {
  expect(filterRoutes(routes, { ...emptyRouteFilters, name: ' RIVER ', minMiles: '5', maxMiles: '5', surface: 'Trail', loopsOnly: true }).map((r) => r.id)).toEqual(['b']);
  expect(filterRoutes(routes, { ...emptyRouteFilters, minMiles: '6', maxMiles: '2' })).toEqual([]);
  expect(filterRoutes(routes, { ...emptyRouteFilters, maxMiles: '0' })).toEqual([]);
});
it('sorts results without modifying the source catalog', () => {
  expect(filterRoutes(routes, emptyRouteFilters).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  expect(filterRoutes(routes, { ...emptyRouteFilters, sort: 'shortest' }).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  expect(filterRoutes(routes, { ...emptyRouteFilters, sort: 'longest' }).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  expect(routes.map((r) => r.id)).toEqual(['b', 'a', 'c']);
});
