/**
 * geometry.ts - Equirectangular projection and polyline math for route analysis
 * Ported from scripts/gpx_route/geometry.py
 */

export const EARTH_R = 6371008.8; // Earth radius in meters

export class Projector {
  lat0: number;
  lon0: number;
  kx: number;
  ky: number;

  constructor(lat0: number, lon0: number) {
    this.lat0 = lat0;
    this.lon0 = lon0;
    this.kx = (Math.PI / 180) * EARTH_R * Math.cos((Math.PI / 180) * lat0);
    this.ky = (Math.PI / 180) * EARTH_R;
  }

  xy(lat: number, lon: number): [number, number] {
    return [(lon - this.lon0) * this.kx, (lat - this.lat0) * this.ky];
  }

  lonlat(x: number, y: number): [number, number] {
    return [
      Math.round((this.lon0 + x / this.kx) * 1e6) / 1e6,
      Math.round((this.lat0 + y / this.ky) * 1e6) / 1e6,
    ];
  }
}

/**
 * Compass bearing (0=N, 90=E) from point a to b, both (x, y) in local meters
 */
export function bearing(a: [number, number], b: [number, number]): number {
  const rad = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/**
 * Signed difference b - a in degrees, in (-180, 180]. Positive = clockwise = right.
 */
export function angleDiff(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/**
 * Distance in meters from point p to segment ab
 */
export function pointSegDist(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const ax = a[0];
  const ay = a[1];
  const dx = b[0] - ax;
  const dy = b[1] - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2));
  return Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy));
}

/**
 * Whether 2D segments p1p2 and p3p4 intersect
 */
export function segsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  function ccw(a: [number, number], b: [number, number], c: [number, number]): number {
    return (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]);
  }
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Points every `step` meters along the polyline, with cumulative distance
 */
export function resample(
  xy: [number, number][],
  step: number
): [[number, number], number][] {
  if (xy.length === 0) return [];
  const out: [[number, number], number][] = [[xy[0], 0.0]];
  let dist = 0.0;
  let carry = 0.0;

  for (let i = 0; i < xy.length - 1; i++) {
    const a = xy[i];
    const b = xy[i + 1];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg === 0) continue;

    let pos = step - carry;
    while (pos <= seg) {
      const t = pos / seg;
      out.push([
        [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])],
        dist + pos,
      ]);
      pos += step;
    }
    carry = seg - (pos - step);
    dist += seg;
  }

  if (out[out.length - 1][1] < dist) {
    out.push([xy[xy.length - 1], dist]);
  }
  return out;
}

/**
 * Moving average along the line (by distance), removes GPS jitter
 */
export function smooth(
  xy: [number, number][],
  halfWindow: number
): [number, number][] {
  if (halfWindow <= 0 || xy.length < 3) return xy;
  const dense = resample(xy, 2.0);
  const pts = dense.map((d) => d[0]);
  const k = Math.max(1, Math.floor(halfWindow / 2.0));
  const n = pts.length;

  const sx: number[] = [0.0];
  const sy: number[] = [0.0];
  for (let i = 0; i < pts.length; i++) {
    sx.push(sx[sx.length - 1] + pts[i][0]);
    sy.push(sy[sy.length - 1] + pts[i][1]);
  }

  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - k);
    const b = Math.min(n, i + k + 1);
    const count = b - a;
    out.push([(sx[b] - sx[a]) / count, (sy[b] - sy[a]) / count]);
  }
  out[0] = pts[0];
  out[out.length - 1] = pts[pts.length - 1];
  return out;
}

/**
 * Douglas-Peucker line simplification
 */
export function simplify(
  xy: [number, number][],
  tol: number
): [number, number][] {
  if (xy.length < 3 || tol <= 0) return xy;
  const keep = new Array(xy.length).fill(false);
  keep[0] = true;
  keep[xy.length - 1] = true;

  const stack: [number, number][] = [[0, xy.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop()!;
    let best = 0.0;
    let bi: number | null = null;
    for (let i = s + 1; i < e; i++) {
      const d = pointSegDist(xy[i], xy[s], xy[e]);
      if (d > best) {
        best = d;
        bi = i;
      }
    }
    if (bi !== null && best > tol) {
      keep[bi] = true;
      stack.push([s, bi]);
      stack.push([bi, e]);
    }
  }

  return xy.filter((_, i) => keep[i]);
}

/**
 * Offsets a polyline laterally by `offsetMeters` to the right-hand side of travel
 * (perpendicular to heading) so that the route does not obscure street names
 * printed along the street centerline on the underlying map tiles.
 */
export function offsetPolylineCoords(
  coords: [number, number][],
  offsetMeters = 3.5
): [number, number][] {
  if (coords.length < 2 || offsetMeters === 0) return coords;

  const result: [number, number][] = [];
  const mPerDegLat = 111139;

  for (let i = 0; i < coords.length; i++) {
    const curr = coords[i];
    const prev = i > 0 ? coords[i - 1] : null;
    const next = i < coords.length - 1 ? coords[i + 1] : null;

    let dLat = 0;
    let dLon = 0;

    if (next && prev) {
      dLat = next[0] - prev[0];
      dLon = next[1] - prev[1];
    } else if (next) {
      dLat = next[0] - curr[0];
      dLon = next[1] - curr[1];
    } else if (prev) {
      dLat = curr[0] - prev[0];
      dLon = curr[1] - prev[1];
    }

    const cosLat = Math.cos((curr[0] * Math.PI) / 180);
    const mPerDegLon = mPerDegLat * cosLat;

    const dy = dLat * mPerDegLat;
    const dx = dLon * mPerDegLon;
    const len = Math.hypot(dx, dy);

    if (len < 0.001) {
      result.push(curr);
      continue;
    }

    // Normal vector pointing 90 degrees to the right: (dy, -dx) / len
    const nx = dy / len;
    const ny = -dx / len;

    const offsetLat = (ny * offsetMeters) / mPerDegLat;
    const offsetLon = (nx * offsetMeters) / mPerDegLon;

    result.push([curr[0] + offsetLat, curr[1] + offsetLon]);
  }

  return result;
}
