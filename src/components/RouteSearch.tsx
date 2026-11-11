import type { GPXRoute } from '../types';

import { emptyRouteFilters, type RouteFilters } from '../utils/routeSearch';

export function RouteSearch({ filters, onChange, routes, count, incomplete }: {
  filters: RouteFilters; onChange: (filters: RouteFilters) => void; routes: GPXRoute[]; count: number; incomplete: boolean;
}) {
  const fieldClass = 'mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900';
  return <section aria-label="Search and filter routes" className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <label className="col-span-2 text-xs font-bold text-stone-700">Search by route name
        <input type="search" value={filters.name} onChange={(e) => onChange({ ...filters, name: e.target.value })} placeholder="Search routes…" className={fieldClass} />
      </label>
      <label className="text-xs font-bold text-stone-700">Minimum miles
        <input type="number" min="0" step="any" inputMode="decimal" value={filters.minMiles} onChange={(e) => onChange({ ...filters, minMiles: e.target.value })} className={fieldClass} placeholder="Any" />
      </label>
      <label className="text-xs font-bold text-stone-700">Maximum miles
        <input type="number" min="0" step="any" inputMode="decimal" value={filters.maxMiles} onChange={(e) => onChange({ ...filters, maxMiles: e.target.value })} className={fieldClass} placeholder="Any" />
      </label>
      <label className="text-xs font-bold text-stone-700">Surface
        <select value={filters.surface} onChange={(e) => onChange({ ...filters, surface: e.target.value })} className={fieldClass}><option value="">All surfaces</option>{[...new Set(routes.map((route) => route.surface))].sort().map((surface) => <option key={surface}>{surface}</option>)}</select>
      </label>
      <label className="text-xs font-bold text-stone-700">Sort by
        <select value={filters.sort} onChange={(e) => onChange({ ...filters, sort: e.target.value })} className={fieldClass}><option value="name">Name A–Z</option><option value="shortest">Shortest first</option><option value="longest">Longest first</option></select>
      </label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <label className="flex items-center gap-2 text-stone-700"><input type="checkbox" checked={filters.loopsOnly} onChange={(e) => onChange({ ...filters, loopsOnly: e.target.checked })} />Loop routes only</label>
      <button type="button" onClick={() => onChange({ ...emptyRouteFilters })} className="rounded-lg px-3 py-2 font-bold text-woodland-800 hover:bg-stone-100">Clear filters</button>
    </div>
    {filters.minMiles && filters.maxMiles && Number(filters.minMiles) > Number(filters.maxMiles) && <p role="alert" className="text-sm text-amber-900">Minimum miles must be no greater than maximum miles.</p>}
    <p role="status" className="text-xs text-stone-600">{count} matching {count === 1 ? 'route' : 'routes'}{incomplete ? ' in loaded routes. Loading the rest of the library…' : ` of ${routes.length}`}</p>
  </section>;
}
