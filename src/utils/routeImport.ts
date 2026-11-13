import type { GPXRoute, RouteExternalLinks } from '../types';
import { parseCsv, toIsoDate } from './legacy';
import { parseGPX } from './gpxParser';

export const ROUTE_IMPORT_COLUMNS = ['Run name', 'Collection name', 'Date created', 'Loop', 'GPX path', 'Garmin Link', 'RunGo Link', 'Strava Link'];
export interface ImportGpxFile { name: string; text(): Promise<string> }
export interface RouteImportEntry {
  row: number;
  id: string;
  path: string;
  xml: string;
  route: Omit<GPXRoute, 'id'>;
}
export interface RouteImportPlan { entries: RouteImportEntry[]; errors: string[] }

/** Stable across file renames and retries; never inferred from a display name. */
export function importedRouteId(garminUrl: string): string {
  const url = new URL(garminUrl);
  const course = url.pathname.match(/\/(?:app|modern)\/course\/(\d+)\/?$/);
  if (!['connect.garmin.com', 'www.connect.garmin.com'].includes(url.hostname) || !course || url.protocol !== 'https:') {
    throw new Error('Garmin Link must be an HTTPS Garmin course URL.');
  }
  return `route-garmin-${course[1]}`;
}

function externalLink(value: string, host: string, label: string): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || ![host, `www.${host}`].includes(url.hostname) || url.username || url.password) {
    throw new Error(`${label} must be an HTTPS link to ${host}.`);
  }
  return value;
}

/** Read and validate every row before any library writes. File paths match by basename. */
export async function planRouteImport(csv: string, files: ImportGpxFile[]): Promise<RouteImportPlan> {
  const rows = parseCsv(csv);
  const errors: string[] = [];
  const entries: RouteImportEntry[] = [];
  if (!rows.length) return { entries, errors: ['The CSV contains no routes.'] };
  const missing = ROUTE_IMPORT_COLUMNS.filter((column) => !(column in rows[0]));
  if (missing.length) return { entries, errors: [`Missing CSV columns: ${missing.join(', ')}.`] };
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    try {
      const name = row['Run name'];
      const collectionName = row['Collection name'];
      if (!name || name.length > 150 || !collectionName || collectionName.length > 150) throw new Error('Run and collection names are required (at most 150 characters).');
      const day = toIsoDate(row['Date created']);
      if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error('Date created must be a valid M/D/YY or YYYY-MM-DD date.');
      const loop = row.Loop.toLowerCase();
      if (!['', 'loop', 'yes', 'true', '1', 'no', 'false', '0'].includes(loop)) throw new Error('Loop must be blank, loop, yes/no, or true/false.');
      const id = importedRouteId(row['Garmin Link']);
      if (seen.has(id)) throw new Error('This Garmin course appears more than once in the CSV.');
      seen.add(id);
      const filename = row['GPX path'].replace(/\\/g, '/').split('/').pop();
      if (!filename || !filename.toLowerCase().endsWith('.gpx')) throw new Error('GPX path must name a .gpx file.');
      const matches = files.filter((file) => file.name === filename);
      if (matches.length !== 1) throw new Error(`${filename}: ${matches.length ? 'multiple files have this name' : 'select this GPX file'}.`);
      if (/^COURSE_\d+\.gpx$/i.test(filename) && filename.slice(7, -4) !== id.slice('route-garmin-'.length)) throw new Error('GPX filename does not match the Garmin course ID.');
      const xml = await matches[0].text();
      const parsed = parseGPX(xml, filename);
      if (!parsed.points || parsed.points.length < 2 || !parsed.distanceMiles || parsed.distanceMiles > 500 || (parsed.elevationGainFt || 0) > 50000) throw new Error('GPX must contain at least two points and a measured distance within 0–500 miles and elevation gain within 50,000 ft.');
      const externalLinks: RouteExternalLinks = { garminUrl: row['Garmin Link'] };
      const strava = externalLink(row['Strava Link'], 'strava.com', 'Strava Link');
      const rungo = externalLink(row['RunGo Link'], 'routes.rungoapp.com', 'RunGo Link');
      if (strava) externalLinks.stravaUrl = strava;
      if (rungo) externalLinks.rungoUrl = rungo;
      entries.push({ row: index + 2, id, path: row['GPX path'], xml, route: {
        name, collectionName, description: '', createdAt: `${day}T00:00:00.000Z`,
        isLoop: ['loop', 'yes', 'true', '1'].includes(loop),
        points: parsed.points, distanceMiles: parsed.distanceMiles,
        elevationGainFt: parsed.elevationGainFt || 0, surface: 'Pavement',
        difficulty: parsed.difficulty || 'Easy', externalLinks,
      } });
    } catch (error) {
      errors.push(`Row ${index + 2} (${row['Run name'] || 'unnamed'}): ${error instanceof Error ? error.message : 'Could not read route.'}`);
    }
  }
  return { entries, errors };
}
