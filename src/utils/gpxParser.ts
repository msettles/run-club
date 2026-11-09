import { GPXPoint, GPXRoute, SurfaceType, DifficultyType } from '../types';

/**
 * Calculates Haversine distance between two coordinates in miles
 */
export function calculateHaversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Parse raw GPX XML string into structured GPXRoute data
 */
export function parseGPX(xmlString: string, filename: string): Partial<GPXRoute> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Invalid GPX XML file format.');
  }

  // Extract track name or fallback to filename
  const nameNode = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('name');
  const routeName = nameNode?.textContent?.trim() || filename.replace(/\.gpx$/i, '');

  const descNode = xmlDoc.querySelector('trk > desc') || xmlDoc.querySelector('desc');
  const routeDesc = descNode?.textContent?.trim() || 'Uploaded GPX route';

  // Extract track points: trkpt or rtept
  let pointNodes = Array.from(xmlDoc.getElementsByTagName('trkpt'));
  if (pointNodes.length === 0) {
    pointNodes = Array.from(xmlDoc.getElementsByTagName('rtept'));
  }

  if (pointNodes.length === 0) {
    throw new Error('No track points (<trkpt> or <rtept>) found in GPX file.');
  }

  const points: GPXPoint[] = [];
  let totalDistanceMiles = 0;
  let totalElevationGainMeters = 0;
  let previousElevation: number | null = null;

  for (let i = 0; i < pointNodes.length; i++) {
    const node = pointNodes[i];
    const latStr = node.getAttribute('lat');
    const lonStr = node.getAttribute('lon');

    if (!latStr || !lonStr) continue;

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    const eleNode = node.querySelector('ele');
    const ele = eleNode && eleNode.textContent ? parseFloat(eleNode.textContent) : undefined;

    const timeNode = node.querySelector('time');
    const time = timeNode?.textContent || undefined;

    points.push({ lat, lon, ele, time });

    // Distance calculation
    if (points.length > 1) {
      const prev = points[points.length - 2];
      const segmentDistance = calculateHaversineMiles(prev.lat, prev.lon, lat, lon);
      totalDistanceMiles += segmentDistance;
    }

    // Elevation gain calculation (threshold of 1m to filter GPS noise)
    if (ele !== undefined) {
      if (previousElevation !== null) {
        const diff = ele - previousElevation;
        if (diff > 1.0) {
          totalElevationGainMeters += diff;
        }
      }
      previousElevation = ele;
    }
  }

  const elevationGainFt = Math.round(totalElevationGainMeters * 3.28084);
  const roundedDistance = Math.round(totalDistanceMiles * 100) / 100;

  let difficulty: DifficultyType = 'Easy';
  if (roundedDistance > 7 || elevationGainFt > 600) {
    difficulty = 'Challenging';
  } else if (roundedDistance > 4 || elevationGainFt > 200) {
    difficulty = 'Moderate';
  }

  const surface: SurfaceType = 'Trail';

  return {
    name: routeName,
    description: routeDesc,
    distanceMiles: roundedDistance,
    elevationGainFt,
    points,
    surface,
    difficulty,
    gpxXml: xmlString,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate standard GPX XML string from a GPXRoute
 */
export function exportToGPXString(route: GPXRoute): string {
  const pointsXml = route.points
    .map(
      (p) =>
        `      <trkpt lat="${p.lat}" lon="${p.lon}">${
          p.ele !== undefined ? `\n        <ele>${p.ele}</ele>` : ''
        }${p.time ? `\n        <time>${p.time}</time>` : ''}\n      </trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Woodland Woodchuckers Run Club - https://github.com/woodland_woodchuckers"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(route.name)}</name>
    <desc>${escapeXml(route.description)}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(route.name)}</name>
    <desc>${escapeXml(route.description)}</desc>
    <trkseg>
${pointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Trigger browser file download of GPX
 */
export function downloadGPXFile(route: GPXRoute) {
  const xmlContent = route.gpxXml || exportToGPXString(route);
  const blob = new Blob([xmlContent], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${route.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.gpx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
