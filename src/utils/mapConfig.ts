/**
 * mapConfig.ts - Shared Map & Basemap configurations
 */

export const CARTO_API_KEY = 'cb1_54rv_1_4440b43c9454a0eed99329cb';

export const CARTO_VOYAGER_URL = `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;
export const CARTO_VOYAGER_NOLABELS_URL = `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;
export const CARTO_VOYAGER_LABELS_URL = `https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`;

export const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TOPO_URL = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

export const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
