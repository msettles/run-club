import React, { useState } from 'react';
import { RunEvent, GPXRoute, PaceGroup, SpecialEventType, SpecialEventDefinition, RunRouteChoice } from '../types';
import { RouteChoicesEditor } from './RouteChoicesEditor';
import { getRunChoices, resolveChoices, deriveRunStats, deleteRunConfirmMessage } from '../utils/runChoices';
import { INITIAL_SPECIAL_EVENTS } from '../data/initialData';
import { X, Calendar, Clock, MapPin, Plus, Trash2, Sparkles, KeyRound } from 'lucide-react';

interface EditRunModalProps {
  run: RunEvent;
  routes: GPXRoute[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedRun: RunEvent, codeWord: string) => Promise<void>;
  onDelete?: (runId: string) => void;
  checkInCount?: number; // Runners checked into this run (their stats are rolled back on delete)
  specialEvents?: SpecialEventDefinition[];
  currentCodeWord?: string; // Code word of the check-in event for this run's date
  codeWordLockedSince?: string; // Set once check-in has opened: the code word can no longer change
}

export const EditRunModal: React.FC<EditRunModalProps> = ({
  run,
  routes,
  isOpen,
  onClose,
  onSave,
  onDelete,
  checkInCount = 0,
  specialEvents = INITIAL_SPECIAL_EVENTS,
  currentCodeWord = '',
  codeWordLockedSince,
}) => {
  const [title, setTitle] = useState(run.title);
  const [specialEvent, setSpecialEvent] = useState<SpecialEventType>(run.specialEvent || 'none');
  const [date, setDate] = useState(run.date);
  const [time, setTime] = useState(run.time);
  const [locationName, setLocationName] = useState(run.locationName);
  const [address, setAddress] = useState(run.address || '');
  const [routeChoices, setRouteChoices] = useState<RunRouteChoice[]>(() => getRunChoices(run, routes));
  const [codeWord, setCodeWord] = useState(currentCodeWord);
  const [formError, setFormError] = useState<string | null>(null);
  const [description, setDescription] = useState(run.description);
  const [paceGroups, setPaceGroups] = useState<PaceGroup[]>(run.paceGroups || []);
  const [completed, setCompleted] = useState<boolean>(run.completed || false);

  if (!isOpen) return null;

  const addPaceGroup = () => {
    setPaceGroups([...paceGroups, { label: `Pace ${paceGroups.length + 1}`, targetPace: '10:00 /mi' }]);
  };

  const removePaceGroup = (index: number) => {
    setPaceGroups(paceGroups.filter((_, i) => i !== index));
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = resolveChoices(routeChoices, routes);
    if (resolved.length === 0) {
      setFormError('Add at least one distance option with a route.');
      return;
    }
    if (!codeWord.trim()) {
      setFormError('Enter the check-in code word.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      await onSave({
      ...run,
      title,
      date,
      time,
      locationName,
      address,
      ...deriveRunStats(resolved),
      routeId: resolved[0].route.id,
      routeChoices: resolved.map((c) => ({ routeId: c.route.id, customLabel: c.label })),
      description,
      paceGroups,
      completed,
      specialEvent: specialEvent !== 'none' ? specialEvent : undefined,
      }, codeWord);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Not saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
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

          {/* Distance options: each is a library route; distance, elevation and surface come from the routes */}
          <RouteChoicesEditor
            routes={routes}
            choices={routeChoices}
            onChange={(c) => {
              setRouteChoices(c);
              setFormError(null);
            }}
          />
          {formError && <p className="text-xs text-red-600 font-semibold">{formError}</p>}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-stone-400" /> Check-in Code Word
            </label>
            <input
              type="text"
              value={codeWord}
              onChange={(e) => setCodeWord(e.target.value)}
              readOnly={Boolean(codeWordLockedSince)}
              aria-describedby={codeWordLockedSince ? 'codeword-locked-note' : undefined}
              placeholder="Announced at the run, e.g. TURKEY"
              className={`w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none uppercase ${codeWordLockedSince ? 'bg-stone-100 text-stone-500 cursor-not-allowed' : ''}`}
            />
            {codeWordLockedSince && (
              <p id="codeword-locked-note" className="mt-1 text-[11px] text-stone-500">
                Locked: check-in opened {codeWordLockedSince}.
              </p>
            )}
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
              placeholder="Address / Meetup directions"
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
                  const message = deleteRunConfirmMessage(run.title, checkInCount);
                  if (confirm(message)) {
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
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold bg-woodland-600 text-white rounded-lg hover:bg-woodland-700 shadow-sm disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
