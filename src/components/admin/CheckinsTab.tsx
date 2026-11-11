import React, { useState } from 'react';
import { RECENT_CHECKIN_DAYS } from '../../services/storage';
import { 
  Download, 
} from 'lucide-react';
import type { AdminDashboardProps } from '../AdminDashboard';
import { downloadCSV } from './shared';
import { runnerLookup } from '../../utils/runnerLookup';

export const CheckinsTab: React.FC<AdminDashboardProps> = (props) => {
  const {
    checkins,
    users = [],
  } = props;
  const runner = runnerLookup(users);
  const [checkinFilterDate, setCheckinFilterDate] = useState<string>('all');
  // Filtered checkins
  const filteredCheckins = checkins.filter((c) => {
    if (checkinFilterDate === 'all') return true;
    return c.date === checkinFilterDate;
  });

  const exportCheckinsCSV = () => {
    const headers = ['Date', 'Time', 'Code Word', 'User Email', 'Runner Name', 'Activity', 'With Pet', 'Loops', 'Route Choice', 'Actual GPS Miles', 'Route Name', 'Source'];
    const rows = checkins.map((c) => [
      c.date,
      c.time,
      c.codeWord || '',
      c.userEmail,
      runner.name(c.userEmail, c.runnerName),
      c.activity,
      c.withPet ? 'Yes' : 'No',
      c.loops || 1,
      // A route ID for current check-ins; a 1/3/5 mile choice for older ones.
      typeof c.distanceChoice === 'number' || /^\d+(\.\d+)?$/.test(String(c.distanceChoice)) ? `${c.distanceChoice} mi` : c.distanceChoice,
      c.actualMiles,
      c.routeName || '',
      c.source,
    ]);
    downloadCSV(headers, rows, 'woodchuckers-checkins-log.csv');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <h3 className="font-extrabold text-base text-stone-900 font-display">
            Check-In Single Entry Event Log
          </h3>
          <p className="text-xs text-stone-500">
            Check-ins from the last {RECENT_CHECKIN_DAYS} days: date, runner, run/walk, distance choice and measured miles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={checkinFilterDate}
            onChange={(e) => setCheckinFilterDate(e.target.value)}
            className="text-xs px-3 py-1.5 border rounded-xl bg-stone-50 font-bold outline-none"
          >
            <option value="all">All Dates ({checkins.length})</option>
            {Array.from(new Set(checkins.map((c) => c.date))).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <button
            onClick={exportCheckinsCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-xl transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200">
            <tr>
              <th className="py-2.5 px-3">Date &amp; Time</th>
              <th className="py-2.5 px-3">Runner</th>
              <th className="py-2.5 px-3">Email</th>
              <th className="py-2.5 px-3">Activity</th>
              <th className="py-2.5 px-3">Choice</th>
              <th className="py-2.5 px-3">Actual Miles</th>
              <th className="py-2.5 px-3">Route Name</th>
              <th className="py-2.5 px-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-sans">
            {filteredCheckins.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-stone-400">
                  No check-ins recorded for this date filter.
                </td>
              </tr>
            ) : (
              filteredCheckins.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/70 transition">
                  <td className="py-2.5 px-3 font-mono text-stone-700">
                    {c.date} <span className="text-stone-400 text-[11px]">{c.time}</span>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-stone-900">{runner.name(c.userEmail, c.runnerName) || 'Woodchuck Runner'}</td>
                  <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">{c.userEmail}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.activity === 'running' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {c.activity === 'running' ? '🏃 Running' : '🚶 Walking'}
                      </span>
                      {c.withPet && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title="Ran with a pet">
                          🐕 Pet
                        </span>
                      )}
                      {c.loops && c.loops > 1 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200" title={`${c.loops} loops completed`}>
                          🔄 {c.loops} Loops
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-stone-800">{c.distanceChoice} Mi</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-woodland-800">{c.actualMiles} mi</td>
                  <td className="py-2.5 px-3 text-stone-600 truncate max-w-xs">{c.routeName || 'Club Route'}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 text-[10px] rounded uppercase font-semibold">
                      {c.source}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
