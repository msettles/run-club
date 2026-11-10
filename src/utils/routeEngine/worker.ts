import { generateFromParsed } from './generate';
import type { OsmResponse } from './osm';
const pending = new Map<number, { resolve: (data: OsmResponse) => void; reject: (error: Error) => void }>();
let nextRequest = 0;
self.onmessage = async ({ data }) => {
  if (data.osmResponse) {
    const response = data.osmResponse;
    const request = pending.get(response.id);
    if (request) {
      pending.delete(response.id);
      if (response.error) request.reject(new Error(response.error)); else request.resolve(response.data);
    }
    return;
  }
  try {
    const result = await generateFromParsed(data.parsed, data.filename, { ...data.options, loadOsm: (bounds) => new Promise<OsmResponse>((resolve, reject) => {
      const id = nextRequest++;
      pending.set(id, { resolve, reject });
      self.postMessage({ osmRequest: { id, bounds } });
    }), onProgress: (progress: string) => self.postMessage({ progress }) });
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Route generation failed.' }); }
};
