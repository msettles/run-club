/**
 * engine.ts - Core pipeline matching GPX coordinates to OpenStreetMap streets and generating directions
 * Ported from scripts/gpx_route/engine.py
 */

import {
  Projector,
  angleDiff,
  bearing,
  resample,
  simplify,
  smooth,
} from './geometry';
import { StreetIndex, fetchOsm, OsmResponse } from './osm';
import {
  COMPASS_SHORT,
  DEFAULT_POI_REPLACEMENTS,
  abbreviateCrossings,
  abbreviateStreet,
  compass,
  fmtDist,
  turnCue,
  turnPhrase,
  DirectionsResult,
  DirectionStep,
} from './formatter';

/**
 * Heading over `window` meters before (forward=false) or after sample i
 */
export function headingAt(
  samples: [[number, number], number][],
  i: number,
  window: number,
  forward: boolean
): number | null {
  const d0 = samples[i][1];
  let j = i;
  if (forward) {
    while (j < samples.length - 1 && samples[j][1] - d0 < window) {
      j++;
    }
    const a = samples[i][0];
    const b = samples[j][0];
    if (a[0] === b[0] && a[1] === b[1]) return null;
    return bearing(a, b);
  } else {
    while (j > 0 && d0 - samples[j][1] < window) {
      j--;
    }
    const a = samples[j][0];
    const b = samples[i][0];
    if (a[0] === b[0] && a[1] === b[1]) return null;
    return bearing(a, b);
  }
}

function localTurnAngle(
  samples: [[number, number], number][],
  i: number,
  winM: number = 20.0
): number {
  const d0 = samples[i][1];
  let jBack = i;
  while (jBack > 0 && d0 - samples[jBack][1] < winM) {
    jBack--;
  }
  let jFwd = i;
  while (jFwd < samples.length - 1 && samples[jFwd][1] - d0 < winM) {
    jFwd++;
  }
  const pBack = samples[jBack][0];
  const pCur = samples[i][0];
  const pFwd = samples[jFwd][0];
  return angleDiff(bearing(pBack, pCur), bearing(pCur, pFwd));
}

export interface BuildDirectionsOptions {
  name?: string;
  units?: 'mi' | 'km';
  step?: number;
  radius?: number;
  minLeg?: number;
  smoothing?: number;
  tolerance?: number;
  poiReplacements?: Record<string, string>;
  crossStreets?: boolean;
  prefetchedOsm?: OsmResponse;
  onProgress?: (status: string) => void;
}

/**
 * Builds turn-by-turn directions from a list of [lat, lon] track coordinates
 */
export async function buildDirections(
  pts: [number, number][],
  options: BuildDirectionsOptions = {}
): Promise<DirectionsResult> {
  const {
    name = 'Route',
    units = 'mi',
    step = 5.0,
    radius = 25.0,
    minLeg = 30.0,
    smoothing = 12.0,
    tolerance = 6.0,
    poiReplacements,
    crossStreets = true,
    prefetchedOsm,
    onProgress,
  } = options;

  if (pts.length < 2) {
    throw new Error('GPX track must contain at least 2 coordinate points.');
  }

  onProgress?.('Smoothing GPS track and calculating geometry...');

  const reps = { ...DEFAULT_POI_REPLACEMENTS, ...(poiReplacements || {}) };

  const lat0 = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
  const lon0 = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  const proj = new Projector(lat0, lon0);

  const rawXy: [number, number][] = pts.map((p) => proj.xy(p[0], p[1]));
  const smoothedXy = simplify(smooth(rawXy, smoothing), tolerance);
  const samples = resample(smoothedXy, step);
  const total = samples[samples.length - 1][1];

  const pad = 0.002; // ~200 meters padding
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  const bbox: [number, number, number, number] = [
    Math.min(...lats) - pad,
    Math.min(...lons) - pad,
    Math.max(...lats) + pad,
    Math.max(...lons) + pad,
  ];

  let osmData = prefetchedOsm;
  if (!osmData) {
    onProgress?.('Fetching street and landmark data from OpenStreetMap...');
    try {
      osmData = await fetchOsm(bbox);
    } catch (err) {
      console.warn('OSM Overpass query failed or timed out, falling back to geometric route cues:', err);
      onProgress?.('Street database offline — using course route pathway cues...');
      osmData = { elements: [] };
    }
  }

  onProgress?.('Matching track to street network...');
  const idx = new StreetIndex(osmData, proj);

  // 1. Label every sample with a candidate street
  const labels: string[] = [];
  for (let i = 0; i < samples.length; i++) {
    const h =
      headingAt(samples, i, 10, true) ??
      headingAt(samples, i, 10, false) ??
      0;
    labels.push(idx.match(samples[i][0], h, radius) || 'off-street');
  }

  // Majority vote over window (~+-15 m) to suppress intersection jitter
  const kWindow = Math.max(1, Math.floor(15 / step));
  const voted: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    const startIdx = Math.max(0, i - kWindow);
    const endIdx = Math.min(labels.length, i + kWindow + 1);
    const win = labels.slice(startIdx, endIdx);

    const counts: Record<string, number> = {};
    for (const item of win) {
      counts[item] = (counts[item] || 0) + 1;
    }

    let topLabel = labels[i];
    let topCount = counts[topLabel] || 0;
    for (const [candidate, count] of Object.entries(counts)) {
      if (count > topCount) {
        topLabel = candidate;
        topCount = count;
      }
    }
    voted.push(topLabel);
  }

  // 2. Runs of identical labels: [label, startIndex, endIndex]
  let runs: [string, number, number][] = [];
  for (let i = 0; i < voted.length; i++) {
    const lab = voted[i];
    if (runs.length > 0 && runs[runs.length - 1][0] === lab) {
      runs[runs.length - 1][2] = i;
    } else {
      runs.push([lab, i, i]);
    }
  }

  const runLength = (r: [string, number, number]) =>
    samples[r[2]][1] - samples[r[1]][1] + step;

  // 3. Absorb short noisy runs into neighbors
  let changed = true;
  while (changed && runs.length > 1) {
    changed = false;
    let shortestIdx = 0;
    let shortestLen = runLength(runs[0]);

    for (let i = 1; i < runs.length; i++) {
      const len = runLength(runs[i]);
      if (len < shortestLen) {
        shortestLen = len;
        shortestIdx = i;
      }
    }

    if (shortestLen < minLeg) {
      const k = shortestIdx;
      if (k === 0) {
        runs[1][1] = runs[0][1];
        runs.shift();
      } else if (k === runs.length - 1) {
        runs[runs.length - 2][2] = runs[runs.length - 1][2];
        runs.pop();
      } else {
        const prev = runs[k - 1];
        const nxt = runs[k + 1];
        if (prev[0] === nxt[0]) {
          prev[2] = nxt[2];
          runs.splice(k, 2);
        } else {
          // Give to longer neighbor
          if (runLength(prev) >= runLength(nxt)) {
            prev[2] = runs[k][2];
          } else {
            nxt[1] = runs[k][1];
          }
          runs.splice(k, 1);
        }
      }

      // Re-merge identical neighbors
      const merged: [string, number, number][] = [runs[0]];
      for (let i = 1; i < runs.length; i++) {
        if (runs[i][0] === merged[merged.length - 1][0]) {
          merged[merged.length - 1][2] = runs[i][2];
        } else {
          merged.push(runs[i]);
        }
      }
      runs = merged;
      changed = true;
    }
  }

  // 4. Split a run where the route turns (stays on same street or off-street / unmapped)
  const finalRuns: [string, number, number][] = [];
  for (const [lab, s, e] of runs) {
    let cut = s;
    let i = s + 1;
    const isGeneric = !lab || lab === 'off-street' || lab.startsWith('unnamed');
    const need = isGeneric ? 35.0 : 45.0;

    while (i < e) {
      const ang = localTurnAngle(samples, i, 20.0);
      if (
        Math.abs(ang) >= need &&
        samples[i][1] - samples[cut][1] >= minLeg &&
        samples[e][1] - samples[i][1] >= minLeg
      ) {
        // Find peak apex in the local neighborhood (within ~25m)
        let bestI = i;
        const searchEnd = Math.min(e, i + Math.floor(25.0 / step));
        for (let checkI = i; checkI <= searchEnd; checkI++) {
          if (
            Math.abs(localTurnAngle(samples, checkI, 20.0)) >
            Math.abs(localTurnAngle(samples, bestI, 20.0))
          ) {
            bestI = checkI;
          }
        }

        finalRuns.push([lab, cut, bestI]);
        cut = bestI;
        i = bestI + Math.floor(minLeg / step);
      } else {
        i++;
      }
    }
    finalRuns.push([lab, cut, e]);
  }
  runs = finalRuns;

  const turnAt = (k: number): number => {
    const s = runs[k][1];
    const win = Math.min(
      35,
      Math.max(10, (samples[runs[k][2]][1] - samples[s][1]) / 2),
      Math.max(10, (samples[s][1] - samples[runs[k - 1][1]][1]) / 2)
    );
    const hi = headingAt(samples, s, win, false);
    const ho = headingAt(samples, s, win, true);
    return hi !== null && ho !== null ? angleDiff(hi, ho) : 0;
  };

  // 4b. Undo same-street splits that turn out NOT to be real turns (< 35 deg)
  let kMerge = 1;
  while (kMerge < runs.length) {
    const sameLabel = runs[kMerge][0] === runs[kMerge - 1][0];
    const tAng = Math.abs(turnAt(kMerge));
    // Only merge if both runs have the exact same label AND it is NOT a real turn (< 35 deg)
    if (sameLabel && tAng < 35.0) {
      runs[kMerge - 1][2] = runs[kMerge][2];
      runs.splice(kMerge, 1);
    } else {
      kMerge++;
    }
  }

  onProgress?.('Generating turn-by-turn cue sheet and landmark phrases...');

  // 5. Build step list
  const steps: DirectionStep[] = [];
  const startP = samples[0][0];
  const poi = idx.nearestPoi(startP, 60, reps);

  for (let k = 0; k < runs.length; k++) {
    const [lab, s, e] = runs[k];
    const leg = samples[e][1] - samples[s][1] + (k < runs.length - 1 ? step : 0);
    const hOut =
      headingAt(samples, s, Math.min(100, Math.max(10, samples[e][1] - samples[s][1])), true) ?? 0;
    const cardDir = compass(hOut);
    const cardShort = COMPASS_SHORT[cardDir] || '';

    const legCoords: [number, number][] = [];
    for (let i = s; i <= e; i++) {
      legCoords.push(proj.lonlat(samples[i][0][0], samples[i][0][1]));
    }
    const startPt = proj.lonlat(samples[s][0][0], samples[s][0][1]);

    let text: string;
    let conciseText: string;
    let cue: string;
    let turn: number | null = null;

    if (k === 0) {
      const startStreet = (lab === 'off-street' || !lab) ? 'Dead Cat Alley' : lab;
      const startShort = abbreviateStreet(startStreet);
      const startPoi = poi ? poi[1] : 'Blue Note Brewing';
      const where = ` by ${startPoi}`;
      const whereConcise = ` (${startPoi})`;
      text = `Start on ${startStreet}${where}, heading ${cardDir}`;
      conciseText = `START [${cardShort}] ${startShort}${whereConcise}`;
      cue = 'START';
      turn = null;
    } else {
      const delta = turnAt(k);
      let phrase = turnPhrase(delta);
      cue = turnCue(delta);
      const isOffStreet = !lab || lab === 'off-street' || lab === 'course path';
      const roadName = isOffStreet ? '' : lab;
      const shortRoad = abbreviateStreet(roadName);

      if (lab === runs[k - 1][0] && Math.abs(delta) >= 35 && !isOffStreet) {
        phrase = phrase.replace(' onto', ' to stay on');
        conciseText = `${cue} to stay on ${shortRoad}`;
        text = `${phrase} ${roadName}, heading ${cardDir}`;
      } else if (isOffStreet) {
        // Clean geometric cue when street name is not yet identified
        const baseAction = phrase.replace(' onto', '');
        text = `${baseAction}, heading ${cardDir}`;
        conciseText = `${cue} [${cardShort}]`;
      } else {
        conciseText = `${cue} on ${shortRoad}`;
        text = `${phrase} ${roadName}, heading ${cardDir}`;
      }
      turn = Math.round(delta);
    }

    const stepStreet = (k === 0 && (!lab || lab === 'off-street'))
      ? 'Dead Cat Alley'
      : (!lab || lab === 'off-street' ? 'course path' : lab);
    const stepStreetConcise = abbreviateStreet(stepStreet);

    const item: DirectionStep = {
      step: k + 1,
      instruction: text,
      instruction_concise: conciseText,
      cue,
      heading_cardinal: cardShort,
      street: stepStreet,
      street_concise: stepStreetConcise,
      distance_m: Math.round(leg),
      distance: fmtDist(leg, units),
      turn_degrees: turn,
      at_km: Math.round((samples[s][1] / 1000) * 1000) / 1000,
      point: startPt,
      coordinates: legCoords,
    };

    if (crossStreets) {
      const path: [number, number][] = [];
      for (let i = s; i <= e; i++) {
        path.push(samples[i][0]);
      }
      const excludeSet = new Set<string>([lab]);
      if (k > 0) excludeSet.add(runs[k - 1][0]);
      if (k + 1 < runs.length) excludeSet.add(runs[k + 1][0]);

      const crosses = idx.crossings(path, excludeSet);
      item.crosses = crosses;
      item.crosses_concise = abbreviateCrossings(crosses);
    }

    steps.push(item);
  }

  // If Overpass was unavailable, use fast OpenStreetMap Nominatim reverse-geocoding for the turn points
  if ((!osmData || !osmData.elements || osmData.elements.length === 0) && steps.length > 1) {
    onProgress?.('Looking up turn street names from OpenStreetMap...');
    const geoCache = new Map<string, string>();

    for (let i = 1; i < steps.length; i++) {
      const s = steps[i];
      if (s.street === 'course path' || s.street === 'off-street') {
        try {
          // Look ~15 meters into the new leg coordinates rather than the exact intersection point
          // to reliably identify the road being turned onto!
          const targetPt = (s.coordinates && s.coordinates.length > 2)
            ? s.coordinates[Math.min(3, s.coordinates.length - 1)]
            : s.point;
          const [lon, lat] = targetPt;
          const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

          let road = geoCache.get(cacheKey);
          if (!road) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
              {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
              }
            );
            clearTimeout(timeout);
            if (res.ok) {
              const data = await res.json();
              road =
                data.address?.road ||
                data.address?.pedestrian ||
                data.address?.footway ||
                data.address?.path ||
                data.name;
              if (road) {
                geoCache.set(cacheKey, road);
              }
            }
          }

          if (road) {
            const shortRoad = abbreviateStreet(road);
            s.street = road;
            s.street_concise = shortRoad;
            const delta = s.turn_degrees || 0;
            const phrase = turnPhrase(delta);
            const cardDir = s.heading_cardinal ? s.heading_cardinal : '';
            s.instruction = `${phrase} ${road}${cardDir ? `, heading ${cardDir}` : ''}`;
            s.instruction_concise = `${s.cue} on ${shortRoad}`;
          }
        } catch {
          // If Nominatim fails or times out, keep clean geometric cue
        }
      }
    }
  }

  const endP = samples[samples.length - 1][0];
  const finishPt = proj.lonlat(endP[0], endP[1]);
  const loop = Math.hypot(endP[0] - startP[0], endP[1] - startP[1]) < 40;
  const endPoi = idx.nearestPoi(endP, 60, reps);

  let finish = loop ? 'Arrive back at Blue Note Brewing (start)' : 'Arrive at the finish';
  let finishConcise = loop ? 'FINISH (Blue Note Brewing)' : 'FINISH';
  if (endPoi && !loop) {
    finish += ` by ${endPoi[1]}`;
    finishConcise += ` by ${endPoi[1]}`;
  }

  return {
    name,
    total_m: Math.round(total),
    total: fmtDist(total, units),
    loop,
    steps,
    finish,
    finish_concise: finishConcise,
    finish_point: finishPt,
  };
}
