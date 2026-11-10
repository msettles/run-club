import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import type { GPXRoute } from '../../types';
import { hydrateRouteFromFirestore } from './helpers';
import type { StoreState } from './state';

export function mergeRouteMetadata(previous: GPXRoute[], incoming: GPXRoute[]): GPXRoute[] {
  const merged = new Map(previous.map((route) => [route.id, route]));
  for (const route of incoming) {
    const old = merged.get(route.id);
    merged.set(route.id, old && old.detailsLoaded !== false && old.updatedAt === route.updatedAt ? { ...old, ...route, points: old.points, directions: old.directions, geoJson: old.geoJson, detailsLoaded: true } : route);
  }
  return [...merged.values()];
}
export function createRouteLoadingOps(ctx: StoreState) {
  const loadRoute = async (id: string): Promise<GPXRoute> => {
    const known = ctx.routes.find((route) => route.id === id);
    if (known && known.detailsLoaded !== false) return known;
    if (!isFirebaseConfigured || !db) throw new Error('This route is unavailable.');
    const revision = known?.updatedAt || '';
    return ctx.routeDetailsCache.load(id, revision);
  };
  const ensureRouteSummaries = async (ids: string[]) => {
    if (!ctx.routeCatalogClient) return;
    const missing = [...new Set(ids)].filter((id) => !ctx.routes.some((route) => route.id === id));
    if (!missing.length) return;
    const rows = await Promise.all(missing.map((id) => ctx.routeCatalogClient!.one(id)));
    ctx.setRoutes((previous) => mergeRouteMetadata(previous, rows.filter((row): row is GPXRoute => Boolean(row))));
  };
  const loadMoreRoutes = async () => {
    if (!ctx.routeCatalogClient || ctx.routePagePending.current || ctx.routeCatalogComplete.current) return;
    ctx.routePagePending.current = true; ctx.setRoutesLoading(true); ctx.setRouteCatalogError(null);
    try {
      const page = await ctx.routeCatalogClient.page(ctx.routePageToken.current);
      ctx.routePageToken.current = page.nextPageToken;
      ctx.routeCatalogComplete.current = !page.nextPageToken;
      ctx.setHasMoreRoutes(Boolean(page.nextPageToken));
      ctx.setRoutes((previous) => mergeRouteMetadata(previous, page.routes));
    } catch (error) {
      ctx.setRouteCatalogError('The route catalog could not be loaded. Please retry.');
      throw error;
    } finally { ctx.routePagePending.current = false; ctx.setRoutesLoading(false); }
  };
  const refreshRoutes = async () => {
    if (!ctx.routeCatalogClient || ctx.routePagePending.current) return;
    ctx.routePagePending.current = true; ctx.setRoutesLoading(true); ctx.setRouteCatalogError(null);
    try {
      const first = await ctx.routeCatalogClient.page();
      const pinnedIds = [...new Set(ctx.runs.flatMap((run) => [...(run.routeChoices || []).map((choice) => choice.routeId), ...(run.routeId ? [run.routeId] : [])]))];
      const missing = pinnedIds.filter((id) => !first.routes.some((route) => route.id === id));
      const pinned = (await Promise.all(missing.map((id) => ctx.routeCatalogClient!.one(id)))).filter((route): route is GPXRoute => Boolean(route));
      const fresh = [...first.routes, ...pinned];
      const ids = new Set(fresh.map((route) => route.id));
      ctx.setRoutes((previous) => mergeRouteMetadata(previous.filter((route) => ids.has(route.id)), fresh));
      ctx.routePageToken.current = first.nextPageToken;
      ctx.routeCatalogComplete.current = !first.nextPageToken;
      ctx.setHasMoreRoutes(Boolean(first.nextPageToken));
    } catch (error) { ctx.setRouteCatalogError('The route catalog could not be refreshed. Please retry.'); throw error; }
    finally { ctx.routePagePending.current = false; ctx.setRoutesLoading(false); }
  };
  return { loadRoute, ensureRouteSummaries, loadMoreRoutes, refreshRoutes };
}
export async function fetchFullRoute(id: string): Promise<GPXRoute> {
  if (!db) throw new Error('The route library is unavailable.');
  const snapshot = await getDoc(doc(db, 'routes', id));
  if (!snapshot.exists()) throw new Error('This route no longer exists. Reload the route library.');
  const route = hydrateRouteFromFirestore({ ...snapshot.data(), id: snapshot.id });
  if (!Array.isArray(route.points) || route.points.length === 0) throw new Error('The stored route has no map coordinates. Please ask an organizer to repair it.');
  return { ...route, detailsLoaded: true };
}
