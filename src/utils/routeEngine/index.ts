/**
 * Route Engine Index - Complete in-browser routing and turn-by-turn directions pipeline
 */

import { parseGPX } from '../gpxParser';
import { buildDirections, BuildDirectionsOptions } from './engine';
import { toGeoJson, DirectionsResult, DirectionStep } from './formatter';

export * from './geometry';
export * from './osm';
export * from './formatter';
export * from './engine';

export interface RouteGenerationResult {
  name: string;
  distanceMiles: number;
  elevationGainFt: number;
  directions: DirectionStep[];
  geoJson: any; // GeoJSON FeatureCollection
  summary: {
    totalDisplay: string;
    totalMeters: number;
    isLoop: boolean;
    stepCount: number;
    finishDisplay: string;
  };
}

/**
 * High-level helper: Parses GPX XML string, queries OSM in-browser, and returns full directions + GeoJSON
 */
export async function generateRouteDirectionsFromGpx(
  gpxXmlString: string,
  filename = 'course.gpx',
  options: Partial<BuildDirectionsOptions> = {}
): Promise<RouteGenerationResult> {
  const parsed = parseGPX(gpxXmlString, filename);
  if (!parsed.points || parsed.points.length < 2) {
    throw new Error('GPX file does not contain enough track points.');
  }

  const pts: [number, number][] = parsed.points.map((p) => [p.lat, p.lon]);
  const routeName = options.name || parsed.name || filename.replace(/\.gpx$/i, '');

  const directionsResult: DirectionsResult = await buildDirections(pts, {
    ...options,
    name: routeName,
    units: options.units || 'mi',
  });

  const geoJson = toGeoJson(directionsResult);

  return {
    name: routeName,
    distanceMiles: parsed.distanceMiles || Math.round((directionsResult.total_m / 1609.344) * 100) / 100,
    elevationGainFt: parsed.elevationGainFt || 0,
    directions: directionsResult.steps,
    geoJson,
    summary: {
      totalDisplay: directionsResult.total,
      totalMeters: directionsResult.total_m,
      isLoop: directionsResult.loop,
      stepCount: directionsResult.steps.length,
      finishDisplay: directionsResult.finish,
    },
  };
}
