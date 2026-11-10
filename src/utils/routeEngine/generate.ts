import type { GPXRoute } from '../../types';
import { buildDirections, type BuildDirectionsOptions } from './engine';
import { toGeoJson, type DirectionsResult, type DirectionStep } from './formatter';

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

export async function generateFromParsed(parsed: Partial<GPXRoute>, filename: string, options: Partial<BuildDirectionsOptions>): Promise<RouteGenerationResult> {
  const pts: [number, number][] = parsed.points!.map((p) => [p.lat, p.lon]);
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