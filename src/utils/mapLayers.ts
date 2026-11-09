/**
 * Shared Leaflet drawing for route maps (MapViewer and Route Studio):
 * base tiles with street labels above the route, the route line, start/finish
 * pins and numbered turn pins.
 */
import L from 'leaflet';
import type { GPXPoint } from '../types';
import { offsetPolylineCoords } from './routeEngine/geometry';
import { CARTO_VOYAGER_LABELS_URL, MAP_ATTRIBUTION } from './mapConfig';

/** Base tiles plus a street-label layer in its own pane above the route line. Returns the base layer. */
export function addBaseLayers(map: L.Map, basemapUrl: string): L.TileLayer {
  const base = L.tileLayer(basemapUrl, { maxZoom: 19, attribution: MAP_ATTRIBUTION }).addTo(map);
  map.createPane('streetLabelsPane');
  const labelsPane = map.getPane('streetLabelsPane');
  if (labelsPane) {
    labelsPane.style.zIndex = '450';
    labelsPane.style.pointerEvents = 'none';
  }
  L.tileLayer(CARTO_VOYAGER_LABELS_URL, { pane: 'streetLabelsPane', maxZoom: 19 }).addTo(map);
  return base;
}

const pinHtml = (background: string, color: string, content: string) =>
  `<div style="background:${background};color:${color};padding:3px 7px;border-radius:12px;font-size:10px;font-weight:900;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;gap:3px;white-space:nowrap;">${content}</div>`;

const pin = (latLng: L.LatLngExpression, className: string, html: string, width: number) =>
  L.marker(latLng, {
    icon: L.divIcon({ className, html, iconSize: [width, 24], iconAnchor: [width / 2, 12] }),
    zIndexOffset: 500,
  });

/**
 * Draw the route line (offset 3.5 m to the right so centre-line street names stay
 * readable) and its start/finish pins into `layer`. Returns the line, or null for no points.
 */
export function drawRoute(layer: L.LayerGroup, points: GPXPoint[]): L.Polyline | null {
  if (!points.length) return null;
  const latLngs: [number, number][] = points.map((p) => [p.lat, p.lon]);
  const line = L.polyline(offsetPolylineCoords(latLngs, 3.5), {
    color: '#1a607c',
    weight: 4,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(layer);

  const start = latLngs[0];
  const end = latLngs[latLngs.length - 1];
  // Start and finish within ~60 m (typical of Blue Note loops): one combined pin.
  if (Math.hypot(start[0] - end[0], start[1] - end[1]) < 0.0006) {
    pin(start, 'custom-start-finish-pin', pinHtml('linear-gradient(135deg, #1a607c 0%, #13495d 100%)', 'white', '<span>🍺</span> Blue Note (Start/End) <span>🏁</span>'), 160).addTo(layer);
  } else {
    pin(start, 'custom-start-pin', pinHtml('#1a607c', 'white', '<span>🍺</span> Blue Note (Start)'), 120).addTo(layer);
    pin(end, 'custom-end-pin', pinHtml('#de9c1e', '#0d1113', '<span>🏁</span> FINISH'), 64).addTo(layer);
  }
  return line;
}

/** What a turn pin needs from a direction step (route steps and engine steps both fit). */
type TurnStep = { step: number; instruction_concise: string; point?: [number, number] };

/** Numbered turn pins (the selected one highlighted) into `layer`, replacing what was there. */
export function drawTurnPins(
  layer: L.LayerGroup,
  directions: TurnStep[] | undefined,
  selectedIndex: number | null,
  onSelect: (index: number) => void,
  size: { normal: number; selected: number } = { normal: 18, selected: 24 }
): void {
  layer.clearLayers();
  (directions || []).forEach((step, idx) => {
    if (!step.point) return;
    const [lon, lat] = step.point;
    const selected = selectedIndex === idx;
    const px = selected ? size.selected : size.normal;
    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: 'custom-turn-pin',
        html: `<div style="background-color:${selected ? '#de9c1e' : '#1a607c'};color:${selected ? '#000' : '#fff'};width:${px}px;height:${px}px;border-radius:50%;font-size:${selected ? 11 : 9}px;font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;">${step.step}</div>`,
        iconSize: [size.selected, size.selected],
        iconAnchor: [size.selected / 2, size.selected / 2],
      }),
      zIndexOffset: selected ? 400 : 0,
    });
    marker.on('click', () => onSelect(idx));
    marker.bindTooltip(`<b>#${step.step}</b> ${step.instruction_concise}`, { direction: 'top', offset: [0, -10] });
    layer.addLayer(marker);
  });
}
