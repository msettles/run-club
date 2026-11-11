import type { GPXRoute } from '../types';

export interface RouteFilters { name: string; minMiles: string; maxMiles: string; surface: string; loopsOnly: boolean; sort: string }
export const emptyRouteFilters: RouteFilters = { name: '', minMiles: '', maxMiles: '', surface: '', loopsOnly: false, sort: 'name' };
export function filterRoutes(routes: GPXRoute[], filters: RouteFilters) {
  const name = filters.name.trim().toLocaleLowerCase();
  return routes.filter((route) => route.name.toLocaleLowerCase().includes(name)
    && (!filters.minMiles || route.distanceMiles >= Number(filters.minMiles))
    && (!filters.maxMiles || route.distanceMiles <= Number(filters.maxMiles))
    && (!filters.surface || route.surface === filters.surface)
    && (!filters.loopsOnly || route.isLoop))
    .sort((a, b) => (filters.sort === 'shortest' ? a.distanceMiles - b.distanceMiles : filters.sort === 'longest' ? b.distanceMiles - a.distanceMiles : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
