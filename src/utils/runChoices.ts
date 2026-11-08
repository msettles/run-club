import { GPXRoute, MeetupEvent, RouteOption, RunEvent, RunRouteChoice, SurfaceType } from '../types';

export interface ResolvedChoice {
  id: string; // route ID
  label: string; // display e.g. "1.22 mi • The 123"
  miles: number;
  route: GPXRoute;
  tier?: string; // legacy '1' | '3' | '5'
}

/** Legacy tier guesser (e.g. for default grouping) */
export function guessTier(route: GPXRoute): string {
  const t = route.targetDistanceTier;
  if (t === '1' || t === '3' || t === '5') return t;
  const m = route.distanceMiles || 0;
  return m < 2 ? '1' : m < 4 ? '3' : '5';
}

/** A run's choices, falling back to the legacy single routeId. */
export function getRunChoices(run: Pick<RunEvent, 'routeChoices' | 'routeId'>, routes: GPXRoute[]): RunRouteChoice[] {
  if (run.routeChoices && run.routeChoices.length > 0) return run.routeChoices;
  if (run.routeId) {
    const r = routes.find((x) => x.id === run.routeId);
    if (r) return [{ routeId: r.id, tier: guessTier(r) }];
  }
  return [];
}

/** Choices joined to their library routes, sorted by distance ascending. */
export function resolveChoices(choices: RunRouteChoice[], routes: GPXRoute[]): ResolvedChoice[] {
  const resolved: ResolvedChoice[] = [];
  for (const c of choices) {
    const r = routes.find((rt) => rt.id === c.routeId);
    if (r) {
      resolved.push({
        id: r.id,
        label: c.customLabel || `${r.distanceMiles || 0} mi • ${r.name}`,
        miles: r.distanceMiles || 0,
        route: r,
        tier: c.tier || guessTier(r),
      });
    }
  }
  return resolved.sort((a, b) => a.miles - b.miles);
}

/** Distance, elevation and surface for the event, derived from its routes (never typed in). */
export function deriveRunStats(resolved: ResolvedChoice[]): {
  distanceMiles: number;
  elevationGainFt: number;
  surface: SurfaceType;
} {
  if (resolved.length === 0) return { distanceMiles: 0, elevationGainFt: 0, surface: 'Pavement' };
  const surfaces = Array.from(new Set(resolved.map((c) => c.route.surface || 'Pavement')));
  return {
    distanceMiles: Math.max(...resolved.map((c) => c.route.distanceMiles || 0)),
    elevationGainFt: Math.max(...resolved.map((c) => c.route.elevationGainFt || 0)),
    surface: surfaces.length === 1 ? surfaces[0] : 'Mixed',
  };
}

export function routeOptionFromRoute(route: GPXRoute, tierKey?: string): RouteOption {
  return {
    name: route.name,
    actualMiles: route.distanceMiles,
    routeId: route.id,
    targetTier: tierKey,
    externalLinks: route.externalLinks,
    directionsList: route.directions,
    geoJson: route.geoJson,
    directions: route.description || undefined,
    routeUrl: route.externalLinks?.stravaUrl || route.externalLinks?.garminUrl || route.externalLinks?.rungoUrl,
  };
}

/**
 * Build the check-in event for a scheduled run so runners can pick from its distance options.
 * Keeps an existing event's code word and notes unless a new code word is given.
 */
export function buildMeetupFromRun(
  run: Pick<RunEvent, 'date' | 'time' | 'title' | 'specialEvent' | 'routeChoices' | 'routeId'>,
  routes: GPXRoute[],
  codeWord: string,
  existing?: MeetupEvent
): MeetupEvent {
  const resolved = resolveChoices(getRunChoices(run, routes), routes);
  const routeMap: Record<string, RouteOption> = {};
  const activeKeys: string[] = [];

  resolved.forEach((c) => {
    routeMap[c.route.id] = routeOptionFromRoute(c.route, c.tier || String(c.miles));
    activeKeys.push(c.route.id);
    // Also mirror to legacy '1', '3', '5' keys if matching so older logic/badges stay happy
    if (c.tier && !routeMap[c.tier]) {
      routeMap[c.tier] = routeOptionFromRoute(c.route, c.tier);
    }
  });

  return {
    ...(existing || {}),
    id: run.date,
    date: run.date,
    time: run.time,
    title: run.title,
    codeWord: (codeWord || existing?.codeWord || 'WOODCHUCK').trim().toUpperCase(),
    specialEvent: run.specialEvent,
    activeDistances: activeKeys,
    routes: routeMap,
  };
}
