/** Small public route projections, paged independently from map geometry. */
import type { GPXRoute } from '../types';
import { hydrateRouteFromFirestore } from './store/helpers';

export const ROUTE_PAGE_SIZE = 20;
const SUMMARY_FIELDS = ['id', 'name', 'description', 'distanceMiles', 'elevationGainFt', 'surface', 'difficulty', 'customDistanceLabel', 'isLoop', 'maxLoops', 'externalLinks', 'notes', 'createdAt', 'updatedAt', 'thumbnailUrl', 'referenced'];
interface RestValue { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: null; timestampValue?: string; mapValue?: { fields?: Record<string, RestValue> }; arrayValue?: { values?: RestValue[] } }
interface RestDocument { name: string; fields?: Record<string, RestValue> }
function decode(value: RestValue): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, v]) => [key, decode(v)]));
  throw new Error('Unsupported route metadata value.');
}
function summary(document: RestDocument): GPXRoute {
  const fields = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]));
  return hydrateRouteFromFirestore({ ...fields, id: document.name.split('/').pop()!, points: [], detailsLoaded: false });
}

/** Uses the existing public-read rules and REST field masks; no data migration. */
export function createRouteCatalogClient(documentsUrl: string, fetcher: typeof fetch = fetch) {
  const urlFor = (id?: string) => {
    const url = new URL(`${documentsUrl}/routes${id ? `/${encodeURIComponent(id)}` : ''}`);
    for (const field of SUMMARY_FIELDS) url.searchParams.append('mask.fieldPaths', field);
    return url;
  };
  const read = async (url: URL, signal?: AbortSignal) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(abort, 15000);
    try {
      const response = await fetcher(url.toString(), { signal: controller.signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Route information could not be loaded. Please retry.');
      return await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  };
  return {
    async page(pageToken?: string, signal?: AbortSignal): Promise<{ routes: GPXRoute[]; nextPageToken?: string }> {
      const url = urlFor(); url.searchParams.set('pageSize', String(ROUTE_PAGE_SIZE));
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const data = await read(url, signal);
      if (!data) throw new Error('The route catalog is unavailable.');
      return { routes: (data.documents || []).map(summary), nextPageToken: data.nextPageToken };
    },
    async one(id: string, signal?: AbortSignal): Promise<GPXRoute | undefined> {
      const data = await read(urlFor(id), signal);
      return data ? summary(data) : undefined;
    },
  };
}

/** Bounded public-data cache; concurrent map opens share one download. */
export class RouteDetailsCache {
  private ready = new Map<string, GPXRoute>();
  private pending = new Map<string, Promise<GPXRoute>>();
  private generations = new Map<string, number>();
  constructor(private readonly fetchRoute: (id: string) => Promise<GPXRoute>, private readonly capacity = 12) {}
  load(id: string, revision = ''): Promise<GPXRoute> {
    const key = `${id}:${revision}`;
    const hit = this.ready.get(key);
    if (hit) { this.ready.delete(key); this.ready.set(key, hit); return Promise.resolve(hit); }
    const running = this.pending.get(key); if (running) return running;
    const generation = this.generations.get(id) || 0;
    const request = Promise.resolve().then(() => this.fetchRoute(id)).then((route) => {
      if ((this.generations.get(id) || 0) !== generation) return route;
      this.ready.set(key, route);
      while (this.ready.size > this.capacity) this.ready.delete(this.ready.keys().next().value!);
      return route;
    }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); });
    this.pending.set(key, request);
    return request;
  }
  prime(route: GPXRoute): void {
    this.ready.set(`${route.id}:${route.updatedAt || ''}`, { ...route, detailsLoaded: true });
    while (this.ready.size > this.capacity) this.ready.delete(this.ready.keys().next().value!);
  }
  forget(id: string): void {
    this.generations.set(id, (this.generations.get(id) || 0) + 1);
    for (const key of this.ready.keys()) if (key.startsWith(`${id}:`)) this.ready.delete(key);
    for (const key of this.pending.keys()) if (key.startsWith(`${id}:`)) this.pending.delete(key);
  }
}

export function routeSummary(route: GPXRoute): GPXRoute {
  const { points: _points, directions: _directions, geoJson: _geoJson, gpxXml: _gpxXml, ...metadata } = route;
  return { ...metadata, points: [], detailsLoaded: false };
}
