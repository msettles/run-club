import { expect, it, vi } from 'vitest';
import { OsmCache, type OsmBounds } from './osmCache';
import type { OsmResponse } from './osm';
const bounds: OsmBounds = [38, -122, 39, -121];
const streets: OsmResponse = { elements: [{ type: 'way', id: 1, tags: { highway: 'residential', name: 'Main Street' } }] };
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

it('reuses enclosing map data without treating a partially overlapping box as complete', async () => {
  const loader = vi.fn(async () => streets);
  const cache = new OsmCache(loader);
  await cache.load(bounds);
  await cache.load([38.2, -121.8, 38.8, -121.2]);
  expect(loader).toHaveBeenCalledTimes(1);
  await cache.load([38.5, -122, 39.5, -121]);
  expect(loader).toHaveBeenCalledTimes(2);
});
it('expires from download completion rather than extending freshness on cache hits', async () => {
  let now = 0;
  const loader = vi.fn(async () => streets);
  const cache = new OsmCache(loader, { ttlMs: 100, maxEntries: 6, maxBytes: 10000 }, () => now);
  await cache.load(bounds);
  now = 99; await cache.load(bounds);
  now = 100; await cache.load(bounds);
  expect(loader).toHaveBeenCalledTimes(2);
});
it('evicts the least recently used region and bounds retained bytes', async () => {
  const loader = vi.fn(async () => streets);
  const a: OsmBounds = [1, 1, 2, 2], b: OsmBounds = [3, 3, 4, 4], c: OsmBounds = [5, 5, 6, 6];
  const cache = new OsmCache(loader, { ttlMs: 1000, maxEntries: 2, maxBytes: 10000 });
  await cache.load(a); await cache.load(b); await cache.load(a); await cache.load(c); await cache.load(a);
  expect(loader).toHaveBeenCalledTimes(3);
  await cache.load(b); expect(loader).toHaveBeenCalledTimes(4);
  const tooLarge = new OsmCache(loader, { ttlMs: 1000, maxEntries: 6, maxBytes: 1 });
  await tooLarge.load(a); await tooLarge.load(a); expect(loader).toHaveBeenCalledTimes(6);
  const oneSize = new TextEncoder().encode(JSON.stringify(streets)).byteLength;
  const bytes = new OsmCache(loader, { ttlMs: 1000, maxEntries: 6, maxBytes: oneSize });
  await bytes.load(a); await bytes.load(b); await bytes.load(a); expect(loader).toHaveBeenCalledTimes(9);
});
it('deduplicates concurrent contained requests and lets another consumer survive cancellation', async () => {
  const response = deferred<OsmResponse>();
  let requestSignal!: AbortSignal;
  const loader = vi.fn((_box: OsmBounds, signal: AbortSignal) => { requestSignal = signal; return response.promise; });
  const cache = new OsmCache(loader);
  const cancelled = new AbortController();
  const first = cache.load(bounds, cancelled.signal);
  const rejected = expect(first).rejects.toHaveProperty('name', 'AbortError');
  const second = cache.load([38.1, -121.9, 38.9, -121.1]);
  await Promise.resolve(); cancelled.abort(); await rejected;
  expect(requestSignal.aborted).toBe(false);
  response.resolve(streets); await expect(second).resolves.toEqual(streets);
  expect(loader).toHaveBeenCalledOnce();
});
it('aborts an unused request and ignores its late success when a replacement starts', async () => {
  const old = deferred<OsmResponse>();
  const fresh = deferred<OsmResponse>();
  const loader = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  const cache = new OsmCache(loader);
  const controller = new AbortController();
  const first = cache.load(bounds, controller.signal);
  const rejected = expect(first).rejects.toHaveProperty('name', 'AbortError');
  await Promise.resolve(); controller.abort(); await rejected;
  expect(loader.mock.calls[0][1].aborted).toBe(true);
  const replacement = cache.load(bounds);
  old.resolve({ elements: [{ type: 'way', id: 99 }] });
  fresh.resolve(streets);
  await replacement; await expect(cache.load(bounds)).resolves.toEqual(streets);
  expect(loader).toHaveBeenCalledTimes(2);
});
it('does not cache failures, empty fallback or partial Overpass results', async () => {
  const loader = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ elements: [] }).mockResolvedValueOnce({ elements: streets.elements, remark: 'Query timed out' }).mockResolvedValue(streets);
  const cache = new OsmCache(loader);
  await expect(cache.load(bounds)).rejects.toThrow('Offline');
  await cache.load(bounds); await cache.load(bounds); await cache.load(bounds); await cache.load(bounds);
  expect(loader).toHaveBeenCalledTimes(4);
});
it('rejects invalid boxes and already cancelled callers without starting a download', async () => {
  const loader = vi.fn(async () => streets); const cache = new OsmCache(loader);
  for (const box of [[NaN, 1, 2, 3], [1, 2, 0, 3], [-91, 1, 2, 3]]) await expect(cache.load(box as OsmBounds)).rejects.toThrow('Invalid');
  const controller = new AbortController(); controller.abort();
  await expect(cache.load(bounds, controller.signal)).rejects.toHaveProperty('name', 'AbortError');
  expect(loader).not.toHaveBeenCalled();
});
