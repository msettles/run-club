import type { GPXPoint } from '../types';

/** Web Mercator viewport shared by map tiles and the saved route line. */
export function socialMapViewport(points: GPXPoint[], width: number, height: number) {
  if (points.length < 2 || points.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon) || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180)) throw new Error('The route has no usable map geometry.');
  const projected = points.map((p) => {
    const lat = Math.max(-85.05112878, Math.min(85.05112878, p.lat)) * Math.PI / 180;
    return [(p.lon + 180) / 360, (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2];
  });
  const xs = projected.map((p) => p[0]); const ys = projected.map((p) => p[1]);
  const bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  if (bounds.maxX === bounds.minX && bounds.maxY === bounds.minY) throw new Error('The route has no usable map geometry.');
  const zoom = Math.max(0, Math.min(16, Math.floor(Math.log2(Math.min((width - 120) / (256 * Math.max(bounds.maxX - bounds.minX, 1e-9)), (height - 120) / (256 * Math.max(bounds.maxY - bounds.minY, 1e-9)))))));
  const scale = 256 * 2 ** zoom;
  const left = (bounds.minX + bounds.maxX) / 2 * scale - width / 2;
  const top = (bounds.minY + bounds.maxY) / 2 * scale - height / 2;
  const line = projected.map(([x, y]) => [x * scale - left, y * scale - top]);
  const tiles: { x: number; y: number; left: number; top: number }[] = [];
  for (let y = Math.floor(top / 256); y <= Math.floor((top + height - 1) / 256); y++) {
    for (let x = Math.floor(left / 256); x <= Math.floor((left + width - 1) / 256); x++) {
      if (y < 0 || y >= 2 ** zoom) continue;
      tiles.push({ x: ((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom, y, left: x * 256 - left, top: y * 256 - top });
    }
  }
  return { zoom, line, tiles };
}
