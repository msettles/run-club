import React from 'react';
import { INITIAL_SPECIAL_EVENTS } from '../../data/catalog';
import { 
  Calendar, 
  Plus,
} from 'lucide-react';
import type { AdminDashboardProps } from '../AdminDashboard';

export const EventsTab: React.FC<AdminDashboardProps> = (props) => {
  const {
    meetupEvents,
    specialEvents = INITIAL_SPECIAL_EVENTS,
    onOpenNewRun,
  } = props;


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: runs are the only place check-in events and code words are created */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
        <div className="border-b border-stone-100 pb-3">
          <h3 className="font-extrabold text-base text-stone-900 font-display">Check-in Events &amp; Code Words</h3>
          <p className="text-xs text-stone-500">
            Each run has its own check-in event and code word. Create them with <strong>New Run</strong>, and change the code word from
            <strong> Edit Run</strong> until that run&apos;s check-in opens (2 hours before the start). Code words must be different for runs on the same day:
            the word tells the app which run a runner is checking into.
          </p>
        </div>
        {onOpenNewRun && (
          <button
            type="button"
            onClick={onOpenNewRun}
            className="flex items-center gap-2 px-4 py-2.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Run</span>
          </button>
        )}
      </div>

      {/* Right: Scheduled Events Roster */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>Meetups &amp; Active Code Words</span>
          </h4>
          {onOpenNewRun && (
            <button
              type="button"
              onClick={onOpenNewRun}
              className="px-2.5 py-1 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Run</span>
            </button>
          )}
        </div>

        <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
          {meetupEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="text-stone-900 font-bold">{evt.title}</strong>
                  {evt.specialEvent && evt.specialEvent !== 'none' && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] rounded-full uppercase flex items-center gap-1">
                      <span>
                        {specialEvents.find((se) => se.id === evt.specialEvent)?.emoji || '🌟'}
                      </span>
                      <span>
                        {specialEvents.find((se) => se.id === evt.specialEvent)?.name || evt.specialEvent}
                      </span>
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-stone-500">{evt.date}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-stone-500">Code Word:</span>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-950 font-mono font-bold rounded-md">
                  {evt.codeWord}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-stone-400">Distances:</span>
                {evt.activeDistances.map((d) => {
                  const r = evt.routes[d];
                  return (
                    <span
                      key={d}
                      className="px-2 py-0.5 bg-stone-200 text-stone-800 font-bold text-[10px] rounded-full"
                    >
                      {r ? `${r.actualMiles} mi • ${r.name}` : `${d} Mi`}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
