import React from 'react';
import { RunEvent, Member, GPXRoute } from '../types';
import { Clock, MapPin, Mountain, Check, CalendarPlus, Map } from 'lucide-react';

interface RunCardProps {
  run: RunEvent;
  route?: GPXRoute;
  currentMember: Member;
  onToggleRSVP: (runId: string) => void;
  onOpenCheckIn: (run: RunEvent) => void;
  onViewRoute: (route: GPXRoute) => void;
}

export const RunCard: React.FC<RunCardProps> = ({
  run,
  route,
  currentMember,
  onToggleRSVP,
  onOpenCheckIn,
  onViewRoute,
}) => {
  const isAttending = run.attendees.some((a) => a.memberId === currentMember.id);
  const isCheckedIn = run.attendees.some((a) => a.memberId === currentMember.id && a.checkedIn);
  const checkedInCount = run.attendees.filter((a) => a.checkedIn).length;

  // Format nice human-readable date
  const runDateObj = new Date(`${run.date}T00:00:00`);
  const formattedDay = runDateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const formattedDate = runDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Generate .ics calendar invite file
  const handleAddToCalendar = () => {
    const startIso = `${run.date.replace(/-/g, '')}T${run.time.includes('PM') ? '180000' : '080000'}`;
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Woodland Woodchuckers Run Club//NONSGML v1.0//EN',
      'BEGIN:VEVENT',
      `SUMMARY:🦫 Woodchuckers: ${run.title}`,
      `DESCRIPTION:${run.description}\\nDistance: ${run.distanceMiles} miles\\nSurface: ${run.surface}`,
      `LOCATION:${run.locationName}, ${run.address}`,
      `DTSTART:${startIso}`,
      `DTEND:${startIso}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `woodchuckers-${run.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition">
      {/* Top Banner / Tags */}
      <div className="p-5 pb-3 flex items-start gap-4">
        {/* Date block */}
        <div className="flex flex-col items-center justify-center w-14 h-16 rounded-xl bg-woodland-50 border border-woodland-200 text-woodland-900 shrink-0 shadow-sm">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
            {formattedDay}
          </span>
          <span className="text-lg font-black leading-tight text-stone-900">
            {formattedDate.split(' ')[1]}
          </span>
          <span className="text-[10px] font-medium text-stone-500">
            {formattedDate.split(' ')[0]}
          </span>
        </div>

        {/* Title and details */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                run.surface === 'Trail'
                  ? 'bg-emerald-100 text-emerald-800'
                  : run.surface === 'Pavement'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {run.surface}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              {run.distanceMiles} mi
            </span>
            {run.elevationGainFt > 0 && (
              <span className="text-[11px] font-medium text-stone-500 flex items-center gap-0.5">
                <Mountain className="w-3 h-3 text-stone-400" />
                +{run.elevationGainFt}ft
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-stone-900 leading-snug line-clamp-1">
            {run.title}
          </h3>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-stone-500 mt-1">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>{run.time}</span>
            </div>
            <div className="flex items-center gap-1 line-clamp-1">
              <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="truncate">{run.locationName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-2">
        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
          {run.description}
        </p>
      </div>

      {/* Pace Groups */}
      {run.paceGroups && run.paceGroups.length > 0 && (
        <div className="px-5 py-2">
          <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
            Pace Groups:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {run.paceGroups.map((pg, idx) => (
              <span
                key={idx}
                className="text-xs bg-stone-50 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-lg"
              >
                <strong className="text-emerald-800">{pg.label}:</strong> {pg.targetPace}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Attendees summary */}
      <div className="px-5 py-2.5 flex items-center justify-between border-t border-stone-100 bg-stone-50/50">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5 overflow-hidden">
            {run.attendees.slice(0, 4).map((att, i) => (
              <div
                key={i}
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center uppercase shadow-xs"
                title={att.name}
              >
                {att.name.charAt(0)}
              </div>
            ))}
          </div>
          <span className="text-xs text-stone-600 font-medium">
            {run.attendees.length} RSVP{run.attendees.length === 1 ? '' : 's'}
            {checkedInCount > 0 && (
              <span className="text-emerald-700 ml-1 font-semibold">
                ({checkedInCount} checked in)
              </span>
            )}
          </span>
        </div>

        {/* Add to Calendar button */}
        <button
          onClick={handleAddToCalendar}
          className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 font-medium transition"
          title="Download .ics event to calendar"
        >
          <CalendarPlus className="w-3.5 h-3.5" />
          <span>Add to Cal</span>
        </button>
      </div>

      {/* Footer Actions */}
      <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2">
        {route ? (
          <button
            onClick={() => onViewRoute(route)}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition"
          >
            <Map className="w-3.5 h-3.5" />
            <span>View GPX Map</span>
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {/* RSVP Toggle */}
          <button
            onClick={() => onToggleRSVP(run.id)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              isAttending
                ? 'bg-stone-200 text-stone-800 hover:bg-stone-300'
                : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 shadow-xs'
            }`}
          >
            {isAttending ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Going</span>
              </>
            ) : (
              <span>RSVP</span>
            )}
          </button>

          {/* Check-In Button */}
          <button
            onClick={() => onOpenCheckIn(run)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              isCheckedIn
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
            }`}
          >
            {isCheckedIn ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Checked In</span>
              </>
            ) : (
              <span>Check In</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
