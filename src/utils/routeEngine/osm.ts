/**
 * osm.ts - OpenStreetMap Overpass API client and spatial indexing
 * Ported from scripts/gpx_route/osm.py
 */

import { Projector, bearing, pointSegDist, segsIntersect } from './geometry';

export const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export const GENERIC_HIGHWAY_NAMES: Record<string, string> = {
  service: 'service road',
  footway: 'footpath',
  path: 'path',
  cycleway: 'bike path',
  pedestrian: 'pedestrian street',
  track: 'track',
  steps: 'steps',
  bridleway: 'bridleway',
  corridor: 'corridor',
  living_street: 'street',
  residential: 'street',
  unclassified: 'road',
};

export interface OsmElement {
  type: 'way' | 'node' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export interface OsmResponse {
  elements: OsmElement[];
}

/**
 * Download OpenStreetMap street & POI network for a bounding box
 */
export async function fetchOsm(bbox: [number, number, number, number], signal?: AbortSignal): Promise<OsmResponse> {
  const [s, w, n, e] = bbox;
  // Streamlined query focusing on walkable/runnable highways and key landmark amenities
  const query = `[out:json][timeout:15];
(
  way["highway"]["highway"!~"proposed|construction|abandoned|platform|elevator|motorway|motorway_link"](${s},${w},${n},${e});
  nwr["amenity"~"brewery|pub|bar|post_office|townhall"](${s},${w},${n},${e});
);
out tags geom;`;

  let lastError: any = null;

  for (const url of OVERPASS_URLS) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      // 10-second timeout per mirror
      timeoutId = setTimeout(() => controller.abort(new Error(`Timeout connecting to ${url}`)), 10000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: controller.signal,
      });


      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data: OsmResponse = await response.json();
      if (data && Array.isArray(data.elements) && data.elements.length > 0 && !('remark' in data)) {
        return data;
      }
    } catch (err: any) {
      signal?.throwIfAborted();
      lastError = err;
      console.warn(`Overpass mirror ${url} failed:`, err?.message || err);
    } finally { clearTimeout(timeoutId); signal?.removeEventListener('abort', abort); }
  }

  // Non-fatal fallback: When public Overpass servers are down, rate limited, or slow,
  // return an empty elements array so the route engine can generate geometric turn cues
  // without crashing the upload process.
  console.warn(`All Overpass mirrors timed out or unavailable (${lastError?.message || 'timeout'}). Falling back to geometric cues.`);
  return { elements: [] };
}

export function wayLabel(tags: Record<string, string>): string | null {
  if (tags.name) return tags.name;
  if (tags.ref) return tags.ref;
  const hw = tags.highway || 'road';

  if (hw === 'service' && tags.service && ['alley', 'parking_aisle', 'driveway'].includes(tags.service)) {
    const serviceMap: Record<string, string> = {
      alley: 'alley',
      parking_aisle: 'parking lot',
      driveway: 'driveway',
    };
    return serviceMap[tags.service] || 'service road';
  }

  if (hw === 'footway' && tags.footway === 'sidewalk') {
    return null; // sidewalks: let the adjacent street win
  }
  if (hw === 'footway' && tags.footway === 'crossing') {
    return null;
  }

  const genericName = GENERIC_HIGHWAY_NAMES[hw] || hw.replace(/_/g, ' ');
  return `unnamed ${genericName}`;
}

export function poiCenter(el: OsmElement): [number, number] | null {
  if (el.lat !== undefined && el.lon !== undefined) {
    return [el.lat, el.lon];
  }
  if (el.center) {
    return [el.center.lat, el.center.lon];
  }
  if (el.geometry && el.geometry.length > 0) {
    const sumLat = el.geometry.reduce((acc, p) => acc + p.lat, 0);
    const sumLon = el.geometry.reduce((acc, p) => acc + p.lon, 0);
    return [sumLat / el.geometry.length, sumLon / el.geometry.length];
  }
  if (el.bounds) {
    return [
      (el.bounds.minlat + el.bounds.maxlat) / 2,
      (el.bounds.minlon + el.bounds.maxlon) / 2,
    ];
  }
  return null;
}

export interface StreetSegment {
  a: [number, number];
  b: [number, number];
  label: string;
  wayId: number;
}

export interface PoiEntry {
  xy: [number, number];
  name: string;
  kind: string;
}

/**
 * Spatial index of OSM ways and POIs mapped into local projected meters
 */
export class StreetIndex {
  cell: number;
  grid: Map<string, number[]>;
  segments: StreetSegment[];
  pois: PoiEntry[];

  constructor(osm: OsmResponse, proj: Projector, cell = 50.0) {
    this.cell = cell;
    this.grid = new Map();
    this.segments = [];
    this.pois = [];

    for (const el of osm.elements || []) {
      const tags = el.tags || {};
      if (el.type === 'way' && tags.highway && el.geometry && el.geometry.length > 1) {
        const label = wayLabel(tags);
        if (!label) continue;

        const geom: [number, number][] = el.geometry.map((p) => proj.xy(p.lat, p.lon));
        for (let i = 0; i < geom.length - 1; i++) {
          this.addSegment(geom[i], geom[i + 1], label, el.id);
        }
      } else if (tags.name && !tags.highway) {
        const center = poiCenter(el);
        if (center) {
          const kindKey = ['amenity', 'shop', 'tourism', 'leisure', 'historic', 'craft'].find(
            (k) => k in tags
          );
          const kind = kindKey ? tags[kindKey] : '';
          this.pois.push({
            xy: proj.xy(center[0], center[1]),
            name: tags.name,
            kind,
          });
        }
      }
    }
  }

  private addSegment(
    a: [number, number],
    b: [number, number],
    label: string,
    wayId: number
  ) {
    const idx = this.segments.length;
    this.segments.push({ a, b, label, wayId });

    const x0 = Math.min(a[0], b[0]);
    const x1 = Math.max(a[0], b[0]);
    const y0 = Math.min(a[1], b[1]);
    const y1 = Math.max(a[1], b[1]);

    const gx0 = Math.floor(x0 / this.cell);
    const gx1 = Math.floor(x1 / this.cell);
    const gy0 = Math.floor(y0 / this.cell);
    const gy1 = Math.floor(y1 / this.cell);

    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = `${gx},${gy}`;
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(idx);
      }
    }
  }

  *near(p: [number, number], radius: number): Generator<StreetSegment> {
    const r = Math.floor(radius / this.cell) + 1;
    const gx = Math.floor(p[0] / this.cell);
    const gy = Math.floor(p[1] / this.cell);
    const seen = new Set<number>();

    for (let i = gx - r; i <= gx + r; i++) {
      for (let j = gy - r; j <= gy + r; j++) {
        const key = `${i},${j}`;
        const indices = this.grid.get(key);
        if (indices) {
          for (const idx of indices) {
            if (!seen.has(idx)) {
              seen.add(idx);
              yield this.segments[idx];
            }
          }
        }
      }
    }
  }

  match(p: [number, number], heading: number, radius: number): string | null {
    let best: string | null = null;
    let bestScore = Infinity;

    for (const seg of this.near(p, radius)) {
      const d = pointSegDist(p, seg.a, seg.b);
      if (d > radius) continue;

      const segBrg = bearing(seg.a, seg.b);
      // Angular misalignment: 0 when parallel in either direction
      const misalign = Math.abs(Math.sin(((segBrg - heading) * Math.PI) / 180));
      let score = d + 25 * misalign;
      if (seg.label.startsWith('unnamed ')) {
        score += 4; // preference for named streets
      }

      if (score < bestScore) {
        best = seg.label;
        bestScore = score;
      }
    }

    return best;
  }

  nearestPoi(
    p: [number, number],
    radius: number,
    replacements?: Record<string, string>
  ): [number, string, string] | null {
    let best: [number, string, string] | null = null;

    for (const poi of this.pois) {
      const d = Math.hypot(poi.xy[0] - p[0], poi.xy[1] - p[1]);
      if (d <= radius && (best === null || d < best[0])) {
        best = [d, poi.name, poi.kind];
      }
    }

    if (best) {
      const [d, , kind] = best;
      let name = best[1];
      if (replacements) {
        if (replacements[name]) {
          name = replacements[name];
        } else {
          for (const [k, v] of Object.entries(replacements)) {
            if (
              name.toLowerCase().includes(k.toLowerCase()) ||
              k.toLowerCase().includes(name.toLowerCase())
            ) {
              name = v;
              break;
            }
          }
        }
      }
      return [d, name, kind];
    }

    return null;
  }

  crossings(pathXy: [number, number][], exclude: Set<string>): string[] {
    const found: string[] = [];

    for (let i = 0; i < pathXy.length - 1; i++) {
      const p = pathXy[i];
      const q = pathXy[i + 1];
      const mid: [number, number] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const rad = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2 + 5;

      for (const seg of this.near(mid, rad)) {
        if (
          exclude.has(seg.label) ||
          seg.label.startsWith('unnamed') ||
          ['alley', 'parking lot', 'driveway'].includes(seg.label)
        ) {
          continue;
        }

        if (segsIntersect(p, q, seg.a, seg.b) && !found.includes(seg.label)) {
          found.push(seg.label);
        }
      }
    }

    return found;
  }
}
