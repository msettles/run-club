import { expect, it, vi } from 'vitest';
import { createRouteCatalogClient, RouteDetailsCache } from './routeCatalog';
import type { GPXRoute } from '../types';

const full = (id: string, updatedAt = ''): GPXRoute => ({ id, name: id, description: '', points: [{ lat: 38, lon: -121 }], distanceMiles: 3.1, elevationGainFt: 0, surface: 'Pavement', difficulty: 'Easy', createdAt: '', updatedAt });
it('requests only metadata, preserves opaque page tokens, and decodes nested link fields', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ documents: [{ name: 'projects/demo/databases/(default)/documents/routes/route%literal', fields: {
    name: { stringValue: 'Loop' }, distanceMiles: { doubleValue: 3.1 }, isLoop: { booleanValue: false }, externalLinks: { mapValue: { fields: { stravaUrl: { stringValue: 'https://strava.com/route' } } } },
  } }], nextPageToken: 'next+/=' })));
  const client = createRouteCatalogClient('https://example.com/documents', fetcher);
  const page = await client.page('previous+/=');
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.searchParams.get('pageToken')).toBe('previous+/=');
  expect(url.searchParams.get('pageSize')).toBe('20');
  expect(url.searchParams.getAll('mask.fieldPaths')).not.toEqual(expect.arrayContaining(['points']));
  expect(url.searchParams.getAll('mask.fieldPaths')).not.toEqual(expect.arrayContaining(['directions']));
  expect(page.nextPageToken).toBe('next+/=');
  expect(page.routes[0]).toMatchObject({ id: 'route%literal', name: 'Loop', distanceMiles: 3.1, isLoop: false, points: [], detailsLoaded: false, externalLinks: { stravaUrl: 'https://strava.com/route' } });
});
it('distinguishes an absent route from a failed catalog request', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(new Response('', { status: 503 }));
  const client = createRouteCatalogClient('https://example.com/documents', fetcher);
  expect(await client.one('missing')).toBeUndefined();
  await expect(client.page()).rejects.toThrow('could not be loaded');
});
it('deduplicates detail reads, invalidates revisions, and evicts least recently used geometry', async () => {
  const fetcher = vi.fn(async (id: string) => full(id));
  const cache = new RouteDetailsCache(fetcher, 2);
  const first = cache.load('a'); const same = cache.load('a');
  expect(first).toBe(same); await first;
  await cache.load('b'); await cache.load('a'); await cache.load('c'); await cache.load('b');
  expect(fetcher.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'c', 'b']);
  await cache.load('b', 'edited');
  expect(fetcher).toHaveBeenCalledTimes(5);
});
it('allows a failed detail request to be retried and does not cache a deleted in-flight route', async () => {
  let resolve!: (route: GPXRoute) => void;
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(() => new Promise<GPXRoute>((done) => { resolve = done; })).mockResolvedValue(full('a'));
  const cache = new RouteDetailsCache(fetcher);
  await expect(cache.load('a')).rejects.toThrow('offline');
  const pending = cache.load('a'); await Promise.resolve(); cache.forget('a'); resolve(full('a')); await pending;
  await cache.load('a'); expect(fetcher).toHaveBeenCalledTimes(3);
});
