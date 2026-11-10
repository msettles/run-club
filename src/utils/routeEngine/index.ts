import { parseGPX } from '../gpxParser';
import type { GPXRoute } from '../../types';
import type { BuildDirectionsOptions } from './engine';
import type { RouteGenerationResult } from './generate';
export type { RouteGenerationResult } from './generate';
export * from './geometry';
export * from './osm';
export * from './formatter';
export * from './engine';

/** Isolate geometry/network work and cancel the entire job on replacement or close. */
export function generateRouteDirectionsFromGpx(
  xml: string, filename = 'course.gpx',
  options: Partial<BuildDirectionsOptions> & { signal?: AbortSignal; parsed?: Partial<GPXRoute> } = {}
): Promise<RouteGenerationResult> {
  const { signal, parsed = parseGPX(xml, filename), onProgress, ...settings } = options;
  if (signal?.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let finished = false;
    const finish = () => { if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate(); };
    const cancel = () => { finish(); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { finish(); reject(new Error('Route generation timed out. Please try again.')); }, 60000);
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onerror = (event) => { finish(); reject(new Error(event.message || 'Route generation failed.')); };
    worker.onmessage = ({ data }) => {
      if (finished) return;
      if ('progress' in data) { onProgress?.(data.progress); return; }
      finish();
      if (data.error) reject(new Error(data.error)); else resolve(data.result);
    };
    try { worker.postMessage({ parsed, filename, options: settings }); }
    catch (error) { finish(); reject(error); }
  });
}
