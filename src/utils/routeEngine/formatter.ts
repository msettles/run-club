/**
 * formatter.ts - Direction text, cues, abbreviations, and GeoJSON formatting
 * Ported from scripts/gpx_route/formatter.py
 */

export const DEFAULT_POI_REPLACEMENTS: Record<string, string> = {
  'United States Post Office': 'Blue Note Brewing',
  'USPS': 'Blue Note Brewing',
  'Blue Note': 'Blue Note Brewing',
};

export const STREET_SUFFIXES: Record<string, string> = {
  Street: 'St',
  Avenue: 'Ave',
  Boulevard: 'Blvd',
  Drive: 'Dr',
  Road: 'Rd',
  Lane: 'Ln',
  Court: 'Ct',
  Place: 'Pl',
  Circle: 'Cir',
  Parkway: 'Pkwy',
  Highway: 'Hwy',
  Way: 'Way',
};

export const COMPASS_SHORT: Record<string, string> = {
  north: 'N',
  northeast: 'NE',
  east: 'E',
  southeast: 'SE',
  south: 'S',
  southwest: 'SW',
  west: 'W',
  northwest: 'NW',
};

export function turnPhrase(delta: number): string {
  const a = Math.abs(delta);
  const side = delta > 0 ? 'right' : 'left';
  if (a < 20) return 'Continue onto';
  if (a < 45) return `Bear ${side} onto`;
  if (a < 135) return `Turn ${side} onto`;
  if (a < 165) return `Make a sharp ${side} onto`;
  return 'Make a U-turn onto';
}

export function turnCue(delta: number | null): string {
  if (delta === null) return 'START';
  const a = Math.abs(delta);
  const side = delta > 0 ? 'R' : 'L';
  if (a < 20) return 'CONT';
  if (a < 45) return `Slight ${side}`;
  if (a < 135) return side;
  if (a < 165) return `Sharp ${side}`;
  return 'U-turn';
}

export function abbreviateStreet(name: string): string {
  if (!name) return name;
  const words = name.split(' ');
  if (words.length > 1) {
    const last = words[words.length - 1];
    if (STREET_SUFFIXES[last]) {
      words[words.length - 1] = STREET_SUFFIXES[last];
      return words.join(' ');
    }
  }
  return name;
}

export function abbreviateCrossings(crossings: string[]): string[] {
  return crossings.map((c) => {
    const words = c.split(' ');
    if (words.length > 1 && STREET_SUFFIXES[words[words.length - 1]]) {
      return words.slice(0, -1).join(' ');
    }
    return c;
  });
}

export function compass(b: number): string {
  const dirs = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ];
  const idx = Math.floor((b + 22.5) / 45) % 8;
  return dirs[idx];
}

export function fmtDist(m: number, units: 'mi' | 'km' = 'mi'): string {
  if (units === 'km') {
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
  }
  const mi = m / 1609.344;
  return mi < 0.1 ? `${Math.round(m * 3.28084)} ft` : `${mi.toFixed(2)} mi`;
}

export interface DirectionStep {
  step: number;
  instruction: string;
  instruction_concise: string;
  cue: string;
  heading_cardinal: string;
  street: string;
  street_concise: string;
  distance_m: number;
  distance: string;
  turn_degrees: number | null;
  at_km: number;
  point: [number, number]; // [lon, lat]
  coordinates: [number, number][]; // [[lon, lat], ...]
  crosses?: string[];
  crosses_concise?: string[];
  customNotes?: string;
}

export interface DirectionsResult {
  name: string;
  total_m: number;
  total: string;
  loop: boolean;
  steps: DirectionStep[];
  finish: string;
  finish_concise: string;
  finish_point: [number, number];
}

/**
 * Converts a DirectionsResult into a valid GeoJSON FeatureCollection
 */
export function toGeoJson(d: DirectionsResult): any {
  const features: any[] = [];

  // 1. LineString track geometry
  const allCoords: [number, number][] = [];
  for (const s of d.steps) {
    if (s.coordinates && s.coordinates.length > 0) {
      if (allCoords.length === 0) {
        allCoords.push(...s.coordinates);
      } else {
        // Skip duplicate connecting point if present
        const startIdx =
          allCoords[allCoords.length - 1][0] === s.coordinates[0][0] &&
          allCoords[allCoords.length - 1][1] === s.coordinates[0][1]
            ? 1
            : 0;
        allCoords.push(...s.coordinates.slice(startIdx));
      }
    }
  }

  features.push({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: allCoords,
    },
    properties: {
      name: d.name,
      total: d.total,
      total_m: d.total_m,
      loop: d.loop,
    },
  });

  // 2. Start Point
  if (d.steps.length > 0 && d.steps[0].point) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: d.steps[0].point,
      },
      properties: {
        feature_type: 'start',
        step: 1,
        cue: 'START',
        instruction: d.steps[0].instruction,
        instruction_concise: d.steps[0].instruction_concise,
        street: d.steps[0].street,
      },
    });
  }

  // 3. Turn points
  for (const s of d.steps) {
    if (s.point) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: s.point,
        },
        properties: {
          feature_type: 'turn',
          step: s.step,
          cue: s.cue,
          instruction: s.instruction,
          instruction_concise: s.instruction_concise,
          street: s.street,
          distance: s.distance,
          at_km: s.at_km,
        },
      });
    }
  }

  // 4. Finish point
  if (d.finish_point) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: d.finish_point,
      },
      properties: {
        feature_type: 'finish',
        step: d.steps.length + 1,
        cue: 'FINISH',
        instruction: d.finish,
        instruction_concise: d.finish_concise,
        loop: d.loop,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    properties: {
      name: d.name || 'Route',
      total: d.total,
      total_m: d.total_m,
      loop: d.loop,
    },
    features,
  };
}
