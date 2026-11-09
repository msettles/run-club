import { GPXRoute, MeetupEvent, RouteOption, RunEvent, RunRouteChoice, SurfaceType } from '../types';

export interface ResolvedChoice {
  id: string; // route ID
  label: string; // display e.g. "1.2 mi • The 123"
  miles: number; // distance rounded to 1 decimal point (e.g. 1.2)
  actualMiles: number; // exact GPS distance (e.g. 1.22)
  route: GPXRoute;
}

/** Formats a distance in miles rounded to 1 decimal point */
export function formatMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}

/** A run's choices, falling back to the legacy single routeId. */
export function getRunChoices(run: Pick<RunEvent, 'routeChoices' | 'routeId'>, routes: GPXRoute[]): RunRouteChoice[] {
  if (run.routeChoices && run.routeChoices.length > 0) return run.routeChoices;
  if (run.routeId) {
    const r = routes.find((x) => x.id === run.routeId);
    if (r) return [{ routeId: r.id }];
  }
  return [];
}

/** Choices joined to their library routes, sorted by distance ascending. */
export function resolveChoices(choices: RunRouteChoice[], routes: GPXRoute[]): ResolvedChoice[] {
  const resolved: ResolvedChoice[] = [];
  for (const c of choices) {
    const r = routes.find((rt) => rt.id === c.routeId);
    if (r) {
      const actualMiles = r.distanceMiles || 0;
      const miles = formatMiles(actualMiles);
      resolved.push({
        id: r.id,
        label: c.customLabel || `${miles.toFixed(1)} mi • ${r.name}`,
        miles,
        actualMiles,
        route: r,
      });
    }
  }
  return resolved.sort((a, b) => a.actualMiles - b.actualMiles);
}

/** Distance, elevation and surface for the event, derived from its routes (never typed in). */
export function deriveRunStats(resolved: ResolvedChoice[]): {
  distanceMiles: number;
  elevationGainFt: number;
  surface: SurfaceType;
} {
  if (resolved.length === 0) return { distanceMiles: 0, elevationGainFt: 0, surface: 'Pavement' };
  const surfaces = Array.from(new Set(resolved.map((c) => c.route.surface || 'Pavement')));
  const maxMiles = Math.max(...resolved.map((c) => c.actualMiles || 0));
  return {
    distanceMiles: formatMiles(maxMiles),
    elevationGainFt: Math.max(...resolved.map((c) => c.route.elevationGainFt || 0)),
    surface: surfaces.length === 1 ? surfaces[0] : 'Mixed',
  };
}

export function routeOptionFromRoute(route: GPXRoute): RouteOption {
  return {
    name: route.name,
    actualMiles: route.distanceMiles,
    baseMiles: route.distanceMiles,
    routeId: route.id,
    isLoop: Boolean(route.isLoop),
    maxLoops: route.maxLoops || 4,
    externalLinks: route.externalLinks,
    directionsList: route.directions,
    // No geoJson here: its coordinates are nested arrays, which Firestore refuses,
    // and nothing reads it from the check-in event (maps use the route library).
    directions: route.description || undefined,
    routeUrl: route.externalLinks?.stravaUrl || route.externalLinks?.garminUrl || route.externalLinks?.rungoUrl,
  };
}

/**
 * Build the check-in event for a scheduled run so runners can pick from its distance options.
 * Keeps an existing event's code word and notes unless a new code word is given.
 */
export function buildMeetupFromRun(
  run: Pick<RunEvent, 'id' | 'date' | 'time' | 'title' | 'specialEvent' | 'routeChoices' | 'routeId'>,
  routes: GPXRoute[],
  codeWord: string,
  existing?: MeetupEvent
): MeetupEvent {
  const resolved = resolveChoices(getRunChoices(run, routes), routes);
  const routeMap: Record<string, RouteOption> = {};
  const activeKeys: string[] = [];

  resolved.forEach((c) => {
    const routeOption = routeOptionFromRoute(c.route);
    // Key by route ID
    routeMap[c.route.id] = routeOption;
    // Also key by rounded distance (e.g. "1.2", "3.1", "5.2") for easy lookup
    routeMap[c.miles.toFixed(1)] = routeOption;
    routeMap[String(c.miles)] = routeOption;
    activeKeys.push(c.route.id);
  });

  return {
    ...(existing || {}),
    id: run.id,
    runId: run.id,
    date: run.date,
    time: run.time,
    title: run.title,
    codeWord: (codeWord || existing?.codeWord || 'WOODCHUCK').trim().toUpperCase(),
    specialEvent: run.specialEvent,
    activeDistances: activeKeys,
    routes: routeMap,
  };
}

/** Confirmation text for deleting a run (Edit Run and the past-run Delete button). */
export function deleteRunConfirmMessage(title: string, checkInCount: number): string {
  const who =
    checkInCount === 0
      ? 'No runners have checked in yet.'
      : `${checkInCount} runner${checkInCount === 1 ? ' has' : 's have'} checked in.`;
  return (
    `Delete "${title}"?\n\n` +
    `${who} All check-ins for this run will be removed, and each runner's run count, miles, badges and streaks adjusted. ` +
    `Gear alerts from this run that haven't been handed out yet are removed.\n\n` +
    `This can't be undone.`
  );
}
