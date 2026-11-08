import React from 'react';
import { GPXRoute, RunRouteChoice } from '../types';
import { resolveChoices, deriveRunStats } from '../utils/runChoices';
import { Plus, Trash2, Mountain, Compass, MapPin } from 'lucide-react';

interface RouteChoicesEditorProps {
  routes: GPXRoute[];
  choices: RunRouteChoice[];
  onChange: (choices: RunRouteChoice[]) => void;
}

/** Suggested starting choices: up to 3 routes sorted by distance from the library */
export function defaultChoices(routes: GPXRoute[]): RunRouteChoice[] {
  const sorted = [...routes].sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));
  // Pick distinct routes, e.g. up to 3 default routes
  return sorted.slice(0, 3).map((r) => ({
    routeId: r.id,
  }));
}

export const RouteChoicesEditor: React.FC<RouteChoicesEditorProps> = ({ routes, choices, onChange }) => {
  const resolved = resolveChoices(choices, routes);
  const stats = deriveRunStats(resolved);

  const update = (idx: number, patch: Partial<RunRouteChoice>) => {
    const next = choices.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };

  const add = () => {
    if (routes.length === 0) return;
    // Pick first route that isn't already in choices, or default to first route
    const usedRouteIds = new Set(choices.map((c) => c.routeId));
    const nextRoute = routes.find((r) => !usedRouteIds.has(r.id)) || routes[0];
    onChange([...choices, { routeId: nextRoute.id }]);
  };

  const remove = (idx: number) => onChange(choices.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-woodland-600" />
            <span>Route &amp; Distance Choices</span>
          </label>
          <p className="text-[11px] text-stone-500">
            Select the route options available for tonight. Runners choose which distance to run at check-in.
          </p>
        </div>
        {routes.length > 0 && (
          <button
            type="button"
            onClick={add}
            className="text-xs text-woodland-700 hover:text-woodland-900 font-bold flex items-center gap-1 bg-woodland-50 hover:bg-woodland-100 px-2.5 py-1.5 rounded-lg border border-woodland-200 transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add Route Option
          </button>
        )}
      </div>

      {routes.length === 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
          No routes in the library yet. Create one with "Create &amp; Upload Club Route" first.
        </p>
      )}

      {choices.length === 0 && routes.length > 0 && (
        <div className="text-center py-4 border-2 border-dashed border-stone-200 rounded-xl bg-stone-50">
          <p className="text-xs text-stone-500 mb-2">No route choices added yet.</p>
          <button
            type="button"
            onClick={add}
            className="text-xs text-woodland-700 font-bold hover:underline"
          >
            + Click here to add a route choice
          </button>
        </div>
      )}

      <div className="space-y-2">
        {choices.map((c, idx) => {
          const r = routes.find((x) => x.id === c.routeId);
          return (
            <div key={idx} className="border border-stone-200 rounded-xl p-3 space-y-2 bg-stone-50/70">
              <div className="flex gap-2 items-center">
                <span className="w-6 h-6 rounded-full bg-woodland-800 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                <select
                  value={c.routeId}
                  onChange={(e) => update(idx, { routeId: e.target.value })}
                  className="flex-1 min-w-0 text-xs px-2.5 py-2 border border-stone-300 rounded-lg bg-white font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-woodland-600"
                  aria-label="Route choice"
                >
                  {!r && <option value={c.routeId}>Select route...</option>}
                  {routes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} — {rt.distanceMiles} mi ({rt.surface})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-stone-100 transition"
                  aria-label="Remove route option"
                  title="Remove this option"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Route details automatically derived from the selected route */}
              {r && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-600 pl-8">
                  <span className="font-extrabold text-stone-900 bg-stone-200/70 px-2 py-0.5 rounded-md">
                    {r.distanceMiles} mi
                  </span>
                  <span className="flex items-center gap-0.5 font-medium">
                    <Mountain className="w-3 h-3 text-stone-400" />+{r.elevationGainFt} ft
                  </span>
                  <span className="font-medium text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200 text-[11px]">
                    {r.surface}
                  </span>
                  {r.directions && r.directions.length > 0 ? (
                    <span className="flex items-center gap-1 text-[11px] text-stone-600">
                      <Compass className="w-3 h-3 text-stone-400" /> {r.directions.length} turns
                    </span>
                  ) : null}
                  {r.externalLinks?.stravaUrl && (
                    <span className="text-[10px] bg-orange-50 text-orange-800 font-bold px-1.5 py-0.5 rounded border border-orange-200">
                      Strava
                    </span>
                  )}
                  {r.externalLinks?.garminUrl && (
                    <span className="text-[10px] bg-cyan-50 text-cyan-800 font-bold px-1.5 py-0.5 rounded border border-cyan-200">
                      Garmin
                    </span>
                  )}
                  {r.externalLinks?.rungoUrl && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                      RunGo
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {choices.length > 0 && (
        <div className="p-2.5 rounded-xl bg-woodland-50 border border-woodland-200 text-xs text-woodland-900 flex items-center justify-between">
          <span className="font-semibold text-[11px] text-woodland-800">
            📊 Derived from selected routes:
          </span>
          <span className="font-bold text-[11px] text-woodland-950 font-mono">
            {resolved.map((c) => `${c.miles} mi`).join(' · ')} | +{stats.elevationGainFt} ft | {stats.surface}
          </span>
        </div>
      )}
    </div>
  );
};
