import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { generateRouteDirectionsFromGpx } from './index';

class WorkerHarness {
  static instances: WorkerHarness[] = [];
  onmessage?: (event: { data: Record<string, unknown> }) => void;
  onerror?: (event: { message: string }) => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { WorkerHarness.instances.push(this); }
}
const parsed = { points: [{ lat: 38, lon: -121 }, { lat: 38.001, lon: -121.001 }], name: 'Test route' };
beforeEach(() => { vi.useFakeTimers(); WorkerHarness.instances = []; vi.stubGlobal('Worker', WorkerHarness); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('publishes progress separately and terminates the worker after a coherent result', async () => {
  const progress = vi.fn();
  const result = generateRouteDirectionsFromGpx('', 'test.gpx', { parsed, onProgress: progress });
  const worker = WorkerHarness.instances[0];
  worker.onmessage?.({ data: { progress: 'Matching streets' } });
  expect(progress).toHaveBeenCalledWith('Matching streets');
  expect(worker.terminate).not.toHaveBeenCalled();
  worker.onmessage?.({ data: { result: { name: 'Test route' } } });
  await expect(result).resolves.toMatchObject({ name: 'Test route' });
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('cancels replacement jobs and ignores late progress from an old worker', async () => {
  const controller = new AbortController();
  const progress = vi.fn();
  const result = generateRouteDirectionsFromGpx('', 'test.gpx', { parsed, signal: controller.signal, onProgress: progress });
  const rejected = expect(result).rejects.toHaveProperty('name', 'AbortError');
  controller.abort();
  await rejected;
  const worker = WorkerHarness.instances[0];
  worker.onmessage?.({ data: { progress: 'Old job' } });
  expect(progress).not.toHaveBeenCalled();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it('bounds the complete job including slow response bodies and geocoding', async () => {
  const result = generateRouteDirectionsFromGpx('', 'test.gpx', { parsed });
  const rejected = expect(result).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(60000);
  await rejected;
  expect(WorkerHarness.instances[0].terminate).toHaveBeenCalledOnce();
});
