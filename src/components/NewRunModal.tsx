import { nextClubRunDate } from '../utils/checkInWindow';
import React, { useState } from 'react';
import { RunEvent, GPXRoute, PaceGroup, SpecialEventType, SpecialEventDefinition, RunRouteChoice } from '../types';
import { RouteChoicesEditor, defaultChoices } from './RouteChoicesEditor';
import { resolveChoices, routeChoiceError, deriveRunStats } from '../utils/runChoices';
import { INITIAL_SPECIAL_EVENTS } from '../data/catalog';
import { X, Calendar, Clock, MapPin, Plus, Trash2, Sparkles, KeyRound } from 'lucide-react';

interface NewRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  routes: GPXRoute[];
  organizerName: string;
  onAddRun: (run: Omit<RunEvent, 'id' | 'attendees'>, codeWord: string) => Promise<void>;
  specialEvents?: SpecialEventDefinition[];
}

export const NewRunModal: React.FC<NewRunModalProps> = ({
  isOpen,
  onClose,
  routes,
  organizerName,
  onAddRun,
  specialEvents = INITIAL_SPECIAL_EVENTS,
}) => {
  const [title, setTitle] = useState('');
  const [specialEvent, setSpecialEvent] = useState<SpecialEventType>('none');
  const [date, setDate] = useState(() => nextClubRunDate());
  const [time, setTime] = useState('06:00 PM');
  const [locationName, setLocationName] = useState('Blue Note Brewing Company');
  const [address, setAddress] = useState('Woodland, CA');
  const [routeChoices, setRouteChoices] = useState<RunRouteChoice[]>(() => defaultChoices(routes));
  const [codeWord, setCodeWord] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [description, setDescription] = useState('Weekly group run. Everyone welcome, meet by the front entrance / patio!');

  // Pace groups
  const [paceGroups, setPaceGroups] = useState<PaceGroup[]>([
    { label: 'Pace 1', targetPace: '< 9:30 /mi' },
    { label: 'Pace 2', targetPace: '9:30 - 11:00 /mi' },
    { label: 'Pace 3 (jog/walk)', targetPace: '11:00+ /mi' },
  ]);

  // Hooks must run before the early return below.
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const addPaceGroup = () => {
    setPaceGroups([...paceGroups, { label: `Pace ${paceGroups.length + 1}`, targetPace: '10:30+ /mi' }]);
  };

  const removePaceGroup = (index: number) => {
    setPaceGroups(paceGroups.filter((_, i) => i !== index));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!title) return;
    const resolved = resolveChoices(routeChoices, routes);
    const routeError = routeChoiceError(resolved);
    if (routeError) { setFormError(routeError); return; }
    if (!codeWord.trim()) {
      setFormError('Enter the check-in code word. It can be changed until check-in opens.');
      return;
    }
    const stats = deriveRunStats(resolved);

    setIsSaving(true);
    setFormError(null);
    try {
      await onAddRun({
      title,
      date,
      time,
      locationName,
      address,
      ...stats,
      routeId: resolved[0].route.id,
      routeChoices: resolved.map((c) => ({ routeId: c.route.id, customLabel: c.label })),
      description,
      organizerName,
      paceGroups,
      specialEvent: specialEvent !== 'none' ? specialEvent : undefined,
      }, codeWord);
      onClose();
    } catch (err: any) {
      // Nothing was saved; keep the form open so the code word can be changed.
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
            <span className="text-xl">🏃</span>
            <h3 className="font-bold text-base text-stone-900">Schedule New Group Run</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Run Event Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wednesday Turkey Warmup"
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
                placeholder="08:00 AM"
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
              required
              onChange={(e) => setCodeWord(e.target.value)}
              placeholder="Announced at the run, e.g. TURKEY"
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-stone-400" /> Meeting Location Name & Details
            </label>
            <input
              type="text"
              required
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Blue Note Brewing Company"
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none mb-2"
            />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address / Meetup directions (optional)"
              className="w-full text-xs px-3 py-1.5 border border-stone-200 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none text-stone-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Run Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pace info, post-run coffee, route notes..."
              className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-woodland-500 focus:outline-none"
            />
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
                    placeholder="Group name"
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
                    placeholder="Pace (e.g. 9:00 /mi)"
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

          {/* Submit */}
          <div className="pt-4 border-t border-stone-200 flex justify-end gap-2">
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
              {isSaving ? 'Publishing…' : 'Publish Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
