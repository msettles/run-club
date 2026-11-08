import React, { useState } from 'react';
import { RunEvent, GPXRoute, SurfaceType, PaceGroup, SpecialEventType, SpecialEventDefinition } from '../types';
import { INITIAL_SPECIAL_EVENTS } from '../data/initialData';
import { X, Calendar, Clock, MapPin, Plus, Trash2, Sparkles } from 'lucide-react';

interface EditRunModalProps {
  run: RunEvent;
  routes: GPXRoute[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRun: RunEvent) => void;
  onDelete?: (runId: string) => void;
  specialEvents?: SpecialEventDefinition[];
}

export const EditRunModal: React.FC<EditRunModalProps> = ({
  run,
  routes,
  isOpen,
  onClose,
  onSave,
  onDelete,
  specialEvents = INITIAL_SPECIAL_EVENTS,
}) => {
  const [title, setTitle] = useState(run.title);
  const [specialEvent, setSpecialEvent] = useState<SpecialEventType>(run.specialEvent || 'none');
  const [date, setDate] = useState(run.date);
  const [time, setTime] = useState(run.time);
  const [locationName, setLocationName] = useState(run.locationName);
  const [address, setAddress] = useState(run.address || '');
  const [surface, setSurface] = useState<SurfaceType>(run.surface);
  const [distanceMiles, setDistanceMiles] = useState(run.distanceMiles);
  const [elevationGainFt, setElevationGainFt] = useState(run.elevationGainFt);
  const [selectedRouteId, setSelectedRouteId] = useState<string>(run.routeId || '');
  const [description, setDescription] = useState(run.description);
  const [paceGroups, setPaceGroups] = useState<PaceGroup[]>(run.paceGroups || []);
  const [completed, setCompleted] = useState<boolean>(run.completed || false);

  if (!isOpen) return null;

  const handleRouteChange = (routeId: string) => {
    setSelectedRouteId(routeId);
    const r = routes.find((x) => x.id === routeId);
    if (r) {
      setDistanceMiles(r.distanceMiles);
      setElevationGainFt(r.elevationGainFt);
      setSurface(r.surface);
    }
  };

  const addPaceGroup = () => {
    setPaceGroups([...paceGroups, { label: `Pace ${paceGroups.length + 1}`, targetPace: '10:00 /mi' }]);
  };

  const removePaceGroup = (index: number) => {
    setPaceGroups(paceGroups.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...run,
      title,
      date,
      time,
      locationName,
      address,
      surface,
      distanceMiles: Number(distanceMiles),
      elevationGainFt: Number(elevationGainFt),
      routeId: selectedRouteId || undefined,
      description,
      paceGroups,
      completed,
      specialEvent: specialEvent !== 'none' ? specialEvent : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-stone-50 border-b border-stone-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h3 className="font-bold text-base text-stone-900">Edit Scheduled Run</h3>
              <p className="text-xs text-stone-500">ID: {run.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Run Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Is Special Event?</span>
              </label>
              <select
                value={specialEvent}
                onChange={(e) => setSpecialEvent(e.target.value as SpecialEventType)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50/60 font-semibold"
              >
                <option value="none">None (Regular Run)</option>
                {specialEvents.map((se) => (
                  <option key={se.id} value={se.id}>
                    {se.emoji} {se.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" /> Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-400" /> Start Time
              </label>
              <input
                type="text"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Attach GPX Route */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Attached GPX Route</label>
            <select
              value={selectedRouteId}
              onChange={(e) => handleRouteChange(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none bg-white"
            >
              <option value="">No specific GPX route attached</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.distanceMiles} mi{r.directions?.length ? ` • ${r.directions.length} turns` : ''})
                </option>
              ))}
            </select>
            {selectedRouteId && routes.find((r) => r.id === selectedRouteId)?.externalLinks && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs">
                <span className="font-semibold text-[11px] text-stone-500">Linked Apps:</span>
                {routes.find((r) => r.id === selectedRouteId)?.externalLinks?.stravaUrl && (
                  <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded font-bold">
                    Strava
                  </span>
                )}
                {routes.find((r) => r.id === selectedRouteId)?.externalLinks?.garminUrl && (
                  <span className="text-[10px] bg-cyan-100 text-cyan-900 px-1.5 py-0.2 rounded font-bold">
                    Garmin
                  </span>
                )}
                {routes.find((r) => r.id === selectedRouteId)?.externalLinks?.rungoUrl && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.2 rounded font-bold">
                    RunGo
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Distance (mi)</label>
              <input
                type="number"
                step="0.1"
                required
                value={distanceMiles}
                onChange={(e) => setDistanceMiles(parseFloat(e.target.value) || 0)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Elevation Gain (ft)</label>
              <input
                type="number"
                value={elevationGainFt}
                onChange={(e) => setElevationGainFt(parseInt(e.target.value, 10) || 0)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Surface</label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as SurfaceType)}
                className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none bg-white"
              >
                <option value="Trail">Trail</option>
                <option value="Pavement">Pavement</option>
                <option value="Mixed">Mixed</option>
                <option value="Track">Track</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-stone-400" /> Location Details
            </label>
            <input
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none mb-1.5"
            />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address / Trailhead directions"
              className="w-full text-xs px-3 py-1.5 border border-stone-200 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none text-stone-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none"
            />
          </div>

          {/* Status flag */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="completedCheckbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="w-4 h-4 text-woodland-600 rounded focus:ring-woodland-500"
            />
            <label htmlFor="completedCheckbox" className="text-xs font-semibold text-stone-700 cursor-pointer">
              Mark Run as Completed / Archived
            </label>
          </div>

          {/* Pace groups */}
          <div className="pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-stone-700">Pace Groups</label>
              <button
                type="button"
                onClick={addPaceGroup}
                className="text-xs text-woodland-700 hover:text-woodland-800 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Group
              </button>
            </div>
            <div className="space-y-2">
              {paceGroups.map((pg, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={pg.label}
                    onChange={(e) => {
                      const updated = [...paceGroups];
                      updated[idx].label = e.target.value;
                      setPaceGroups(updated);
                    }}
                    className="w-1/3 text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={pg.targetPace}
                    onChange={(e) => {
                      const updated = [...paceGroups];
                      updated[idx].targetPace = e.target.value;
                      setPaceGroups(updated);
                    }}
                    className="flex-1 text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg"
                  />
                  {paceGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePaceGroup(idx)}
                      className="text-stone-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit and Delete */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between">
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete "${run.title}"?`)) {
                    onDelete(run.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                Delete Run
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold bg-woodland-600 text-white rounded-lg hover:bg-woodland-700 shadow-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
