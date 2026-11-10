import { fetchOsm, type OsmResponse } from './osm';

export type OsmBounds = [number, number, number, number];
const contains = (outer: OsmBounds, inner: OsmBounds) => outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
const cancelled = () => new DOMException('Cancelled', 'AbortError');
export function validOsmBounds(value: unknown): value is OsmBounds {
  return Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)
    && value[0] >= -90 && value[2] <= 90 && value[1] >= -180 && value[3] <= 180
    && value[0] < value[2] && value[1] < value[3];
}
interface Entry { bounds: OsmBounds; data: OsmResponse; expires: number; bytes: number }
interface Pending { bounds: OsmBounds; controller: AbortController; users: number; promise: Promise<OsmResponse> }

/** Session-only raw network cache, shared by short-lived geometry workers. */
export class OsmCache {
  private ready = new Map<string, Entry>();
  private pending = new Map<string, Pending>();
  constructor(
    private readonly loader: (bounds: OsmBounds, signal: AbortSignal) => Promise<OsmResponse> = fetchOsm,
    private readonly options = { ttlMs: 15 * 60_000, maxEntries: 6, maxBytes: 8 * 1024 * 1024 },
    private readonly now = Date.now,
  ) {}

  load(bounds: OsmBounds, signal?: AbortSignal): Promise<OsmResponse> {
    if (signal?.aborted) return Promise.reject(cancelled());
    if (!validOsmBounds(bounds)) return Promise.reject(new Error('Invalid OpenStreetMap bounds.'));
    for (const [key, entry] of this.ready) if (entry.expires <= this.now()) this.ready.delete(key);
    for (const [key, entry] of this.ready) {
      if (contains(entry.bounds, bounds)) {
        this.ready.delete(key); this.ready.set(key, entry);
        return Promise.resolve(entry.data);
      }
    }
    let request = [...this.pending.values()].find((entry) => !entry.controller.signal.aborted && contains(entry.bounds, bounds));
    if (!request) {
      const key = bounds.join(',');
      const controller = new AbortController();
      const copy = [...bounds] as OsmBounds;
      request = { bounds: copy, controller, users: 0, promise: undefined! };
      const entry = request;
      entry.promise = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return this.loader(copy, controller.signal);
      }).then((data) => {
        // Empty/offline fallback and partially failed Overpass responses must be retried.
        if (!controller.signal.aborted && data.elements.length > 0 && !('remark' in data)) {
          const bytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
          if (bytes <= this.options.maxBytes) {
            this.ready.set(key, { bounds: copy, data, bytes, expires: this.now() + this.options.ttlMs });
            let total = [...this.ready.values()].reduce((sum, item) => sum + item.bytes, 0);
            while (this.ready.size > this.options.maxEntries || total > this.options.maxBytes) {
              const oldest = this.ready.keys().next().value!;
              total -= this.ready.get(oldest)!.bytes; this.ready.delete(oldest);
            }
          }
        }
        return data;
      }).finally(() => { if (this.pending.get(key) === entry) this.pending.delete(key); });
      this.pending.set(key, entry);
    }
    const entry = request;
    entry.users++;
    return new Promise((resolve, reject) => {
      let done = false;
      const release = () => {
        if (done) return false;
        done = true; signal?.removeEventListener('abort', abort);
        if (--entry.users === 0) entry.controller.abort();
        return true;
      };
      const abort = () => { if (release()) reject(cancelled()); };
      signal?.addEventListener('abort', abort, { once: true });
      entry.promise.then((data) => { if (release()) resolve(data); }, (error) => { if (release()) reject(error); });
    });
  }
}

export const sessionOsmCache = new OsmCache();
