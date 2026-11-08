import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  UploadCloud,
  Navigation,
  ExternalLink,
  Save,
  Check,
  X,
  Plus,
  Trash2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { GPXRoute, SurfaceType, DifficultyType, RouteTurnStep, RouteExternalLinks } from '../types';
import { generateRouteDirectionsFromGpx } from '../utils/routeEngine';
import { parseGPX } from '../utils/gpxParser';

interface RouteStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingRoute?: GPXRoute | null;
  onSaveRoute: (routeData: Omit<GPXRoute, 'id'>, existingId?: string) => Promise<void>;
  onDeleteRoute?: (routeId: string) => Promise<void>;
}

export const RouteStudioModal: React.FC<RouteStudioModalProps> = ({
  isOpen,
  onClose,
  existingRoute,
  onSaveRoute,
  onDeleteRoute,
}) => {
  // Form fields
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [surface, setSurface] = useState<SurfaceType>('Pavement');
  const [difficulty, setDifficulty] = useState<DifficultyType>('Easy');
  const [distanceTier, setDistanceTier] = useState<'1' | '3' | '5' | 'custom'>('3');
  const [customDistanceLabel, setCustomDistanceLabel] = useState<string>('');

  // External URLs
  const [stravaUrl, setStravaUrl] = useState<string>('');
  const [garminUrl, setGarminUrl] = useState<string>('');
  const [rungoUrl, setRungoUrl] = useState<string>('');

  // GPX & Engine Results
  const [gpxXml, setGpxXml] = useState<string>('');
  const [gpxFileName, setGpxFileName] = useState<string>('');
  const [measuredMiles, setMeasuredMiles] = useState<number>(0);
  const [elevationGainFt, setElevationGainFt] = useState<number>(0);
  const [points, setPoints] = useState<{ lat: number; lon: number; ele?: number }[]>([]);
  const [directions, setDirections] = useState<RouteTurnStep[]>([]);
  const [geoJson, setGeoJson] = useState<any>(null);

  // Studio UI states
  const [viewMode, setViewMode] = useState<'concise' | 'verbose'>('concise');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Map references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize from existing route or reset
  useEffect(() => {
    if (existingRoute) {
      setName(existingRoute.name || '');
      setDescription(existingRoute.description || '');
      setNotes(existingRoute.notes || '');
      setSurface(existingRoute.surface || 'Pavement');
      setDifficulty(existingRoute.difficulty || 'Easy');
      setMeasuredMiles(existingRoute.distanceMiles || 0);
      setElevationGainFt(existingRoute.elevationGainFt || 0);
      setPoints(existingRoute.points || []);
      setGpxXml(existingRoute.gpxXml || '');
      
      let initDirs = existingRoute.directions || [];
      if (typeof initDirs === 'string') {
        try {
          initDirs = JSON.parse(initDirs);
        } catch (e) {
          initDirs = [];
        }
      }
      setDirections(Array.isArray(initDirs) ? initDirs : []);

      let initGeoJson = existingRoute.geoJson || null;
      if (typeof initGeoJson === 'string') {
        try {
          initGeoJson = JSON.parse(initGeoJson);
        } catch (e) {
          initGeoJson = null;
        }
      }
      setGeoJson(initGeoJson);

      if (['1', '3', '5'].includes(existingRoute.targetDistanceTier as string)) {
        setDistanceTier(existingRoute.targetDistanceTier as '1' | '3' | '5');
      } else if (existingRoute.targetDistanceTier === 'custom' || existingRoute.customDistanceLabel) {
        setDistanceTier('custom');
        setCustomDistanceLabel(existingRoute.customDistanceLabel || '');
      } else {
        // Infer default tier from miles
        const m = existingRoute.distanceMiles || 3;
        if (m <= 2.0) setDistanceTier('1');
        else if (m <= 4.0) setDistanceTier('3');
        else setDistanceTier('5');
      }

      setStravaUrl(existingRoute.externalLinks?.stravaUrl || '');
      setGarminUrl(existingRoute.externalLinks?.garminUrl || '');
      setRungoUrl(existingRoute.externalLinks?.rungoUrl || '');
    } else {
      // Default new route
      setName('');
      setDescription('Weekly Wednesday Woodchuckers group run course starting and finishing at Blue Note Brewing Co.');
      setNotes('Start & finish at Blue Note Brewing. Obey traffic signals and pedestrian crossings.');
      setSurface('Pavement');
      setDifficulty('Easy');
      setDistanceTier('3');
      setCustomDistanceLabel('');
      setStravaUrl('');
      setGarminUrl('');
      setRungoUrl('');
      setGpxXml('');
      setGpxFileName('');
      setMeasuredMiles(0);
      setElevationGainFt(0);
      setPoints([]);
      setDirections([]);
      setGeoJson(null);
    }
    setErrorMsg(null);
    setSelectedStepIndex(null);
  }, [existingRoute, isOpen]);

  // Leaflet map setup & updates
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [38.6781, -121.7712], // Blue Note Brewing patio coordinates
        zoom: 14,
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous vector layers
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }

    // Plot polyline
    if (points && points.length > 0) {
      const latLngs: [number, number][] = points.map((p) => [p.lat, p.lon]);

      const poly = L.polyline(latLngs, {
        color: '#1a607c',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      polylineRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [30, 30] });

      // Add Start Marker at Blue Note
      const startPt = latLngs[0];
      const startIcon = L.divIcon({
        className: 'custom-start-pin',
        html: `<div style="background-color:#1a607c;color:white;padding:3px 7px;border-radius:12px;font-size:10px;font-weight:900;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.4);white-space:nowrap;display:flex;align-items:center;gap:3px;">
          <span>🍺</span> Blue Note (Start)
        </div>`,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
      L.marker(startPt, { icon: startIcon }).addTo(markersGroupRef.current!);

      // Add Numbered Turn Pins if directions exist
      if (directions && directions.length > 0) {
        directions.forEach((step, idx) => {
          if (!step.point) return;
          const [lon, lat] = step.point;
          const isSelected = selectedStepIndex === idx;

          const turnIcon = L.divIcon({
            className: 'custom-turn-pin',
            html: `<div style="background-color:${isSelected ? '#de9c1e' : '#1a607c'};color:${isSelected ? '#000' : '#fff'};width:${isSelected ? '26px' : '20px'};height:${isSelected ? '26px' : '20px'};border-radius:50%;font-size:${isSelected ? '12px' : '10px'};font-weight:900;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);transition:all 0.2s;">
              ${step.step}
            </div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marker = L.marker([lat, lon], { icon: turnIcon });
          marker.on('click', () => {
            setSelectedStepIndex(idx);
          });
          marker.bindTooltip(`<b>#${step.step}</b> ${step.instruction_concise}`, { direction: 'top', offset: [0, -10] });
          markersGroupRef.current?.addLayer(marker);
        });
      }
    }
  }, [isOpen, points, directions, selectedStepIndex]);

  // When selectedStepIndex changes, pan the map to that turn pin
  useEffect(() => {
    if (selectedStepIndex === null || !mapInstanceRef.current || !directions[selectedStepIndex]) return;
    const step = directions[selectedStepIndex];
    if (step.point) {
      const [lon, lat] = step.point;
      mapInstanceRef.current.panTo([lat, lon], { animate: true, duration: 0.5 });
    }
  }, [selectedStepIndex, directions]);

  // Handle GPX File Upload & Processing
  const handleGpxFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setErrorMsg('Please select a valid .gpx file.');
      return;
    }

    try {
      setErrorMsg(null);
      setIsProcessing(true);
      setGpxFileName(file.name);
      setProcessingStatus('Reading GPX track file...');

      const text = await file.text();
      setGpxXml(text);

      const parsed = parseGPX(text, file.name);
      if (!parsed.points || parsed.points.length < 2) {
        throw new Error('GPX file does not contain enough track points.');
      }

      setPoints(parsed.points);
      const mMiles = parsed.distanceMiles || 0;
      setMeasuredMiles(mMiles);
      setElevationGainFt(parsed.elevationGainFt || 0);

      // Default Name from GPX if not already filled
      if (!name) {
        setName(parsed.name || file.name.replace(/\.gpx$/i, ''));
      }

      // Infer Distance Tier from measured distance
      if (mMiles <= 2.0) setDistanceTier('1');
      else if (mMiles <= 4.0) setDistanceTier('3');
      else setDistanceTier('5');

      // Run In-Browser Directions Engine!
      const result = await generateRouteDirectionsFromGpx(text, file.name, {
        onProgress: (status) => setProcessingStatus(status),
      });

      setDirections(result.directions);
      setGeoJson(result.geoJson);
      setIsProcessing(false);
      setProcessingStatus('');
    } catch (err: any) {
      console.error('GPX Processing Error:', err);
      setErrorMsg(err.message || 'Error processing GPX file.');
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Re-run Engine on current GPX
  const handleRegenerateDirections = async () => {
    if (!gpxXml) return;
    try {
      setErrorMsg(null);
      setIsProcessing(true);
      const result = await generateRouteDirectionsFromGpx(gpxXml, gpxFileName || 'route.gpx', {
        name,
        onProgress: (status) => setProcessingStatus(status),
      });
      setDirections(result.directions);
      setGeoJson(result.geoJson);
      setIsProcessing(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error generating directions.');
      setIsProcessing(false);
    }
  };

  // Turn step editing
  const handleUpdateStep = (index: number, field: keyof RouteTurnStep, value: any) => {
    setDirections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleDeleteStep = (index: number) => {
    setDirections((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      // Re-number steps
      return filtered.map((s, i) => ({ ...s, step: i + 1 }));
    });
    if (selectedStepIndex === index) setSelectedStepIndex(null);
  };

  const handleAddStep = () => {
    const newStepNum = directions.length + 1;
    const defaultPt: [number, number] = points[0] ? [points[0].lon, points[0].lat] : [-121.7712, 38.6781];
    const newStep: RouteTurnStep = {
      step: newStepNum,
      cue: 'CONT',
      instruction: 'Continue along the route path',
      instruction_concise: 'CONT on route',
      street: 'Route Path',
      street_concise: 'Path',
      distance_m: 100,
      distance: '328 ft',
      at_km: 0,
      point: defaultPt,
    };
    setDirections([...directions, newStep]);
    setSelectedStepIndex(directions.length);
  };

  // Submit / Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a route name.');
      return;
    }
    if (points.length < 2) {
      setErrorMsg('Please upload a GPX file with route coordinates.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const extLinks: RouteExternalLinks = {};
      if (stravaUrl.trim()) extLinks.stravaUrl = stravaUrl.trim();
      if (garminUrl.trim()) extLinks.garminUrl = garminUrl.trim();
      if (rungoUrl.trim()) extLinks.rungoUrl = rungoUrl.trim();

      const cleanedDirections = directions.map((d) => {
        const stepObj: any = {
          step: d.step,
          cue: d.cue,
          instruction: d.instruction,
          instruction_concise: d.instruction_concise,
          street: d.street,
          distance_m: d.distance_m,
          distance: d.distance,
          at_km: d.at_km,
          point: d.point,
        };
        if (d.street_concise) stepObj.street_concise = d.street_concise;
        if (d.heading_cardinal) stepObj.heading_cardinal = d.heading_cardinal;
        if (d.turn_degrees !== undefined && d.turn_degrees !== null) stepObj.turn_degrees = d.turn_degrees;
        if (d.crosses && d.crosses.length > 0) stepObj.crosses = d.crosses;
        if (d.crosses_concise && d.crosses_concise.length > 0) stepObj.crosses_concise = d.crosses_concise;
        if (d.customNotes && d.customNotes.trim()) stepObj.customNotes = d.customNotes.trim();
        return stepObj;
      });

      const routeData: any = {
        name: name.trim(),
        description: description.trim(),
        notes: notes.trim(),
        surface,
        difficulty,
        distanceMiles: measuredMiles || 3.0,
        elevationGainFt: elevationGainFt || 0,
        targetDistanceTier: distanceTier,
        points,
        directions: cleanedDirections,
        geoJson: geoJson || null,
        externalLinks: extLinks,
        createdAt: existingRoute?.createdAt || new Date().toISOString(),
      };

      if (distanceTier === 'custom' && customDistanceLabel.trim()) {
        routeData.customDistanceLabel = customDistanceLabel.trim();
      }
      if (gpxXml) {
        routeData.gpxXml = gpxXml;
      }

      await onSaveRoute(routeData, existingRoute?.id);
      setIsSaving(false);
      onClose();
    } catch (err: any) {
      console.error('Error saving route:', err);
      setErrorMsg(err.message || 'Error saving route.');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-stone-950/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-5xl w-full my-auto shadow-2xl border border-stone-200 flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">
              🗺️
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg font-display tracking-wide uppercase">
                {existingRoute ? 'Edit Route Studio' : 'Create & Upload Club Route'}
              </h3>
              <p className="text-xs text-woodland-200 font-sans">
                Turn-by-turn cue generator • GeoJSON compiler • Strava &amp; Garmin links
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-woodland-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SECTION 1: GPX UPLOAD DROPZONE */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-woodland-600" />
                  <span>1. Course GPX File</span>
                </h4>
                <p className="text-xs text-stone-500">
                  Exported from Strava, Garmin Connect, RunGo, or Apple Watch.
                </p>
              </div>

              {points.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-300 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{measuredMiles} mi measured ({points.length} pts)</span>
                  </span>
                  {gpxXml && (
                    <button
                      type="button"
                      onClick={handleRegenerateDirections}
                      disabled={isProcessing}
                      className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 text-[11px] font-bold rounded-lg border border-stone-300 transition flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isProcessing ? 'animate-spin' : ''}`} />
                      <span>Regenerate</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Drop Target */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleGpxFile(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition cursor-pointer ${
                isDragOver
                  ? 'border-woodland-600 bg-woodland-50/50'
                  : 'border-stone-300 bg-white hover:border-woodland-400'
              }`}
              onClick={() => {
                const input = document.getElementById('gpxFileInput');
                input?.click();
              }}
            >
              <input
                type="file"
                id="gpxFileInput"
                accept=".gpx"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleGpxFile(e.target.files[0]);
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <UploadCloud className="w-8 h-8 text-woodland-600" />
                <span className="text-xs font-bold text-stone-800">
                  {gpxFileName ? gpxFileName : 'Drag & drop your .gpx file here, or click to browse'}
                </span>
                <span className="text-[11px] text-stone-400">
                  Processed 100% in your browser • Free &amp; private
                </span>
              </div>
            </div>

            {/* Processing Banner */}
            {isProcessing && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-3 animate-pulse">
                <RefreshCw className="w-4 h-4 text-amber-700 animate-spin shrink-0" />
                <span className="text-xs font-bold text-amber-900">
                  {processingStatus || 'Generating turn-by-turn directions via OpenStreetMap...'}
                </span>
              </div>
            )}
          </div>

          {/* SECTION 2: ROUTE METADATA & ROUND DISTANCE TIER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Route Name */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Route Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. The Road to El Dorado"
                className="w-full px-3 py-2 text-xs border rounded-xl outline-none focus:border-woodland-600 focus:ring-1 focus:ring-woodland-600"
                required
              />
            </div>

            {/* Distance Tier Selector (1, 3, 5, or Custom) */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Club Distance Tier *
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['1', '3', '5', 'custom'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setDistanceTier(tier)}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      distanceTier === tier
                        ? 'bg-woodland-800 text-white border-woodland-900 shadow-xs'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {tier === 'custom' ? 'Special Event' : `${tier} Mile`}
                  </button>
                ))}
              </div>
            </div>

            {/* If Custom selected */}
            {distanceTier === 'custom' && (
              <div className="col-span-1 md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <label className="block text-xs font-bold text-amber-950 mb-1">
                  Custom Event Distance / Label (e.g. 10K, Half Marathon, 6-Mile Run)
                </label>
                <input
                  type="text"
                  value={customDistanceLabel}
                  onChange={(e) => setCustomDistanceLabel(e.target.value)}
                  placeholder="e.g. 10K Championship Course"
                  className="w-full px-3 py-2 text-xs border border-amber-300 rounded-xl outline-none bg-white"
                />
              </div>
            )}

            {/* Surface */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Course Surface (Default: Pavement)
              </label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as SurfaceType)}
                className="w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white"
              >
                <option value="Pavement">Pavement (Downtown &amp; Sidewalks)</option>
                <option value="Trail">Dirt Trail / Packed Singletrack</option>
                <option value="Mixed">Mixed (Pavement &amp; Dirt)</option>
                <option value="Gravel">Gravel / Levee</option>
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyType)}
                className="w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white"
              >
                <option value="Easy">Easy (Flat &amp; Beginner Friendly)</option>
                <option value="Moderate">Moderate</option>
                <option value="Challenging">Challenging (Hills or High Mileage)</option>
              </select>
            </div>

            {/* Route Description */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Short Description / Highlight
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scenic social loop through downtown and historic neighborhoods..."
                className="w-full px-3 py-2 text-xs border rounded-xl outline-none"
              />
            </div>

            {/* Notes & Hazards */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Route Notes, Lighting &amp; Road Crossings
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Start & finish at Blue Note Brewing. Use pedestrian crossings at 3rd & Main..."
                className="w-full px-3 py-2 text-xs border rounded-xl outline-none"
              />
            </div>
          </div>

          {/* SECTION 3: EXTERNAL APP LINKS (Strava, Garmin, RunGo) */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <h4 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-woodland-600" />
              <span>2. External Running App Links (Optional)</span>
            </h4>
            <p className="text-xs text-stone-500">
              Paste direct URLs so runners can load the course into their Garmin watch or Strava app with one tap.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-orange-700 mb-1 flex items-center gap-1">
                  <span>🟠</span> Strava Route URL
                </label>
                <input
                  type="url"
                  value={stravaUrl}
                  onChange={(e) => setStravaUrl(e.target.value)}
                  placeholder="https://www.strava.com/routes/..."
                  className="w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cyan-800 mb-1 flex items-center gap-1">
                  <span>🔵</span> Garmin Connect Course
                </label>
                <input
                  type="url"
                  value={garminUrl}
                  onChange={(e) => setGarminUrl(e.target.value)}
                  placeholder="https://connect.garmin.com/..."
                  className="w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-800 mb-1 flex items-center gap-1">
                  <span>🟢</span> RunGo Voice Nav URL
                </label>
                <input
                  type="url"
                  value={rungoUrl}
                  onChange={(e) => setRungoUrl(e.target.value)}
                  placeholder="https://routes.rungoapp.com/..."
                  className="w-full px-3 py-2 text-xs border rounded-xl outline-none bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: INTERACTIVE MAP & TURN-BY-TURN STUDIO */}
          {points.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
                <div>
                  <h4 className="font-extrabold text-sm text-stone-900 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-woodland-600" />
                    <span>3. Interactive Route Preview &amp; Turn-by-Turn Editor</span>
                  </h4>
                  <p className="text-xs text-stone-500">
                    Tap any turn card or map pin to inspect and customize the instruction.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-stone-100 p-0.5 rounded-xl flex items-center text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setViewMode('concise')}
                      className={`px-3 py-1 rounded-lg transition ${
                        viewMode === 'concise' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                      }`}
                    >
                      📱 Concise (Phone)
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('verbose')}
                      className={`px-3 py-1 rounded-lg transition ${
                        viewMode === 'verbose' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
                      }`}
                    >
                      📖 Verbose
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>
              </div>

              {/* Side-by-Side Map & Turns List */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Leaflet Map Preview */}
                <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-stone-200 shadow-inner relative h-[360px] sm:h-[420px]">
                  <div ref={mapContainerRef} className="w-full h-full" />
                  <div className="absolute top-3 right-3 z-[400] bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-lg shadow-xs border text-[11px] font-bold text-stone-800">
                    {directions.length} Turn Points
                  </div>
                </div>

                {/* Editable Turn Cards List */}
                <div className="lg:col-span-5 h-[360px] sm:h-[420px] overflow-y-auto space-y-2 pr-1">
                  {directions.length === 0 ? (
                    <div className="p-8 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-xs space-y-2">
                      <p>No turn directions generated yet.</p>
                      <button
                        type="button"
                        onClick={handleRegenerateDirections}
                        className="px-3 py-1.5 bg-woodland-700 text-white rounded-xl font-bold"
                      >
                        Generate Directions Now
                      </button>
                    </div>
                  ) : (
                    directions.map((step, idx) => {
                      const isSelected = selectedStepIndex === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedStepIndex(idx)}
                          className={`p-3 rounded-2xl border transition cursor-pointer text-xs space-y-2 ${
                            isSelected
                              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/30'
                              : 'bg-white border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-woodland-800 text-white font-black text-[11px] flex items-center justify-center">
                                {step.step}
                              </span>
                              <span className="font-extrabold text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                {step.cue}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[11px]">
                              <span>{step.distance}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteStep(idx);
                                }}
                                className="text-stone-400 hover:text-red-600 p-1 transition"
                                title="Delete this turn step"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Instruction Text */}
                          <div>
                            {viewMode === 'concise' ? (
                              <input
                                type="text"
                                value={step.instruction_concise}
                                onChange={(e) => handleUpdateStep(idx, 'instruction_concise', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-2 py-1 text-xs border rounded-lg font-bold text-stone-900 bg-white"
                                placeholder="Concise phone cue..."
                              />
                            ) : (
                              <textarea
                                value={step.instruction}
                                onChange={(e) => handleUpdateStep(idx, 'instruction', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                rows={2}
                                className="w-full px-2 py-1 text-xs border rounded-lg text-stone-900 bg-white leading-relaxed"
                                placeholder="Verbose instruction..."
                              />
                            )}
                          </div>

                          {/* Optional Custom Hazard / Landmark Note */}
                          <div onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={step.customNotes || ''}
                              onChange={(e) => handleUpdateStep(idx, 'customNotes', e.target.value)}
                              placeholder="+ Add landmark note (e.g. look for water tower)"
                              className="w-full px-2 py-0.5 text-[10px] text-stone-600 border border-dashed rounded-md bg-stone-50/50"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              {existingRoute && onDeleteRoute && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm(`Delete route "${name}" from the club library?`)) {
                      await onDeleteRoute(existingRoute.id);
                      onClose();
                    }
                  }}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Route</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isProcessing}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-woodland-800 hover:bg-woodland-900 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-amber-300" />
                    <span>{existingRoute ? 'Save Route Changes' : 'Save Route to Library'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
