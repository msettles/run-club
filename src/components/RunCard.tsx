import React from 'react';
import { RunEvent, Member, GPXRoute } from '../types';
import { ResolvedChoice } from '../utils/runChoices';
import { Clock, MapPin, Mountain, Check, CalendarPlus, Map, Pencil } from 'lucide-react';

interface RunCardProps {
  run: RunEvent;
  route?: GPXRoute;
  choices?: ResolvedChoice[]; // Distance options for this run (1 / 3 / 5)
  currentMember: Member;
  onToggleRSVP: (runId: string) => void;
  onOpenCheckIn: (run: RunEvent) => void;
  onViewRoute: (route: GPXRoute) => void;
  isCheckedIn?: boolean; // The signed-in runner has a check-in for this run
  notLive?: boolean;     // Missing its code word / check-in event: shown to staff only
  onEdit?: (run: RunEvent) => void; // Organizers and admins, upcoming runs only
  onDelete?: (run: RunEvent) => void; // Admins, past runs (which can't be edited)
}

export const RunCard: React.FC<RunCardProps> = ({
  run,
  route,
  choices = [],
  currentMember,
  onToggleRSVP,
  onOpenCheckIn,
  onViewRoute,
  isCheckedIn = false,
  notLive = false,
  onEdit,
  onDelete,
}) => {
  const isAttending = run.attendees.some((a) => a.memberId === currentMember.id);
  const checkedInCount = run.attendees.filter((a) => a.checkedIn).length;

  // Normalize available routes: use choices if provided, otherwise fall back to attached route
  const availableRoutes: ResolvedChoice[] = choices.length > 0
    ? choices
    : route
    ? [
        {
          id: route.id,
          label: `${(Math.round(route.distanceMiles * 10) / 10).toFixed(1)} mi • ${route.name}`,
          miles: Math.round(route.distanceMiles * 10) / 10,
          actualMiles: route.distanceMiles,
          route,
        },
      ]
    : [];

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
      `DESCRIPTION:${run.description}\\nDistance: ${choices.length ? choices.map((c) => `${c.miles.toFixed(1)} mi (${c.route.name})`).join(', ') : `${(Math.round(run.distanceMiles * 10) / 10).toFixed(1)} miles`}\\nSurface: ${run.surface}`,
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
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-woodland-700">
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
            {/* Highlight surface only if different from standard street pavement */}
            {run.surface && run.surface !== 'Pavement' && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  run.surface === 'Trail'
                    ? 'bg-emerald-100 text-emerald-800'
                    : run.surface === 'Track'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {run.surface} Special
              </span>
            )}
            {availableRoutes.length > 0 ? (
              availableRoutes.map((c, idx) => (
                <span
                  key={c.id || idx}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700"
                  title={`${c.route.name} • ${c.route.distanceMiles} mi`}
                >
                  {c.route.isLoop
                    ? `${c.miles.toFixed(1)} mi (${c.route.maxLoops || 4} loops)`
                    : `${c.miles.toFixed(1)} mi`}
                </span>
              ))
            ) : (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                {(Math.round(run.distanceMiles * 10) / 10).toFixed(1)} mi
              </span>
            )}
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

      {/* Available Runs & Route Names */}
      {availableRoutes.length > 0 && (
        <div className="px-5 py-2.5">
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5 text-woodland-600" />
              <span>Available Runs ({availableRoutes.length}):</span>
            </span>
            <span className="text-[10px] text-stone-400 font-normal">
              Tap Map &amp; Turns to preview course
            </span>
          </div>
          <div className="space-y-2">
            {availableRoutes.map((choice) => (
              <div
                key={choice.id || choice.route.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-stone-50 hover:bg-stone-100/80 border border-stone-200 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 flex flex-col items-center justify-center bg-woodland-700 text-white rounded-lg px-2.5 py-1 min-w-[3.75rem] shadow-2xs">
                    <span className="text-xs font-black font-mono leading-none">
                      {choice.miles.toFixed(1)}
                    </span>
                    <span className="text-[9px] font-semibold text-woodland-200 uppercase leading-tight mt-0.5">
                      miles
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-stone-900 truncate">
                      {choice.route.name}
                    </div>
                    <div className="text-[11px] text-stone-500 flex items-center gap-2 flex-wrap">
                      <span>{choice.route.surface || 'Pavement'}</span>
                      {choice.route.elevationGainFt > 0 && (
                        <span>• +{choice.route.elevationGainFt} ft gain</span>
                      )}
                      {choice.route.isLoop && (
                        <span className="text-woodland-700 font-semibold">
                          • {choice.route.maxLoops ? `1–${choice.route.maxLoops} loops` : 'Repeatable Loop'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions for this specific route */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => onViewRoute(choice.route)}
                    className="flex items-center gap-1 text-xs font-bold text-woodland-800 hover:text-woodland-950 px-2.5 py-1.5 rounded-lg bg-white hover:bg-woodland-50 border border-stone-300 shadow-2xs transition cursor-pointer"
                    title={`View map and turn-by-turn directions for ${choice.route.name}`}
                  >
                    <Map className="w-3.5 h-3.5 text-woodland-600" />
                    <span>Map &amp; Turns {choice.route.directions?.length ? `(${choice.route.directions.length})` : ''}</span>
                  </button>

                  {choice.route.externalLinks?.stravaUrl && (
                    <a
                      href={choice.route.externalLinks.stravaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-bold rounded-lg border border-orange-200 transition"
                      title="Open in Strava"
                    >
                      Strava
                    </a>
                  )}
                  {choice.route.externalLinks?.garminUrl && (
                    <a
                      href={choice.route.externalLinks.garminUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 text-xs font-bold rounded-lg border border-cyan-200 transition"
                      title="Send to Garmin"
                    >
                      Garmin
                    </a>
                  )}
                  {choice.route.externalLinks?.rungoUrl && (
                    <a
                      href={choice.route.externalLinks.rungoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg border border-emerald-200 transition"
                      title="RunGo Voice Navigation"
                    >
                      RunGo
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <strong className="text-woodland-800">{pg.label}:</strong> {pg.targetPace}
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
                className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-woodland-600 text-white text-[10px] font-bold flex items-center justify-center uppercase shadow-xs"
                title={att.name}
              >
                {att.name.charAt(0)}
              </div>
            ))}
          </div>
          <span className="text-xs text-stone-600 font-medium">
            {run.attendees.length} RSVP{run.attendees.length === 1 ? '' : 's'}
            {checkedInCount > 0 && (
              <span className="text-woodland-700 ml-1 font-semibold">
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
      <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5">
          <span>🍻</span>
          <span>Meet on patio @ Blue Note Brewing • All paces &amp; jog/walkers welcome!</span>
        </div>

        <div className="flex items-center gap-2">
          {/* RSVP Toggle */}
          <button
            onClick={() => onToggleRSVP(run.id)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              isAttending
                ? 'bg-stone-200 text-stone-800 hover:bg-stone-300'
                : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 shadow-xs'
            }`}
          >
            {isAttending ? (
              <>
                <Check className="w-3.5 h-3.5 text-woodland-600" />
                <span>Going</span>
              </>
            ) : (
              <span>RSVP</span>
            )}
          </button>

          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(run)}
              aria-label={`Edit ${run.title}`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer bg-white border border-stone-300 text-stone-700 hover:bg-stone-100"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(run)}
              aria-label={`Delete ${run.title}`}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer bg-white border border-red-200 text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}

          {/* Check-In Button */}
          {notLive ? (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
              Not live — needs a code word
            </span>
          ) : (
          <button
            onClick={() => onOpenCheckIn(run)}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              isCheckedIn
                ? 'bg-woodland-100 text-woodland-800 border border-woodland-200'
                : 'bg-woodland-600 text-white hover:bg-woodland-700 shadow-sm'
            }`}
          >
            {isCheckedIn ? (
              <>
                <Check className="w-3.5 h-3.5 text-woodland-700" />
                <span>Checked In</span>
              </>
            ) : (
              <span>Check In</span>
            )}
          </button>
          )}
        </div>
      </div>
    </div>
  );
};
