import { Modal } from './Modal';
import { formatMiles } from '../utils/miles';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { celebrate } from '../utils/celebrate';
import { milestoneProgress } from '../utils/milestones';
import { levelTag } from '../utils/badgeProgress';
import { RunEvent, MeetupEvent, UserProfile, RouteOption, ActivityType, DistanceChoice, CheckInRecord, Badge, GPXRoute } from '../types';
import { CLUB_MILESTONES } from '../data/catalog';
import type { MilestoneReward } from '../types';
import { checkInStatus, checkInWindow, formatOpening } from '../utils/checkInWindow';
import { MapViewer } from './MapViewer';
import { downloadGPXFile } from '../utils/gpxParser';
import { 
  Check,
  CheckCircle, 
  X, 
  Sparkles, 
  ExternalLink, 
  AlertCircle,
  Shirt,
  ChevronRight,
  ShieldCheck,
  Compass,
  Download,
  ArrowLeft
} from 'lucide-react';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetupEvents: MeetupEvent[];
  eventId?: string; // The run being checked into (never falls back to another run)
  candidateEventIds?: string[]; // Several runs open at once: the code word picks one
  runs?: RunEvent[]; // For showing day, time and start location of candidate runs
  onResolveCodeWord?: (date: string, codeWord: string) => Promise<string | null>;
  currentUser: UserProfile;
  milestones?: MilestoneReward[]; // The club's milestones (defaults to the built-in ones)
  routes?: GPXRoute[];
  checkins?: CheckInRecord[];
  onCheckInRunner: (params: {
    eventId: string;
    userEmail: string;
    codeWordEntered: string;
    activity: ActivityType;
    distanceChoice: DistanceChoice;
    loops?: number;
    withPet?: boolean;
  }) => Promise<{
    success: boolean;
    message: string;
    route?: RouteOption;
    checkIn?: CheckInRecord;
    user?: UserProfile;
    newBadges?: Badge[];
    milestoneAlert?: any;
  }>;
  onLoadRoute?: (id: string) => Promise<GPXRoute>;
  onOpenAuthModal?: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  isOpen,
  onClose,
  meetupEvents,
  eventId,
  candidateEventIds,
  runs = [],
  onResolveCodeWord,
  currentUser,
  milestones = CLUB_MILESTONES,
  routes,
  checkins,
  onCheckInRunner,
  onOpenAuthModal,
  onLoadRoute,
}) => {
  // The check-in event for exactly this run. Never fall back to another run:
  // that showed the wrong routes and the server rejected the check-in.
  // When several runs are open, the runner's code word picks the run.
  const [resolvedEventId, setResolvedEventId] = useState<string | null>(null);
  const [chooserWord, setChooserWord] = useState<string>('');
  const [chooserError, setChooserError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const selectedEventId = resolvedEventId || eventId || (candidateEventIds?.length === 1 ? candidateEventIds[0] : undefined);
  const isChoosingRun = !selectedEventId && (candidateEventIds?.length || 0) > 1;
  const matchedEvent = selectedEventId ? meetupEvents.find((e) => e.id === selectedEventId) : undefined;
  const activeEvent: MeetupEvent = useMemo(() => matchedEvent || {
    id: selectedEventId || '',
    date: '',
    title: 'Check-in',
    codeWord: '',
    activeDistances: [],
    routes: {},
  }, [matchedEvent, selectedEventId]);
  const eventStatus = matchedEvent ? checkInStatus(matchedEvent) : null;

  const isGuest = currentUser.role === 'guest' || !currentUser.email;

  // Check if current user is already checked in for this event date
  const existingCheckIn = useMemo(() => {
    if (!currentUser.email || !checkins) return null;
    const cleanEmail = currentUser.email.toLowerCase().trim();
    return checkins.find((c) => c.id === `${activeEvent.id}_${cleanEmail}`) || null;
  }, [checkins, activeEvent.id, currentUser.email]);

  const [isEditingCheckIn, setIsEditingCheckIn] = useState<boolean>(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Build list of available route options for tonight's run
  const availableOptions = useMemo(() => {
    const list: { key: string; route: RouteOption }[] = [];
    if (activeEvent && activeEvent.routes) {
      const keys = activeEvent.activeDistances
        ? activeEvent.activeDistances
        : Object.keys(activeEvent.routes);

      const seen = new Set<string>();
      for (const k of keys) {
        const r = activeEvent.routes[k];
        const identity = r?.routeId || (activeEvent.activeDistances?.length ? k : r?.name + String(r?.actualMiles));
        if (r && !seen.has(identity)) {
          seen.add(identity);
          list.push({ key: k, route: r });
        }
      }
    }
    return list;
  }, [activeEvent]);

  // State
  const [codeWordInput, setCodeWordInput] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>(() => {
    return existingCheckIn?.activity || 'running';
  });
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>(() => {
    if (existingCheckIn) {
      const match = availableOptions.find(
        (o) => o.key === String(existingCheckIn.distanceChoice) ||
               o.route.name === existingCheckIn.routeName ||
               Math.abs(o.route.actualMiles - existingCheckIn.actualMiles) < 0.1
      );
      if (match) return match.key;
    }
    return availableOptions[0]?.key || '';
  });
  const [loopSelections, setLoopSelections] = useState<Record<string, number>>(() => {
    if (existingCheckIn && existingCheckIn.loops) {
      return { [String(existingCheckIn.distanceChoice)]: existingCheckIn.loops };
    }
    return {};
  });

  const selectedOption = useMemo(() => {
    return availableOptions.find((o) => o.key === selectedOptionKey) || availableOptions[0];
  }, [availableOptions, selectedOptionKey]);

  const currentLoops = selectedOption?.route?.isLoop ? (loopSelections[selectedOptionKey] || 1) : 1;
  const baseMiles = selectedOption?.route?.baseMiles || selectedOption?.route?.actualMiles || 0;
  const creditedMiles = selectedOption?.route?.isLoop
    ? Math.round(baseMiles * currentLoops * 100) / 100
    : (selectedOption?.route?.actualMiles || 0);
  const [runningWithPet, setRunningWithPet] = useState<boolean>(() => {
    return Boolean(existingCheckIn?.withPet);
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Success state
  const [successResult, setSuccessResult] = useState<{
    message: string;
    route?: RouteOption;
    checkIn?: CheckInRecord;
    user?: UserProfile;
    newBadges?: Badge[];
  } | null>(null);

  const [postCheckInStep, setPostCheckInStep] = useState<'run_info' | 'rewards'>('run_info');

  useEffect(() => {
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [errorMsg, postCheckInStep, isEditingCheckIn]);

  const [loadedInfoRoute, setLoadedInfoRoute] = useState<GPXRoute>();
  const matchedGpxRoute: GPXRoute = useMemo(() => {
    const activeRec = successResult?.checkIn || existingCheckIn;
    const optRoute = isEditingCheckIn
      ? selectedOption?.route
      : (successResult?.route || (activeRec ? {
          ...activeEvent.routes[String(activeRec.distanceChoice)],
          routeId: activeEvent.routes[String(activeRec.distanceChoice)]?.routeId || String(activeRec.distanceChoice),
          name: activeRec.routeName || '', actualMiles: activeRec.actualMiles,
        } : selectedOption?.route));
    let found: GPXRoute | undefined;
    if (optRoute?.routeId && routes) {
      found = routes.find((r) => r.id === optRoute.routeId);
    }
    if (!found && optRoute && routes) {
      found = routes.find(
        (r) => r.name.toLowerCase() === optRoute.name.toLowerCase()
      );
    }


    if (loadedInfoRoute && (loadedInfoRoute.id === optRoute?.routeId || loadedInfoRoute.id === found?.id)) found = loadedInfoRoute;
    const extLinks = {
      stravaUrl: found?.externalLinks?.stravaUrl || optRoute?.externalLinks?.stravaUrl || (optRoute?.routeUrl?.includes('strava') ? optRoute.routeUrl : undefined),
      garminUrl: found?.externalLinks?.garminUrl || optRoute?.externalLinks?.garminUrl || (optRoute?.routeUrl?.includes('garmin') ? optRoute.routeUrl : undefined),
      rungoUrl: found?.externalLinks?.rungoUrl || optRoute?.externalLinks?.rungoUrl || (optRoute?.routeUrl?.includes('rungo') ? optRoute.routeUrl : undefined),
    };

    if (found) {
      return {
        ...found,
        name: optRoute?.name || found.name,
        distanceMiles: optRoute?.actualMiles || found.distanceMiles,
        description: optRoute?.directions || found.description,
        externalLinks: extLinks,
        directions: (found.directions && found.directions.length > 0) ? found.directions : (optRoute?.directionsList || found.directions),
      };
    }

    return {
      id: optRoute?.routeId || 'default-route',
      detailsLoaded: false,
      name: optRoute?.name || 'Woodland Woodchuckers Route',
      description: optRoute?.directions || 'Route details are not available for this check-in.',
      distanceMiles: optRoute?.actualMiles || creditedMiles,
      elevationGainFt: 0,
      surface: 'Pavement',
      difficulty: 'Easy',
      // No library route matched: no map (never show another route's map).
      points: [],
      externalLinks: extLinks,
      directions: optRoute?.directionsList,
      createdAt: new Date().toISOString(),
    };
  }, [successResult, existingCheckIn, isEditingCheckIn, selectedOption, routes, creditedMiles, activeEvent.routes, loadedInfoRoute]);
  const [routeInfoError, setRouteInfoError] = useState<string>();
  const [routeInfoAttempt, setRouteInfoAttempt] = useState(0);
  const routeLoader = useRef(onLoadRoute); routeLoader.current = onLoadRoute;
  useEffect(() => {
    if (!isOpen || (!successResult && !existingCheckIn) || isEditingCheckIn || postCheckInStep !== 'run_info' || matchedGpxRoute.detailsLoaded !== false || matchedGpxRoute.id === 'default-route' || !routeLoader.current) return;
    let current = true; setRouteInfoError(undefined);
    routeLoader.current(matchedGpxRoute.id).then((full) => { if (current) setLoadedInfoRoute(full); }).catch((cause) => { if (current) setRouteInfoError(cause instanceof Error ? cause.message : 'The route map could not be loaded.'); });
    return () => { current = false; };
    // Reward/state updates must not restart the same public detail request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, Boolean(successResult || existingCheckIn), isEditingCheckIn, postCheckInStep, matchedGpxRoute.id, matchedGpxRoute.detailsLoaded, routeInfoAttempt]);


  if (!isOpen) return null;

  // Several runs open right now: the code word decides which run this is.
  if (isChoosingRun) {
    const candidates = (candidateEventIds || [])
      .map((id) => meetupEvents.find((e) => e.id === id))
      .filter((e): e is MeetupEvent => Boolean(e));
    const findRun = async (e: React.FormEvent) => {
      e.preventDefault();
      setChooserError(null);
      const word = chooserWord.trim().toUpperCase();
      if (!word) {
        setChooserError("Enter your run's code word.");
        return;
      }
      setIsResolving(true);
      try {
        let found: string | null = null;
        for (const date of [...new Set(candidates.map((c) => c.date))]) {
          const rid = onResolveCodeWord ? await onResolveCodeWord(date, word) : null;
          if (rid && candidates.some((c) => c.id === rid)) {
            found = rid;
            break;
          }
        }
        if (!found) {
          setChooserError("That code word doesn't match any run open right now. Double-check the word the organizer announced.");
          return;
        }
        const resolvedEvent = candidates.find((c) => c.id === found)!;
        setSelectedOptionKey(resolvedEvent.activeDistances?.[0] || Object.keys(resolvedEvent.routes)[0] || '');
        setCodeWordInput(word);
        setResolvedEventId(found);
      } catch (err) {
        console.error('Code word lookup failed:', err);
        setChooserError('Could not check the code word. Please check your connection and try again.');
      } finally {
        setIsResolving(false);
      }
    };
    return (
      <Modal title="Run check-in" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4">
        <form onSubmit={findRun} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 space-y-4">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition">
            <X className="w-5 h-5" />
          </button>
          <div className="text-center space-y-1">
            <div className="text-4xl" aria-hidden="true">🦫</div>
            <h3 id="choose-run-title" className="text-lg font-display font-black uppercase tracking-wide text-stone-900">
              Which run are you doing?
            </h3>
            <p className="text-xs text-stone-600">More than one run is open right now. Enter your run&apos;s code word to check in.</p>
          </div>
          <ul className="space-y-2">
            {candidates.map((ev) => {
              const run = runs.find((r) => r.id === ev.id);
              const day = new Date(`${ev.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              return (
                <li key={ev.id} className="p-3 rounded-xl border border-stone-200 bg-stone-50 text-xs">
                  <div className="font-bold text-stone-900">{ev.title}</div>
                  <div className="text-stone-600">
                    {day}{ev.time ? ` · ${ev.time}` : ''}{run?.locationName ? ` · ${run.locationName}` : ''}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="space-y-1.5">
            <label htmlFor="chooser-code-word" className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
              Code word
            </label>
            <input
              id="chooser-code-word"
              type="text"
              value={chooserWord}
              onChange={(e) => setChooserWord(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="e.g. TURKEY"
              className="w-full uppercase font-mono tracking-widest text-base font-bold px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
            />
            {chooserError && <p className="text-xs text-red-600 font-semibold">{chooserError}</p>}
          </div>
          <button
            type="submit"
            disabled={isResolving}
            className="w-full py-2.5 bg-woodland-700 hover:bg-woodland-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition"
          >
            {isResolving ? 'Checking…' : 'Find my run'}
          </button>
        </form>
      </Modal>
    );
  }

  // Check-in only while this run's window is open (2 hours before start until midnight).
  if (eventStatus !== 'open') {
    const message = !matchedEvent
      ? "Check-in isn't set up for this run yet."
      : eventStatus === 'not_open'
        ? `Check-in for this run opens ${formatOpening(checkInWindow(matchedEvent).opensAt)}.`
        : 'Check-in for this run closed at midnight on the day of the run.';
    return (
      <Modal title="Run check-in" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4">
        <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 text-center space-y-4">
          <div className="text-4xl" aria-hidden="true">🦫</div>
          <h3 id="checkin-closed-title" className="text-lg font-display font-black uppercase tracking-wide text-stone-900">
            {matchedEvent ? matchedEvent.title : 'Check-in'}
          </h3>
          <p className="text-sm text-stone-700">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-sm rounded-xl transition"
          >
            OK
          </button>
        </div>
      </Modal>
    );
  }

  if (isGuest) {
    return (
      <Modal title="Run check-in" onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen py-6 sm:py-8">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in duration-200 p-6 sm:p-8 text-center space-y-5">
          <button aria-label="Close window"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-stone-950 flex items-center justify-center mx-auto shadow-md">
            <Sparkles className="w-8 h-8 text-stone-950" />
          </div>

          <div>
            <h3 className="text-xl font-display font-black text-stone-900 uppercase tracking-wide">
              Sign In to Check In
            </h3>
            <p className="text-xs text-stone-600 mt-2 leading-relaxed">
              Check into <strong>{activeEvent.title}</strong> ({activeEvent.date}), log your miles, and earn official Woodchucker milestone shirts &amp; badges.
            </p>
          </div>

          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Free Club Membership</span>
            </div>
            <p className="text-xs text-amber-900 leading-snug">
              Sign in with your Google account or email link. If it&apos;s your first time, you&apos;ll set up your runner profile and link past club runs in seconds.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuthModal?.();
            }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm rounded-xl transition shadow-sm font-display uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Sign In / Join Club to Check In</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-bold text-stone-500 hover:text-stone-800 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </Modal>
    );
  }

  const handlePerformCheckIn = async () => {
    if (submittingRef.current) return;
    setErrorMsg(null);
    if (navigator.onLine === false) {
      setErrorMsg("You're offline. Reconnect, then try again. Your choices are still here while this window stays open; they have not been saved.");
      return;
    }
    if (!selectedOption) {
      setErrorMsg('No routes are configured for this run. Please ask an organizer to add a route.');
      return;
    }
    const effectiveCodeWord = codeWordInput.trim() || (existingCheckIn ? (existingCheckIn.codeWord || activeEvent.codeWord) : '');
    if (!effectiveCodeWord) {
      setErrorMsg("Please enter today's code word!");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
    // The code word identifies the run; catch a word that belongs to a different run.
    if (!existingCheckIn && onResolveCodeWord) {
      try {
        const rid = await onResolveCodeWord(activeEvent.date, effectiveCodeWord);
        if (rid && rid !== activeEvent.id) {
          const other = meetupEvents.find((e) => e.id === rid);
          setErrorMsg(`That code word is for another run${other ? `: ${other.title}${other.time ? ` at ${other.time}` : ''}` : ''}. Check you're checking into the right run.`);
          return;
        }
        if (!rid) {
          setErrorMsg("That code word doesn't match this run. Double-check the word the organizer announced.");
          return;
        }
      } catch (err) {
        console.warn('Code word lookup failed; letting the server decide:', err);
      }
    }

      const res = await onCheckInRunner({
        eventId: activeEvent.id,
        userEmail: currentUser.email,
        codeWordEntered: effectiveCodeWord,
        activity: selectedActivity,
        distanceChoice: selectedOption.key,
        loops: currentLoops,
        withPet: runningWithPet,
      });

      if (!res.success) {
        setErrorMsg(res.message);
        setIsSubmitting(false);
        return;
      }

      // Trigger celebratory woodchuck confetti!
      celebrate('check-in');

      setPostCheckInStep('run_info');
      setIsEditingCheckIn(false);
      setSuccessResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error during check-in.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Milestone helpers
  const activeUserRuns = successResult?.user?.totalRuns ?? currentUser.totalRuns;
  const { nextMilestone, runsRemaining, progressPercent: progressPct } = milestoneProgress(activeUserRuns, milestones);
  const justUnlockedMilestone = milestones.find((m) => m.runsRequired === activeUserRuns) || null;

  const activeCheckIn = successResult?.checkIn || existingCheckIn;

  return (
    <Modal title="Run check-in" onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex justify-center p-3 sm:p-4 min-h-screen py-6 sm:py-8">
      <div className="relative w-full max-w-xl m-auto max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="shrink-0 bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-xl shadow-md">
              🦫
            </div>
            <div>
              <h2 className="text-lg font-display font-extrabold tracking-wide uppercase">
                {activeEvent.title}
              </h2>
              <p className="text-xs text-woodland-200">
                {activeEvent.date} • Blue Note Brewing Co.
              </p>
            </div>
          </div>
          <button aria-label="Close window"
            onClick={onClose}
            className="p-2 text-stone-300 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div ref={modalBodyRef} className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW 1: SUCCESS POST-CHECK-IN FLOW */}
          {((successResult || existingCheckIn) && !isEditingCheckIn) ? (
            postCheckInStep === 'run_info' ? (
              /* PAGE 1: RUN INFORMATION (APPS, MAP, TURN-BY-TURN) */
              <div className="text-left space-y-4 animate-in fade-in duration-200">
                {/* Check-In Success Header Banner */}
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                          <Check className="w-3 h-3 stroke-[3]" />
                          {existingCheckIn && !successResult ? "You're Checked In!" : "Checked In!"}
                        </span>
                        {successResult?.newBadges && successResult.newBadges.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-black uppercase tracking-wider animate-pulse">
                            <Sparkles className="w-3 h-3" />
                            +{successResult.newBadges.length} Badge{successResult.newBadges.length > 1 ? 's' : ''} Earned!
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-stone-900 font-display mt-0.5">
                        Boom, {currentUser.firstName}! 🎉
                      </h3>
                      <p className="text-xs text-stone-600">
                        Checked in for <strong className="text-stone-900">{matchedGpxRoute.name}</strong> ({activeCheckIn?.actualMiles || creditedMiles} mi {activeCheckIn?.activity || selectedActivity}{(activeCheckIn?.loops || currentLoops) > 1 ? ` • ${activeCheckIn?.loops || currentLoops} loops` : ''}).
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-stone-600">
                  Your check-in is saved. Route information and milestones are optional; you can close this window now.
                </p>

                {/* Change Route or Distance Button */}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    const saved = existingCheckIn || successResult?.checkIn;
                    if (saved) {
                      const oldOption = activeEvent.routes[String(saved.distanceChoice)];
                      const option = availableOptions.find((o) => o.key === String(saved.distanceChoice)) ||
                        availableOptions.find((o) => oldOption?.routeId && o.route.routeId === oldOption.routeId) ||
                        availableOptions.find((o) => o.route.name === saved.routeName);
                      const key = option?.key || availableOptions[0]?.key || '';
                      setSelectedOptionKey(key);
                      setSelectedActivity(saved.activity);
                      setRunningWithPet(Boolean(saved.withPet));
                      setLoopSelections((prev) => ({ ...prev, [key]: saved.loops || 1 }));
                      setCodeWordInput(saved.codeWord || activeEvent.codeWord || '');
                    }
                    setIsEditingCheckIn(true);
                  }}
                  className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-stone-300 shadow-2xs cursor-pointer"
                >
                  <span>✏️ Change Distance / Update Check-In</span>
                </button>

                {/* 1) Click on Strava / Garmin / RunGo / GPX */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700 px-0.5">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-stone-600">
                      <span>📱</span> 1. Follow On Phone or Watch:
                    </span>
                    <span className="text-[10px] text-stone-400 font-normal">Tap to launch app or download</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Strava */}
                    {matchedGpxRoute.externalLinks?.stravaUrl?.trim() && (
                      <a
                        href={matchedGpxRoute.externalLinks.stravaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200/90 text-orange-950 font-bold transition shadow-2xs group text-center"
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">🟠</span>
                        <span className="text-xs font-extrabold mt-0.5">Strava</span>
                        <span className="text-[10px] text-orange-700 flex items-center gap-0.5">
                          Open Route <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </a>
                    )}

                    {/* Garmin */}
                    {matchedGpxRoute.externalLinks?.garminUrl?.trim() && (
                      <a
                        href={matchedGpxRoute.externalLinks.garminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200/90 text-cyan-950 font-bold transition shadow-2xs group text-center"
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">🔵</span>
                        <span className="text-xs font-extrabold mt-0.5">Garmin</span>
                        <span className="text-[10px] text-cyan-700 flex items-center gap-0.5">
                          Send to Watch <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </a>
                    )}

                    {/* RunGo */}
                    {matchedGpxRoute.externalLinks?.rungoUrl?.trim() && (
                      <a
                        href={matchedGpxRoute.externalLinks.rungoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 text-emerald-950 font-bold transition shadow-2xs group text-center"
                      >
                        <span className="text-lg group-hover:scale-110 transition-transform">🟢</span>
                        <span className="text-xs font-extrabold mt-0.5">RunGo</span>
                        <span className="text-[10px] text-emerald-700 flex items-center gap-0.5">
                          Voice Nav <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </a>
                    )}

                    {/* Download GPX */}
                {matchedGpxRoute.points.length > 0 && (
                    <button
                      type="button"
                      onClick={() => downloadGPXFile(matchedGpxRoute)}
                      className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold transition shadow-xs group text-center cursor-pointer"
                    >
                      <span className="text-lg group-hover:scale-110 transition-transform">📥</span>
                      <span className="text-xs font-extrabold mt-0.5">GPX File</span>
                      <span className="text-[10px] text-stone-300 flex items-center gap-0.5">
                        Download <Download className="w-2.5 h-2.5" />
                      </span>
                    </button>
                    )}
                  </div>
                </div>

                {/* 2) Map of the run & 3) Turn by turn instructions */}
                    {matchedGpxRoute.detailsLoaded === false && matchedGpxRoute.id !== 'default-route' && onLoadRoute && <div role={routeInfoError ? 'alert' : 'status'} className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">{routeInfoError || 'Loading route map and directions…'}{routeInfoError && <button type="button" className="ml-2 font-bold underline" onClick={() => setRouteInfoAttempt((n) => n + 1)}>Retry map</button>}</div>}

                {matchedGpxRoute.points.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-stone-700 px-0.5">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-stone-600">
                      <Compass className="w-3.5 h-3.5 text-woodland-600" /> 2. Interactive Map &amp; Turn-by-Turn:
                    </span>
                    <span className="text-[10px] text-stone-500 font-semibold">Blue Note Brewing (Start/End)</span>
                  </div>

                  <MapViewer
                    route={matchedGpxRoute}
                    height="260px"
                    showElevationProfile={false}
                    hideHeader={true}
                    hideActionBar={true}
                  />
                </div>
                )}

                {/* Next Page Navigation Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      celebrate('rewards');
                      setPostCheckInStep('rewards');
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-600 hover:to-amber-500 text-stone-950 font-black text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 font-display uppercase tracking-wider cursor-pointer"
                  >
                    <span>Next: View Badges &amp; Milestones</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              /* PAGE 2: BADGES, MILESTONES & REWARDS CELEBRATION */
              <div className="text-center py-2 space-y-5 animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-inner border border-amber-200">
                  <Sparkles className="w-9 h-9" />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Milestones &amp; Badges
                  </span>
                  <h3 className="text-2xl font-black text-stone-900 font-display">
                    Achievements, {currentUser.firstName}! 🎉
                  </h3>
                  <p className="text-sm text-stone-600 mt-1">
                    Here is your updated club progress for tonight's run.
                  </p>
                </div>

                {/* Badge Unlock Celebration Card */}
                {successResult?.newBadges && successResult.newBadges.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/15 border-2 border-amber-400/80 rounded-2xl p-4 text-left space-y-2.5 shadow-sm animate-in zoom-in-95">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-900">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>{successResult.newBadges.length === 1 ? 'New Badge Unlocked!' : 'New Badges Unlocked!'} 🏅</span>
                      </span>
                      <span className="text-[10px] font-bold bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full">
                        +{successResult.newBadges.length} Badge{successResult.newBadges.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {successResult.newBadges.map((badge) => {
                        const count = successResult.user?.badgeCounts?.[badge.id] || 1;
                        return (
                          <div key={badge.id} className="flex items-center gap-3 bg-white/95 p-2.5 rounded-xl border border-amber-200/90 shadow-xs">
                            <span className="text-2xl shrink-0">{badge.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-stone-900 truncate">{badge.name}</span>
                                {badge.isIncremental && count > 1 && (
                                  <span className="px-1.5 py-0.2 bg-amber-400 text-stone-950 font-black text-[10px] rounded-full shrink-0">
                                    {levelTag(badge, count)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-600 line-clamp-1">{badge.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Milestone & Mileage Progress Box */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left space-y-3">
                  {/* Instant Milestone Alert Callout if runner just unlocked 5, 50, 100, 200 */}
                  {justUnlockedMilestone && (
                    <div className="bg-gradient-to-r from-amber-500 to-amber-400 text-stone-950 rounded-xl p-3.5 shadow-md border border-amber-600 space-y-1.5 animate-in zoom-in-95">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-stone-950">
                        <Sparkles className="w-4 h-4 text-stone-950 shrink-0" />
                        <span>{justUnlockedMilestone.hasGear === false ? '🎉 Welcome to the pack!' : '🎉 Major Milestone Unlocked!'}</span>
                      </div>
                      <div className="font-extrabold text-sm sm:text-base font-display uppercase tracking-tight">
                        {justUnlockedMilestone.hasGear === false ? justUnlockedMilestone.name : `${justUnlockedMilestone.name}: ${justUnlockedMilestone.reward}`}
                      </div>
                      <p className="text-xs text-stone-900 font-medium leading-snug">
                        {justUnlockedMilestone.hasGear === false ? (
                          <>That&apos;s your first Woodchucker run. Say hi to tonight&apos;s run organizer, who will welcome you to the club!</>
                        ) : (
                          <>Tonight&apos;s run organizer has been alerted with your shirt size (<strong className="font-bold">{successResult?.user?.shirtSize || currentUser.shirtSize}</strong>). Pick up your gear at the organizer table, and show your phone for {justUnlockedMilestone.perks}!</>
                        )}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-stone-600 flex items-center gap-1.5">
                      <Shirt className="w-4 h-4 text-amber-500" />
                      Milestone Progress
                    </span>
                    <span className="text-amber-700 font-bold">
                      {activeUserRuns} / {nextMilestone ? nextMilestone.runsRequired : 200} Runs
                    </span>
                  </div>
                  <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-stone-500">
                    {nextMilestone && runsRemaining > 0
                      ? `Only ${runsRemaining} more run${runsRemaining > 1 ? 's' : ''} until you unlock your ${nextMilestone.reward}!`
                      : `Congratulations! You have reached Double Century Legend status (200+ runs)!`}
                  </p>

                  <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                    <span className="text-stone-600">Lifetime Club Mileage:</span>
                    <span className="font-extrabold text-stone-900">
                      {successResult?.user?.totalMiles || currentUser.totalMiles} Miles
                    </span>
                  </div>
                </div>

                {/* Buttons: Done and Back to Run Info */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl transition shadow-md font-display uppercase tracking-wider cursor-pointer"
                  >
                    Done • Let's Run! 🦫
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostCheckInStep('run_info')}
                    className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Run Map &amp; Directions</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            /* CHECK-IN FORM (the window is open: checked before this view renders) */
            <div className="space-y-5">
              {/* Runner ID Banner */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-woodland-800 text-white flex items-center justify-center font-bold text-sm">
                    {currentUser.firstName[0]}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      {currentUser.displayName}
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                        {currentUser.totalRuns} Runs
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500">{currentUser.email}</div>
                  </div>
                </div>

              </div>

              {/* Updating Existing Check-in Banner */}
              {existingCheckIn && (
                <div className="bg-amber-50 border border-amber-300/90 rounded-2xl p-3.5 flex items-start justify-between gap-3 text-xs text-amber-950 shadow-2xs">
                  <div>
                    <div className="font-extrabold flex items-center gap-1.5 text-sm">
                      <span>✏️</span> Updating Your Check-In
                    </div>
                    <p className="text-amber-900 mt-1 leading-relaxed">
                      Currently registered: <strong>{existingCheckIn.routeName}</strong> ({existingCheckIn.actualMiles} mi {existingCheckIn.activity}). Choose your updated route below and tap <strong>Save &amp; Update Check-In</strong>:
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setIsEditingCheckIn(false);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-stone-50 text-stone-700 font-bold rounded-lg border border-amber-200 shrink-0 cursor-pointer shadow-2xs"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Step 1: Code Word */}
              {existingCheckIn ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Code Word Verified for Today:</span>
                  </div>
                  <span className="font-mono font-bold bg-emerald-200/90 text-emerald-950 px-2.5 py-0.5 rounded-lg text-xs tracking-wider">
                    {existingCheckIn.codeWord || activeEvent.codeWord || '✓'}
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                    1. Today's Code Word
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={codeWordInput}
                      onChange={(e) => setCodeWordInput(e.target.value)}
                      placeholder="Enter today's code word (e.g. TURKEY)"
                      className="w-full uppercase font-mono tracking-widest text-base sm:text-lg font-bold px-4 py-3 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                    />
                    <div className="absolute right-3 top-3 text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-1 rounded-md">
                      Required
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Announced by the run organizer before the run starts!
                  </p>
                </div>
              )}

              {/* Step 2: Activity (Run vs Walk) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  2. Activity Tonight
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedActivity('running')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition ${
                      selectedActivity === 'running'
                        ? 'bg-woodland-900 text-white border-woodland-900 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <span>🏃 Running</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedActivity('walking')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition ${
                      selectedActivity === 'walking'
                        ? 'bg-woodland-900 text-white border-woodland-900 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <span>🚶 Walking</span>
                  </button>
                </div>
              </div>

              {/* Step 3: Distance / Route Choice */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                    3. Choose Your Route Distance
                  </label>
                  <span className="text-[11px] text-stone-500 font-medium">
                    {availableOptions.length} option{availableOptions.length === 1 ? '' : 's'} available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availableOptions.length === 0 && (
                    <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      No routes are configured for this run. Please ask an organizer to add a route before checking in.
                    </p>
                  )}
                  {availableOptions.map((opt) => {
                    const isSelected = selectedOptionKey === opt.key;
                    const optLoops = opt.route.isLoop ? (loopSelections[opt.key] || 1) : 1;
                    const optBaseMiles = opt.route.baseMiles || opt.route.actualMiles;
                    const optTotalMiles = opt.route.isLoop ? (optBaseMiles * optLoops) : opt.route.actualMiles;
                    const optFormattedMiles = formatMiles(optTotalMiles);
                    // The route's loop setting is the most a runner can log (the rules enforce it).
                    const maxPresets = Math.min(20, Math.max(1, opt.route.maxLoops || 4));

                    return (
                      <div
                        key={opt.key}
                        onClick={() => setSelectedOptionKey(opt.key)}
                        className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/80 shadow-xs'
                            : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black font-display text-stone-950">
                                {optFormattedMiles} mi
                              </span>
                              {opt.route.isLoop && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-950">
                                  🔄 {optLoops} {optLoops === 1 ? 'Loop' : 'Loops'}
                                </span>
                              )}
                            </div>
                            <h5 className="font-extrabold text-xs text-stone-900 mt-0.5 truncate">
                              {opt.route.name}
                            </h5>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                              isSelected
                                ? 'border-amber-600 bg-amber-500 text-stone-950'
                                : 'border-stone-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Interactive Loop Selector if this is a multi-lap loop course */}
                        {opt.route.isLoop && (
                          <fieldset
                            className={`mt-4 rounded-xl border-2 p-3 ${isSelected ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <legend className="px-1 text-sm font-black text-stone-950">How many loops are you doing?</legend>
                            <p className="mb-3 text-xs text-stone-600">Choose below · {formatMiles(optBaseMiles)} mi per loop</p>
                            <div className={`grid gap-2 ${maxPresets === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                              {Array.from({ length: maxPresets }, (_, i) => i + 1).map((n) => {
                                const loopMiles = formatMiles(optBaseMiles * n);
                                const isActive = isSelected && optLoops === n;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    aria-pressed={isActive}
                                    aria-label={`${n} ${n === 1 ? 'loop' : 'loops'}, ${loopMiles} miles total for ${opt.route.name}`}
                                    onClick={() => {
                                      setLoopSelections((prev) => ({ ...prev, [opt.key]: n }));
                                      setSelectedOptionKey(opt.key);
                                    }}
                                    className={`${maxPresets > 1 && maxPresets % 2 === 1 && n === maxPresets ? 'col-span-2' : ''} min-h-[76px] rounded-xl border-2 px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 ${
                                      isActive
                                        ? 'border-woodland-900 bg-woodland-900 text-white shadow-sm'
                                        : 'border-stone-300 bg-white text-stone-900 hover:border-woodland-600 hover:bg-woodland-50'
                                    }`}
                                  >
                                    <span className="flex items-center justify-between gap-2 text-base font-black">
                                      <span>{n} {n === 1 ? 'loop' : 'loops'}</span>
                                      {isActive && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                                    </span>
                                    <span className={`mt-1 block text-xs font-semibold ${isActive ? 'text-amber-200' : 'text-stone-600'}`}>{loopMiles} mi total</span>
                                  </button>
                                );
                              })}
                            </div>
                            {isSelected && <p className="mt-3 text-xs font-bold text-woodland-900">Selected: {optLoops} {optLoops === 1 ? 'loop' : 'loops'} · {optFormattedMiles} mi total</p>}
                          </fieldset>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-stone-500 pt-0.5">
                  Select your target route distance. All runs start and finish at Blue Note Brewing.
                </p>
              </div>

              {/* Step 4: Running with a Pet Checkoff */}
              <div 
                onClick={() => setRunningWithPet(!runningWithPet)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                  runningWithPet
                    ? 'bg-amber-100/80 border-amber-400 shadow-xs'
                    : 'bg-stone-50 border-stone-200 hover:bg-stone-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center text-xl shrink-0 shadow-xs">
                    🐕
                  </div>
                  <div>
                    <label htmlFor="runningWithPetCheckbox" className="text-xs font-bold text-stone-900 cursor-pointer flex items-center gap-1.5">
                      <span>Running or Walking with a Pet?</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full font-black">
                        🐾 Badge Track
                      </span>
                    </label>
                    <span className="text-[11px] text-stone-600 block leading-tight mt-0.5">
                      Check off to earn &amp; level up your <strong>Woodchuck Hound</strong> badge (levels up to 10+)!
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  id="runningWithPetCheckbox"
                  checked={runningWithPet}
                  onChange={(e) => setRunningWithPet(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-5 h-5 text-amber-600 rounded border-stone-300 focus:ring-amber-500 cursor-pointer shrink-0 ml-2"
                />
              </div>

              {/* Submit Buttons */}
              <div className="space-y-2 mt-4">
                <button
                  type="button"
                  onClick={handlePerformCheckIn}
                  disabled={isSubmitting || !selectedOption}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-stone-950 font-black text-base rounded-2xl transition shadow-lg flex items-center justify-center gap-2 font-display uppercase tracking-wide cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5 text-stone-950" />
                  <span>
                    {isSubmitting
                      ? (existingCheckIn ? 'Updating Check-In...' : 'Checking In...')
                      : existingCheckIn
                      ? `Save & Update Check-In (${creditedMiles.toFixed(1)} mi) →`
                      : selectedOption?.route?.isLoop
                      ? `Check In for ${currentLoops} ${currentLoops === 1 ? 'Loop' : 'Loops'} (${creditedMiles.toFixed(1)} mi) 🦫`
                      : `Check In for ${creditedMiles.toFixed(1)} mi 🦫`}
                  </span>
                </button>

                {existingCheckIn && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setIsEditingCheckIn(false);
                    }}
                    className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Cancel &amp; Keep Current Route ({existingCheckIn.actualMiles} mi)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
