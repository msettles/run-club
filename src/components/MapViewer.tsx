import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GPXRoute } from '../types';
import { Download, Mountain, Navigation, Layers } from 'lucide-react';
import { downloadGPXFile } from '../utils/gpxParser';

interface MapViewerProps {
  route: GPXRoute;
  height?: string;
  showElevationProfile?: boolean;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  route,
  height = '420px',
  showElevationProfile = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeTileLayer, setActiveTileLayer] = useState<'osm' | 'topo'>('osm');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Initialize or update Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up previous instance if re-initializing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const firstPt = route.points[0] || { lat: 38.678, lon: -121.773 };
    const map = L.map(mapContainerRef.current, {
      center: [firstPt.lat, firstPt.lon],
      zoom: 13,
      scrollWheelZoom: false,
    });

    mapInstanceRef.current = map;

    // Tile layers (Free OpenStreetMap & OpenTopoMap - no API keys or credit card needed)
    const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const topoUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

    L.tileLayer(activeTileLayer === 'osm' ? osmUrl : topoUrl, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // If route has points, plot polyline and markers
    if (route.points && route.points.length > 0) {
      const latLngs: [number, number][] = route.points.map((p) => [p.lat, p.lon]);

      // Route Polyline
      const polyline = L.polyline(latLngs, {
        color: '#15803d',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      polylineRef.current = polyline;

      // Start Marker (Green icon)
      const startPt = latLngs[0];
      const startIcon = L.divIcon({
        className: 'custom-start-pin',
        html: `<div style="background-color:#16a34a;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;display:flex;align-items:center;gap:3px;">
          <span>🟢</span> START
        </div>`,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });
      L.marker(startPt, { icon: startIcon }).addTo(map);

      // Finish Marker (Checkered / Amber icon)
      const endPt = latLngs[latLngs.length - 1];
      const finishIcon = L.divIcon({
        className: 'custom-end-pin',
        html: `<div style="background-color:#d97706;color:white;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;display:flex;align-items:center;gap:3px;">
          <span>🏁</span> FINISH
        </div>`,
        iconSize: [64, 24],
        iconAnchor: [32, 12],
      });
      L.marker(endPt, { icon: finishIcon }).addTo(map);

      // Fit bounds with a comfortable padding
      map.fitBounds(polyline.getBounds(), { padding: [35, 35] });

      // Hover marker for elevation profile scrub
      const hoverMarker = L.circleMarker(startPt, {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#ea580c',
        fillOpacity: 1,
      });
      hoverMarkerRef.current = hoverMarker;
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [route, activeTileLayer]);

  // Update hover marker on map when user scrubs elevation chart
  useEffect(() => {
    if (!mapInstanceRef.current || !hoverMarkerRef.current) return;
    if (hoveredPointIndex !== null && route.points[hoveredPointIndex]) {
      const pt = route.points[hoveredPointIndex];
      hoverMarkerRef.current.setLatLng([pt.lat, pt.lon]);
      if (!mapInstanceRef.current.hasLayer(hoverMarkerRef.current)) {
        hoverMarkerRef.current.addTo(mapInstanceRef.current);
      }
    } else {
      if (mapInstanceRef.current.hasLayer(hoverMarkerRef.current)) {
        hoverMarkerRef.current.remove();
      }
    }
  }, [hoveredPointIndex, route.points]);

  // Render Elevation Profile on Canvas
  useEffect(() => {
    if (!showElevationProfile || !canvasRef.current || !route.points.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Filter elevations (meters to feet: m * 3.28084)
    const elevations = route.points.map((p) => (p.ele !== undefined ? p.ele * 3.28084 : 100));
    const minEle = Math.floor(Math.min(...elevations));
    const maxEle = Math.ceil(Math.max(...elevations));
    const eleRange = Math.max(maxEle - minEle, 20);

    const padLeft = 45;
    const padRight = 15;
    const padTop = 15;
    const padBottom = 25;
    const graphWidth = width - padLeft - padRight;
    const graphHeight = height - padTop - padBottom;

    // Draw background grid lines
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (graphHeight / 3) * i;
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);

      const val = Math.round(maxEle - (eleRange / 3) * i);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${val}ft`, padLeft - 6, y + 3);
    }
    ctx.stroke();

    // Draw elevation gradient fill
    const gradient = ctx.createLinearGradient(0, padTop, 0, height - padBottom);
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.45)');
    gradient.addColorStop(1, 'rgba(34, 197, 94, 0.02)');

    ctx.beginPath();
    elevations.forEach((ele, idx) => {
      const x = padLeft + (idx / (elevations.length - 1)) * graphWidth;
      const y = padTop + (1 - (ele - minEle) / eleRange) * graphHeight;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Close path for fill
    ctx.lineTo(padLeft + graphWidth, height - padBottom);
    ctx.lineTo(padLeft, height - padBottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line stroke
    ctx.beginPath();
    elevations.forEach((ele, idx) => {
      const x = padLeft + (idx / (elevations.length - 1)) * graphWidth;
      const y = padTop + (1 - (ele - minEle) / eleRange) * graphHeight;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw hover indicator line if scrubbing
    if (hoveredPointIndex !== null && hoveredPointIndex >= 0 && hoveredPointIndex < elevations.length) {
      const hX = padLeft + (hoveredPointIndex / (elevations.length - 1)) * graphWidth;
      const hY = padTop + (1 - (elevations[hoveredPointIndex] - minEle) / eleRange) * graphHeight;

      ctx.beginPath();
      ctx.moveTo(hX, padTop);
      ctx.lineTo(hX, height - padBottom);
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(hX, hY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ea580c';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [showElevationProfile, route.points, hoveredPointIndex]);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !route.points.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const padLeft = 45;
    const padRight = 15;
    const graphWidth = canvasRef.current.width - padLeft - padRight;

    const relX = Math.max(0, Math.min(graphWidth, x - padLeft));
    const ratio = relX / graphWidth;
    const idx = Math.min(route.points.length - 1, Math.round(ratio * (route.points.length - 1)));
    setHoveredPointIndex(idx);
  };

  const handleCanvasMouseLeave = () => {
    setHoveredPointIndex(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Route Header Info */}
      <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-stone-900">{route.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                route.surface === 'Trail'
                  ? 'bg-emerald-100 text-emerald-800'
                  : route.surface === 'Pavement'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {route.surface}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-stone-200 text-stone-700">
              {route.difficulty}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{route.description}</p>
        </div>

        {/* Quick stats & Actions */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-stone-700">
            <Navigation className="w-4 h-4 text-emerald-600" />
            <span>{route.distanceMiles} mi</span>
          </div>
          <div className="flex items-center gap-1.5 font-semibold text-stone-700">
            <Mountain className="w-4 h-4 text-amber-600" />
            <span>+{route.elevationGainFt} ft</span>
          </div>
          <button
            onClick={() => downloadGPXFile(route)}
            title="Download GPX file for Garmin/Apple/Strava"
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 hover:border-stone-400 font-medium transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>GPX</span>
          </button>
        </div>
      </div>

      {/* Map View */}
      <div className="relative">
        <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

        {/* Layer Toggle Floating Button */}
        <div className="absolute top-3 right-3 z-[400] flex gap-1 bg-white/90 backdrop-blur rounded-lg shadow-md border border-stone-200 p-1">
          <button
            onClick={() => setActiveTileLayer('osm')}
            className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1 ${
              activeTileLayer === 'osm'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Layers className="w-3 h-3" /> Standard
          </button>
          <button
            onClick={() => setActiveTileLayer('topo')}
            className={`px-2 py-1 text-xs rounded font-medium flex items-center gap-1 ${
              activeTileLayer === 'topo'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Mountain className="w-3 h-3" /> Topo
          </button>
        </div>

        {/* Free OpenStreetMap Attribution notice */}
        <div className="absolute bottom-1 left-2 z-[400] text-[10px] bg-white/80 backdrop-blur px-2 py-0.5 rounded text-stone-600">
          🗺️ Free OpenStreetMap • 100% Zero-Credit-Card
        </div>
      </div>

      {/* Interactive Elevation Profile */}
      {showElevationProfile && route.points.length > 0 && (
        <div className="p-3 bg-white border-t border-stone-100">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1 px-1">
            <span className="font-medium text-stone-700 flex items-center gap-1">
              <Mountain className="w-3.5 h-3.5 text-emerald-600" /> Elevation Profile
            </span>
            {hoveredPointIndex !== null && route.points[hoveredPointIndex] ? (
              <span className="text-orange-600 font-semibold">
                Elevation: {Math.round((route.points[hoveredPointIndex].ele || 0) * 3.28084)} ft
              </span>
            ) : (
              <span>Hover chart to trace route on map</span>
            )}
          </div>
          <canvas
            ref={canvasRef}
            width={720}
            height={110}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            className="w-full h-24 cursor-crosshair rounded bg-stone-50/50"
          />
        </div>
      )}
    </div>
  );
};
