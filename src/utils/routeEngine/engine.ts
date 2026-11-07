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
    osmData = await fetchOsm(bbox);
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

  // 4. Split a run where the route turns sharply but stays on same street
  const finalRuns: [string, number, number][] = [];
  for (const [lab, s, e] of runs) {
    let cut = s;
    let i = s + 1;
    while (i < e) {
      const hb = headingAt(samples, i, 50, false);
      const ha = headingAt(samples, i, 50, true);
      const need = lab.startsWith('unnamed') || lab === 'off-street' ? 60 : 120;
      if (
        hb !== null &&
        ha !== null &&
        Math.abs(angleDiff(hb, ha)) >= need &&
        samples[i][1] - samples[cut][1] >= minLeg &&
        samples[e][1] - samples[i][1] >= minLeg
      ) {
        finalRuns.push([lab, cut, i]);
        cut = i;
        i += Math.floor(20 / step);
      }
      i++;
    }
    finalRuns.push([lab, cut, e]);
  }
  runs = finalRuns;

  const turnAt = (k: number): number => {
    const s = runs[k][1];
    const win = Math.min(
      40,
      Math.max(10, (samples[runs[k][2]][1] - samples[s][1]) / 2),
      Math.max(10, (samples[s][1] - samples[runs[k - 1][1]][1]) / 2)
    );
    const hi = headingAt(samples, s, win, false);
    const ho = headingAt(samples, s, win, true);
    return hi !== null && ho !== null ? angleDiff(hi, ho) : 0;
  };

  // Undo same-street splits that turn out not to be real turns
  let kMerge = 1;
  while (kMerge < runs.length) {
    const short =
      Math.min(
        samples[runs[kMerge][2]][1] - samples[runs[kMerge][1]][1],
        samples[runs[kMerge - 1][2]][1] - samples[runs[kMerge - 1][1]][1]
      ) <
      2 * minLeg;
    if (
      runs[kMerge][0] === runs[kMerge - 1][0] &&
      (short || Math.abs(turnAt(kMerge)) < 120)
    ) {
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
    const shortLab = abbreviateStreet(lab);

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
      const where = poi ? ` by ${poi[1]}` : '';
      const whereConcise = poi ? ` (${poi[1]})` : '';
      text = `Start on ${lab}${where}, heading ${cardDir}`;
      conciseText = `START [${cardShort}] ${shortLab}${whereConcise}`;
      cue = 'START';
      turn = null;
    } else {
      const delta = turnAt(k);
      let phrase = turnPhrase(delta);
      cue = turnCue(delta);
      if (lab === runs[k - 1][0] && Math.abs(delta) >= 20) {
        phrase = phrase.replace(' onto', ' to stay on');
        conciseText = `${cue} to stay on ${shortLab}`;
      } else {
        conciseText = `${cue} on ${shortLab}`;
      }
      text = `${phrase} ${lab}, heading ${cardDir}`;
      turn = Math.round(delta);
    }

    const item: DirectionStep = {
      step: k + 1,
      instruction: text,
      instruction_concise: conciseText,
      cue,
      heading_cardinal: cardShort,
      street: lab,
      street_concise: shortLab,
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
