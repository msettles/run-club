import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { GPXRoute } from '../types';
import { Download, Mountain, Navigation, Layers, Compass, Locate, Edit3 } from 'lucide-react';
import { downloadGPXFile } from '../utils/gpxParser';

interface MapViewerProps {
  route: GPXRoute;
  height?: string;
  showElevationProfile?: boolean;
  onEditRoute?: (route: GPXRoute) => void;
  canEdit?: boolean;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  route,
  height = '420px',
  showElevationProfile = true,
  onEditRoute,
  canEdit = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null);
  const turnMarkersGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocationMarkerRef = useRef<L.CircleMarker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeTileLayer, setActiveTileLayer] = useState<'osm' | 'topo'>('osm');
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null);
  const [directionsMode, setDirectionsMode] = useState<'concise' | 'verbose'>('concise');
  const [isTrackingLocation, setIsTrackingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Initialize or update Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const firstPt = route.points[0] || { lat: 38.6781, lon: -121.7712 };
    const map = L.map(mapContainerRef.current, {
      center: [firstPt.lat, firstPt.lon],
      zoom: 14,
      scrollWheelZoom: false,
    });

    mapInstanceRef.current = map;

    // Tile layers (Free OpenStreetMap & OpenTopoMap)
    const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const topoUrl = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

    L.tileLayer(activeTileLayer === 'osm' ? osmUrl : topoUrl, {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    turnMarkersGroupRef.current = L.layerGroup().addTo(map);

    // If route has points, plot polyline and markers
    if (route.points && route.points.length > 0) {
      const latLngs: [number, number][] = route.points.map((p) => [p.lat, p.lon]);

      // Route Polyline
      const polyline = L.polyline(latLngs, {
        color: '#1a607c',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      polylineRef.current = polyline;

      // Start Marker at Blue Note Brewing
      const startPt = latLngs[0];
      const startIcon = L.divIcon({
        className: 'custom-start-pin',
        html: `<div style="background-color:#1a607c;color:white;padding:3px 7px;border-radius:12px;font-size:10px;font-weight:900;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;gap:3px;white-space:nowrap;">
          <span>🍺</span> Blue Note (Start)
        </div>`,
        iconSize: [110, 24],
        iconAnchor: [55, 12],
      });
      L.marker(startPt, { icon: startIcon }).addTo(map);

      // Finish Marker
      const endPt = latLngs[latLngs.length - 1];
      const finishIcon = L.divIcon({
        className: 'custom-end-pin',
        html: `<div style="background-color:#de9c1e;color:#0d1113;padding:3px 7px;border-radius:12px;font-size:10px;font-weight:900;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;gap:3px;white-space:nowrap;">
          <span>🏁</span> FINISH
        </div>`,
        iconSize: [64, 24],
        iconAnchor: [32, 12],
      });
      L.marker(endPt, { icon: finishIcon }).addTo(map);

      // Numbered Turn Pins (if route has directions)
      if (route.directions && route.directions.length > 0) {
        route.directions.forEach((step, idx) => {
          if (!step.point) return;
          const [lon, lat] = step.point;
          const isSelected = selectedTurnIndex === idx;

          const turnIcon = L.divIcon({
            className: 'custom-turn-pin',
            html: `<div style="background-color:${isSelected ? '#de9c1e' : '#1a607c'};color:${isSelected ? '#000' : '#fff'};width:${isSelected ? '24px' : '18px'};height:${isSelected ? '24px' : '18px'};border-radius:50%;font-size:${isSelected ? '11px' : '9px'};font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);cursor:pointer;transition:all 0.2s;">
              ${step.step}
            </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const marker = L.marker([lat, lon], { icon: turnIcon });
          marker.on('click', () => {
            setSelectedTurnIndex(idx);
          });
          marker.bindTooltip(`<b>#${step.step}</b> ${step.instruction_concise}`, { direction: 'top', offset: [0, -10] });
          turnMarkersGroupRef.current?.addLayer(marker);
        });
      }

      // Fit bounds
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
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [route, activeTileLayer, selectedTurnIndex]);

  // Handle GPS "Show My Location" toggle
  const toggleLocationTracking = () => {
    if (isTrackingLocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.remove();
        userAccuracyCircleRef.current = null;
      }
      setIsTrackingLocation(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsTrackingLocation(true);
    setLocationError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!mapInstanceRef.current) return;
        const map = mapInstanceRef.current;

        if (!userLocationMarkerRef.current) {
          userLocationMarkerRef.current = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#ffffff',
            weight: 3,
            fillColor: '#2563eb',
            fillOpacity: 1,
          }).addTo(map);

          userAccuracyCircleRef.current = L.circle([latitude, longitude], {
            radius: accuracy,
            color: '#3b82f6',
            weight: 1,
            fillColor: '#93c5fd',
            fillOpacity: 0.25,
          }).addTo(map);

          map.setView([latitude, longitude], 16, { animate: true });
        } else {
          userLocationMarkerRef.current.setLatLng([latitude, longitude]);
          userAccuracyCircleRef.current?.setLatLng([latitude, longitude]);
          userAccuracyCircleRef.current?.setRadius(accuracy);
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationError('Unable to retrieve GPS location.');
        setIsTrackingLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  // Zoom to step on card tap
  const handleSelectTurn = (index: number) => {
    setSelectedTurnIndex(index);
    if (!mapInstanceRef.current || !route.directions?.[index]?.point) return;
    const [lon, lat] = route.directions[index].point;
    mapInstanceRef.current.setView([lat, lon], 17, { animate: true });
  };

  // Canvas Elevation Profile
  useEffect(() => {
    if (!showElevationProfile || !canvasRef.current || !route.points.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const elevations = route.points.map((p) => (p.ele || 0) * 3.28084); // ft
    const minEle = Math.min(...elevations);
    const maxEle = Math.max(...elevations);
    const eleRange = Math.max(maxEle - minEle, 20); // minimum 20ft scale

    ctx.beginPath();
    ctx.moveTo(0, height);

    for (let i = 0; i < elevations.length; i++) {
      const x = (i / (elevations.length - 1)) * width;
      const normalizedEle = (elevations[i] - minEle) / eleRange;
      const y = height - normalizedEle * (height - 20) - 10;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(width, height);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(26, 96, 124, 0.4)');
    gradient.addColorStop(1, 'rgba(26, 96, 124, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < elevations.length; i++) {
      const x = (i / (elevations.length - 1)) * width;
      const normalizedEle = (elevations[i] - minEle) / eleRange;
      const y = height - normalizedEle * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#1a607c';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [route, showElevationProfile]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden space-y-0">
      {/* Route Header & Metrics */}
      <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-stone-900 font-display">{route.name}</h3>
            <span className="px-2 py-0.5 bg-stone-200 text-stone-800 rounded-full text-[10px] font-bold">
              {route.targetDistanceTier === 'custom' && route.customDistanceLabel
                ? route.customDistanceLabel
                : `${route.targetDistanceTier || Math.round(route.distanceMiles)} Mi Tier`}
            </span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold">
              {route.surface}
            </span>
          </div>
          {route.notes && (
            <p className="text-xs text-stone-500 mt-1 max-w-xl leading-relaxed">
              <strong>Notes:</strong> {route.notes}
            </p>
          )}
        </div>

        {/* Action Controls & External Links */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-xs text-woodland-900 bg-woodland-50 border border-woodland-200 px-2.5 py-1.5 rounded-xl">
            <Navigation className="w-3.5 h-3.5 text-woodland-600" />
            <span>{route.distanceMiles} mi</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl">
            <Mountain className="w-3.5 h-3.5 text-amber-600" />
            <span>+{route.elevationGainFt} ft</span>
          </div>

          {canEdit && onEditRoute && (
            <button
              onClick={() => onEditRoute(route)}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-300" />
              <span>Edit Route</span>
            </button>
          )}
        </div>
      </div>

      {/* External Resource Action Bar (Strava, Garmin, RunGo, GPX) */}
      <div className="px-4 py-2 bg-stone-100/70 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Apps:
          </span>

          {route.externalLinks?.stravaUrl && (
            <a
              href={route.externalLinks.stravaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold rounded-lg border border-orange-300 transition shadow-2xs"
            >
              <span>🟠</span> Strava
            </a>
          )}

          {route.externalLinks?.garminUrl && (
            <a
              href={route.externalLinks.garminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 font-bold rounded-lg border border-cyan-300 transition shadow-2xs"
            >
              <span>🔵</span> Garmin
            </a>
          )}

          {route.externalLinks?.rungoUrl && (
            <a
              href={route.externalLinks.rungoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold rounded-lg border border-emerald-300 transition shadow-2xs"
            >
              <span>🟢</span> RunGo Nav
            </a>
          )}

          <button
            onClick={() => downloadGPXFile(route)}
            title="Download GPX file for watches and phones"
            className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-stone-50 text-stone-700 font-bold rounded-lg border border-stone-300 transition shadow-2xs"
          >
            <Download className="w-3 h-3 text-stone-500" />
            <span>Download GPX</span>
          </button>
        </div>

        {/* GPS Live Tracking Button */}
        <button
          onClick={toggleLocationTracking}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs ${
            isTrackingLocation
              ? 'bg-blue-600 text-white'
              : 'bg-white text-stone-700 border border-stone-300 hover:bg-stone-50'
          }`}
        >
          <Locate className={`w-3.5 h-3.5 ${isTrackingLocation ? 'animate-spin' : ''}`} />
          <span>{isTrackingLocation ? 'Tracking Location' : 'Show My Location'}</span>
        </button>
      </div>

      {locationError && (
        <div className="px-4 py-1.5 bg-red-50 text-red-700 text-xs border-b border-red-200">
          {locationError}
        </div>
      )}

      {/* Map View */}
      <div className="relative">
        <div ref={mapContainerRef} style={{ height }} className="w-full z-0" />

        {/* Layer Toggle Floating Button */}
        <div className="absolute top-3 right-3 z-[400] flex gap-1 bg-white/95 backdrop-blur-xs rounded-xl shadow-md border border-stone-200 p-1">
          <button
            onClick={() => setActiveTileLayer('osm')}
            className={`px-2.5 py-1 text-xs rounded-lg font-bold flex items-center gap-1 ${
              activeTileLayer === 'osm'
                ? 'bg-woodland-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Layers className="w-3 h-3" /> Standard
          </button>
          <button
            onClick={() => setActiveTileLayer('topo')}
            className={`px-2.5 py-1 text-xs rounded-lg font-bold flex items-center gap-1 ${
              activeTileLayer === 'topo'
                ? 'bg-woodland-700 text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Mountain className="w-3 h-3" /> Topo
          </button>
        </div>

        {/* Free Attribution notice */}
        <div className="absolute bottom-1 left-2 z-[400] text-[10px] bg-white/80 backdrop-blur-xs px-2 py-0.5 rounded text-stone-600">
          🗺️ Free OpenStreetMap • All runs start &amp; end at Blue Note Brewing
        </div>
      </div>

      {/* Elevation Profile */}
      {showElevationProfile && route.points.length > 0 && (
        <div className="p-3 bg-white border-t border-stone-200">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1 px-1">
            <span className="font-bold text-stone-700 flex items-center gap-1">
              <Mountain className="w-3.5 h-3.5 text-woodland-600" /> Elevation Profile
            </span>
            <span>+{route.elevationGainFt} ft gain</span>
          </div>
          <canvas ref={canvasRef} width={720} height={80} className="w-full h-20 rounded bg-stone-50/50" />
        </div>
      )}

      {/* TURN-BY-TURN CUE SHEET SECTION */}
      {route.directions && route.directions.length > 0 && (
        <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-woodland-600" />
              <h4 className="font-extrabold text-sm text-stone-900 font-display">
                Turn-by-Turn Directions ({route.directions.length} turns)
              </h4>
            </div>

            {/* Concise / Verbose Mode Toggle */}
            <div className="bg-stone-200 p-0.5 rounded-xl flex items-center text-xs font-bold">
              <button
                onClick={() => setDirectionsMode('concise')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  directionsMode === 'concise' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                📱 Concise
              </button>
              <button
                onClick={() => setDirectionsMode('verbose')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  directionsMode === 'verbose' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                📖 Narrative
              </button>
            </div>
          </div>

          {/* Steps Grid / List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {route.directions.map((step, idx) => {
              const isSelected = selectedTurnIndex === idx;
              return (
                <div
                  key={step.step}
                  onClick={() => handleSelectTurn(idx)}
                  className={`p-2.5 rounded-xl border text-xs transition cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/30'
                      : 'bg-white border-stone-200 hover:border-woodland-300'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-woodland-800 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    {step.step}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-extrabold text-stone-900 truncate">
                        {directionsMode === 'concise' ? step.instruction_concise : step.instruction}
                      </span>
                      <span className="font-mono text-[10px] text-stone-500 font-bold shrink-0">
                        {step.distance}
                      </span>
                    </div>
                    {step.customNotes && (
                      <div className="text-[10px] text-amber-800 font-semibold mt-0.5">
                        ⚠️ {step.customNotes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
