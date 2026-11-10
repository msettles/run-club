import { afterEach, expect, it, vi } from 'vitest';
import { fetchOsm } from './osm';
const streets = { elements: [{ type: 'way', id: 1 }] };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('aborts a slow response body without trying another mirror after cancellation', async () => {
  let bodyStarted!: () => void;
  const started = new Promise<void>((resolve) => { bodyStarted = resolve; });
  const fetcher = vi.fn((_url, options) => Promise.resolve({ ok: true, json: () => {
    bodyStarted();
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  } }));
  vi.stubGlobal('fetch', fetcher);
  const controller = new AbortController();
  const result = fetchOsm([38, -122, 39, -121], controller.signal);
  const rejected = expect(result).rejects.toHaveProperty('name', 'AbortError');
  await started; controller.abort(); await rejected;
  expect(fetcher).toHaveBeenCalledOnce();
});
it('keeps the mirror deadline active during JSON body parsing and then tries the next mirror', async () => {
  vi.useFakeTimers(); vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => Promise.resolve({ ok: true, json: () => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })) })).mockResolvedValue({ ok: true, json: async () => streets });
  vi.stubGlobal('fetch', fetcher);
  const result = fetchOsm([38, -122, 39, -121]);
  await vi.advanceTimersByTimeAsync(10000);
  await expect(result).resolves.toEqual(streets);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
it('does not accept a partial Overpass timeout response as a successful download', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ...streets, remark: 'Query timed out' }) }).mockResolvedValue({ ok: true, json: async () => streets });
  vi.stubGlobal('fetch', fetcher);
  await expect(fetchOsm([38, -122, 39, -121])).resolves.toEqual(streets);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
