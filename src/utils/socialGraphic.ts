import type { GPXRoute, RunEvent } from '../types';
import { MAX_SOCIAL_ROUTES, socialRouteIds, socialRunDate, type SocialPostImage } from './socialPost';
import { socialMapViewport } from './socialMap';

// Only tiles visible in the reviewed image are requested. Browser caching/referrer defaults are preserved.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
function tileImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => { img.src = ''; reject(new Error('Map tiles timed out. Check your connection and retry the route images.')); }, 20000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Map tiles could not load. Check your connection and retry the route images.')); };
    img.src = url;
  });
}

async function routeGraphic(run: RunEvent, route: GPXRoute, tileCache: Map<string, Promise<HTMLImageElement>>): Promise<SocialPostImage> {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not create the route images.');
  ctx.fillStyle = '#1a607c'; ctx.fillRect(0, 0, 1080, 1080);
  const text = (value: string, y: number, size: number, color = '#faf2ee') => {
    ctx.font = `bold ${size}px sans-serif`; ctx.fillStyle = color;
    let shown = value;
    while (shown.length > 1 && ctx.measureText(shown).width > 984) shown = shown.slice(0, -1);
    ctx.fillText(shown === value ? value : `${shown.slice(0, -1)}…`, 48, y);
  };
  text('WOODLAND WOODCHUCKERS', 58, 26, '#de9c1e');
  text(run.title, 117, 42);
  const label = run.routeChoices?.find((choice) => choice.routeId === route.id)?.customLabel || route.name;
  text(`${label} · ${route.distanceMiles.toFixed(2)} miles`, 165, 34);
  const map = { x: 48, y: 198, width: 984, height: 670 };
  const viewport = socialMapViewport(route.points, map.width, map.height);
  // Render within a clipped map window so tile edges and route labels cannot cover event details.
  ctx.save(); ctx.beginPath(); ctx.rect(map.x, map.y, map.width, map.height); ctx.clip();
  ctx.fillStyle = '#e9e4d8'; ctx.fillRect(map.x, map.y, map.width, map.height);
  const tileImages = await Promise.all(viewport.tiles.map(async (tile) => {
    const url = TILE_URL.replace('{z}', String(viewport.zoom)).replace('{x}', String(tile.x)).replace('{y}', String(tile.y));
    if (!tileCache.has(url)) tileCache.set(url, tileImage(url));
    const img = await tileCache.get(url)!;
    return { tile, img };
  }));
  for (const { tile, img } of tileImages) ctx.drawImage(img, map.x + tile.left, map.y + tile.top, 256, 256);
  ctx.beginPath();
  viewport.line.forEach(([x, y], index) => { if (index === 0) ctx.moveTo(map.x + x, map.y + y); else ctx.lineTo(map.x + x, map.y + y); });
  ctx.lineJoin = ctx.lineCap = 'round'; ctx.strokeStyle = 'white'; ctx.lineWidth = 16; ctx.stroke();
  ctx.strokeStyle = '#1a607c'; ctx.lineWidth = 9; ctx.stroke();
  const mark = (point: number[], label: string, color: string, offset: number) => {
    const x = map.x + point[0]; const y = map.y + point[1];
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = 'white'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = 'bold 23px sans-serif'; ctx.lineWidth = 5; ctx.strokeText(label, x + 17, y + offset); ctx.fillStyle = '#0d1113'; ctx.fillText(label, x + 17, y + offset);
  };
  mark(viewport.line[0], 'START', '#1a607c', -10);
  mark(viewport.line[viewport.line.length - 1], 'FINISH', '#de9c1e', 23);
  ctx.font = '22px sans-serif';
  const attribution = '© OpenStreetMap contributors · openstreetmap.org/copyright';
  const attributionWidth = ctx.measureText(attribution).width;
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(map.x + map.width - attributionWidth - 16, map.y + map.height - 34, attributionWidth + 16, 34);
  ctx.fillStyle = '#111'; ctx.fillText(attribution, map.x + map.width - attributionWidth - 8, map.y + map.height - 10);
  ctx.restore();
  text(socialRunDate(run.date), 924, 32, '#de9c1e');
  text(`${run.time} · ${run.locationName}`, 969, 30);
  text('FREE TO JOIN · ALL PACES WELCOME', 1030, 25);
  const image = canvas.toDataURL('image/jpeg', 0.85);
  if (image.length > 800000) throw new Error('A route image is too large to publish.');
  return { routeId: route.id, name: label, image };
}

/** One reviewed image per distinct saved route, in the run's configured order. Never omit an unavailable route. */
export async function runPostGraphics(run: RunEvent, loadRoute: (id: string) => Promise<GPXRoute>): Promise<SocialPostImage[]> {
  const ids = socialRouteIds(run);
  if (!ids.length) throw new Error('This run has no attached routes to include in the post.');
  if (ids.length > MAX_SOCIAL_ROUTES) throw new Error(`A social post supports at most ${MAX_SOCIAL_ROUTES} route images.`);
  const cache = new Map<string, Promise<HTMLImageElement>>();
  const images: SocialPostImage[] = [];
  for (const id of ids) {
    const route = await loadRoute(id);
    if (route.id !== id || !Number.isFinite(route.distanceMiles)) throw new Error('A route could not be loaded. Please retry.');
    images.push(await routeGraphic(run, route, cache));
  }
  return images;
}
