import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Mountain, Navigation } from 'lucide-react';
import { parseGPX } from '../utils/gpxParser';
import { GPXRoute, SurfaceType, DifficultyType } from '../types';

interface GpxUploaderProps {
  onRouteAdded: (route: Omit<GPXRoute, 'id'>) => void;
  onCancel?: () => void;
}

export const GpxUploader: React.FC<GpxUploaderProps> = ({ onRouteAdded, onCancel }) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<Partial<GPXRoute> | null>(null);

  // Form custom fields
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [surface, setSurface] = useState<SurfaceType>('Trail');
  const [difficulty, setDifficulty] = useState<DifficultyType>('Moderate');

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setError('Please upload a valid .gpx file.');
      return;
    }

    try {
      setError(null);
      const text = await file.text();
      const parsed = parseGPX(text, file.name);
      setParsedPreview(parsed);
      setName(parsed.name || file.name.replace(/\.gpx$/i, ''));
      setDescription(parsed.description || 'Uploaded GPX track for Woodland Woodchuckers');
      if (parsed.surface) setSurface(parsed.surface);
      if (parsed.difficulty) setDifficulty(parsed.difficulty);
    } catch (err: any) {
      setError(err.message || 'Failed to parse GPX file.');
      setParsedPreview(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSave = () => {
    if (!parsedPreview || !parsedPreview.points) return;
    onRouteAdded({
      name: name || 'Unnamed Woodchuck Route',
      description: description || 'Club GPX route',
      distanceMiles: parsedPreview.distanceMiles || 0,
      elevationGainFt: parsedPreview.elevationGainFt || 0,
      points: parsedPreview.points,
      surface,
      difficulty,
      gpxXml: parsedPreview.gpxXml,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-stone-200 p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-stone-900">Upload GPX Trail Route</h3>
          <p className="text-xs text-stone-500">
            Exported from Garmin, Apple Watch, Strava, or AllTrails. Parsed 100% in your browser.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!parsedPreview ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
            dragActive
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-stone-300 hover:border-emerald-400 bg-stone-50/50'
          }`}
        >
          <UploadCloud className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-stone-800 mb-1">
            Drag and drop your .gpx file here
          </p>
          <p className="text-xs text-stone-500 mb-4">or choose from your computer</p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 cursor-pointer shadow-sm transition">
            <FileText className="w-4 h-4" />
            <span>Select GPX File</span>
            <input
              type="file"
              accept=".gpx,application/gpx+xml"
              className="hidden"
              onChange={handleChange}
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Route parsed successfully!</span>
            </div>
            <button
              onClick={() => setParsedPreview(null)}
              className="text-xs text-emerald-700 hover:underline"
            >
              Upload different file
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
              <span className="text-xs text-stone-500 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-emerald-600" /> Total Distance
              </span>
              <p className="text-lg font-bold text-stone-900">{parsedPreview.distanceMiles} mi</p>
            </div>
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
              <span className="text-xs text-stone-500 flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5 text-amber-600" /> Elevation Gain
              </span>
              <p className="text-lg font-bold text-stone-900">+{parsedPreview.elevationGainFt} ft</p>
            </div>
          </div>

          {/* Form Fields */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Route Title</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Woodland Valley 10K Loop"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Trail details, terrain notes, parking..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Surface</label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as SurfaceType)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Trail">Trail (Dirt/Singletrack)</option>
                <option value="Pavement">Pavement (Road/Path)</option>
                <option value="Mixed">Mixed Surface</option>
                <option value="Track">Running Track</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as DifficultyType)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Easy">Easy (Flat & Gentle)</option>
                <option value="Moderate">Moderate</option>
                <option value="Challenging">Challenging (Steep/Long)</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
            >
              Save to Club Routes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
