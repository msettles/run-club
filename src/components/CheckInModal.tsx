import React, { useState, useMemo, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RunEvent, MeetupEvent, UserProfile, RouteOption, ActivityType, DistanceChoice, CheckInRecord, LegacyMember, Badge, GPXRoute } from '../types';
import { CLUB_MILESTONES } from '../data/initialData';
import { calculateAge } from '../utils/dateUtils';
import { isStaffProfile } from '../utils/roles';
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
  Clock,
  Lock,
  Unlock,
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
  routes?: GPXRoute[];
  checkins?: CheckInRecord[];
  initialMode?: 'checkin' | 'register';
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
  onRegisterUser: (
    profileData: {
      email: string;
      firstName: string;
      lastName: string;
      shirtSize: string;
      birthday?: string;
      age?: number;
      city?: string;
      zipCode?: string;
    },
    claimedLegacyNames?: string[]
  ) => Promise<UserProfile>;
  onSearchLegacy: (query: string) => LegacyMember[];
  onOpenAuthModal?: () => void;
}

function parseEventDateTime(dateStr: string, timeStr: string = '06:00 PM'): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  let hour = 18;
  let minute = 0;
  if (timeStr) {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      hour = parseInt(match[1], 10);
      minute = parseInt(match[2], 10);
      const ampm = match[3]?.toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
    }
  }
  return new Date(year, month - 1, day, hour, minute);
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
  routes,
  checkins,
  initialMode = 'checkin',
  onCheckInRunner,
  onRegisterUser,
  onSearchLegacy,
  onOpenAuthModal,
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
  const activeEvent: MeetupEvent = matchedEvent || {
    id: selectedEventId || '',
    date: '',
    title: 'Check-in',
    codeWord: '',
    activeDistances: [],
    routes: {},
  };
  const eventStatus = matchedEvent ? checkInStatus(matchedEvent) : null;

  const isGuest = currentUser.role === 'guest' || !currentUser.email;
  const isOrganizerOrAdmin = isStaffProfile(currentUser);

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
      const keys = (activeEvent.activeDistances && activeEvent.activeDistances.length > 0)
        ? activeEvent.activeDistances
        : Object.keys(activeEvent.routes);

      const seen = new Set<string>();
      for (const k of keys) {
        const r = activeEvent.routes[k];
        if (r && !seen.has(r.name + r.actualMiles)) {
          seen.add(r.name + r.actualMiles);
          list.push({ key: k, route: r });
        }
      }
    }
    if (list.length === 0) {
      list.push(
        { key: '1', route: { name: '1-Mile Club Route', actualMiles: 1.15 } },
        { key: '3', route: { name: '3-Mile Club Route', actualMiles: 3.22 } },
        { key: '5', route: { name: '5-Mile Club Route', actualMiles: 5.12 } }
      );
    }
    return list;
  }, [activeEvent]);

  // State
  const [viewMode, setViewMode] = useState<'checkin' | 'register'>(
    initialMode === 'register' || isGuest ? 'register' : 'checkin'
  );
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
    return availableOptions[0]?.key || '3';
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [organizerBypass, setOrganizerBypass] = useState<boolean>(false);

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

  const matchedGpxRoute: GPXRoute = useMemo(() => {
    const activeRec = successResult?.checkIn || existingCheckIn;
    const optRoute = isEditingCheckIn
      ? selectedOption?.route
      : (successResult?.route || (activeRec ? { name: activeRec.routeName || '', actualMiles: activeRec.actualMiles } : selectedOption?.route));
    let found: GPXRoute | undefined;
    if (optRoute?.routeId && routes) {
      found = routes.find((r) => r.id === optRoute.routeId);
    }
    if (!found && optRoute && routes) {
      found = routes.find(
        (r) => r.name.toLowerCase() === optRoute.name.toLowerCase()
      );
    }
    if (!found && optRoute && routes) {
      found = routes.find(
        (r) => Math.abs(r.distanceMiles - optRoute.actualMiles) < 0.2
      );
    }
    if (!found && routes && routes.length > 0) {
      found = routes[0];
    }

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
      id: 'default-route',
      name: optRoute?.name || 'Woodland Woodchuckers Route',
      description: optRoute?.directions || 'Start and finish at Blue Note Brewing Co.',
      distanceMiles: optRoute?.actualMiles || creditedMiles || 3.1,
      elevationGainFt: 25,
      surface: 'Pavement',
      difficulty: 'Easy',
      points: [
        { lat: 38.6781, lon: -121.7712 },
        { lat: 38.6785, lon: -121.7680 },
        { lat: 38.6820, lon: -121.7682 },
        { lat: 38.6818, lon: -121.7715 },
        { lat: 38.6781, lon: -121.7712 },
      ],
      externalLinks: extLinks,
      directions: optRoute?.directionsList,
      createdAt: new Date().toISOString(),
    };
  }, [successResult, existingCheckIn, isEditingCheckIn, selectedOption, routes, creditedMiles]);

  // New runner onboarding state
  const [regEmail, setRegEmail] = useState<string>(currentUser.email || '');
  const [regFirstName, setRegFirstName] = useState<string>(currentUser.firstName !== 'Guest' ? currentUser.firstName : '');
  const [regLastName, setRegLastName] = useState<string>(currentUser.lastName !== 'Runner' ? currentUser.lastName : '');
  const [regShirtSize, setRegShirtSize] = useState<string>(currentUser.shirtSize || 'L');
  const [regBirthday, setRegBirthday] = useState<string>(currentUser.birthday || '');
  const [regZip, setRegZip] = useState<string>('95695');
  const [selectedLegacyClaims, setSelectedLegacyClaims] = useState<string[]>([]);
  const autoCheckInAfterRegister = true;

  if (!isOpen) return null;

  // Several runs open right now: the code word decides which run this is.
  if (viewMode === 'checkin' && isChoosingRun) {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="choose-run-title">
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
      </div>
    );
  }

  // Check-in only while this run's window is open (2 hours before start until midnight).
  if (viewMode === 'checkin' && eventStatus !== 'open') {
    const message = !matchedEvent
      ? "Check-in isn't set up for this run yet."
      : eventStatus === 'not_open'
        ? `Check-in for this run opens ${formatOpening(checkInWindow(matchedEvent).opensAt)}.`
        : 'Check-in for this run closed at midnight on the day of the run.';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="checkin-closed-title">
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
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 min-h-screen py-6 sm:py-8">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in duration-200 p-6 sm:p-8 text-center space-y-5">
          <button
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
      </div>
    );
  }

  // Real-time legacy matches based on first or last name
  const legacyMatches = (regFirstName.length >= 2 || regLastName.length >= 2)
    ? onSearchLegacy(`${regFirstName} ${regLastName}`.trim())
    : [];

  const handleToggleLegacyClaim = (legacyName: string) => {
    setSelectedLegacyClaims((prev) =>
      prev.includes(legacyName) ? prev.filter((n) => n !== legacyName) : [...prev, legacyName]
    );
  };

  const eventStartTime = parseEventDateTime(activeEvent.date, activeEvent.time || '06:00 PM');
  const windowOpenTime = new Date(eventStartTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
  const windowCloseTime = new Date(eventStartTime.getFullYear(), eventStartTime.getMonth(), eventStartTime.getDate(), 23, 59, 59);
  const now = new Date();
  const isDevOrTest = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('test') === 'true' ||
    new URLSearchParams(window.location.search).get('preview') === 'true' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
  const isTimeWindowOpen = (now >= windowOpenTime && now <= windowCloseTime) || isDevOrTest;
  const isCheckInUnlocked = isTimeWindowOpen || (isOrganizerOrAdmin && organizerBypass);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!regEmail || !regFirstName || !regLastName) {
      setErrorMsg('Please enter email, first name, and last name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newUser = await onRegisterUser(
        {
          email: regEmail,
          firstName: regFirstName,
          lastName: regLastName,
          shirtSize: regShirtSize,
          birthday: regBirthday || undefined,
          age: regBirthday ? calculateAge(regBirthday) : undefined,
          zipCode: regZip,
        },
        selectedLegacyClaims
      );

      // If user provided code word during first-time signup at check-in time, complete check-in now!
      if (autoCheckInAfterRegister && codeWordInput.trim() && isCheckInUnlocked) {
        const res = await onCheckInRunner({
          eventId: activeEvent.id,
          userEmail: newUser.email,
          codeWordEntered: codeWordInput,
          activity: selectedActivity,
          distanceChoice: selectedOptionKey,
          loops: currentLoops,
          withPet: runningWithPet,
        });

        if (!res.success) {
          setErrorMsg(`Registered profile, but check-in note: ${res.message}`);
          setViewMode('checkin');
          setIsSubmitting(false);
          return;
        }

        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#2a859e', '#13495d', '#10b981'],
        });
        setPostCheckInStep('run_info');
        setSuccessResult(res);
      } else {
        setViewMode('checkin');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error registering profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePerformCheckIn = async () => {
    setErrorMsg(null);
    const effectiveCodeWord = codeWordInput.trim() || (existingCheckIn ? (existingCheckIn.codeWord || activeEvent.codeWord) : '');
    if (!effectiveCodeWord) {
      setErrorMsg("Please enter today's code word!");
      return;
    }

    if (isGuest) {
      setErrorMsg("Please join the club or sign in before checking in.");
      setViewMode('register');
      return;
    }

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

    setIsSubmitting(true);
    try {
      const res = await onCheckInRunner({
        eventId: activeEvent.id,
        userEmail: currentUser.email,
        codeWordEntered: effectiveCodeWord,
        activity: selectedActivity,
        distanceChoice: selectedOptionKey,
        loops: currentLoops,
        withPet: runningWithPet,
      });

      if (!res.success) {
        setErrorMsg(res.message);
        setIsSubmitting(false);
        return;
      }

      // Trigger celebratory woodchuck confetti!
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#2a859e', '#13495d', '#10b981'],
      });

      setPostCheckInStep('run_info');
      setIsEditingCheckIn(false);
      setSuccessResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error during check-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Milestone helpers
  const activeUserRuns = successResult?.user?.totalRuns ?? currentUser.totalRuns;
  const nextMilestone = CLUB_MILESTONES.find((m) => m.runsRequired > activeUserRuns) || null;
  const previousMilestoneRuns = nextMilestone 
    ? (CLUB_MILESTONES[CLUB_MILESTONES.indexOf(nextMilestone) - 1]?.runsRequired || 0)
    : 200;
  const span = nextMilestone ? nextMilestone.runsRequired - previousMilestoneRuns : 1;
  const currentInSpan = nextMilestone ? Math.max(0, activeUserRuns - previousMilestoneRuns) : span;
  const progressPct = Math.min(100, Math.round((currentInSpan / span) * 100));
  const runsRemaining = nextMilestone ? nextMilestone.runsRequired - activeUserRuns : 0;
  const justUnlockedMilestone = [5, 50, 100, 200].includes(activeUserRuns)
    ? CLUB_MILESTONES.find((m) => m.runsRequired === activeUserRuns)
    : null;

  const activeCheckIn = successResult?.checkIn || existingCheckIn;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex justify-center p-3 sm:p-4 min-h-screen py-6 sm:py-8">
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
          <button
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
          {(successResult || (existingCheckIn && !isEditingCheckIn)) ? (
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
                        Registered for <strong className="text-stone-900">{matchedGpxRoute.name}</strong> ({activeCheckIn?.actualMiles || creditedMiles} mi {activeCheckIn?.activity || selectedActivity}{(activeCheckIn?.loops || currentLoops) > 1 ? ` • ${activeCheckIn?.loops || currentLoops} loops` : ''}).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Change Route or Distance Button */}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
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
                    {matchedGpxRoute.externalLinks?.stravaUrl ? (
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
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-stone-100/60 border border-stone-200 text-stone-400 font-bold text-center opacity-60">
                        <span className="text-lg">🟠</span>
                        <span className="text-xs font-extrabold mt-0.5">Strava</span>
                        <span className="text-[10px]">Not linked</span>
                      </div>
                    )}

                    {/* Garmin */}
                    {matchedGpxRoute.externalLinks?.garminUrl ? (
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
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-stone-100/60 border border-stone-200 text-stone-400 font-bold text-center opacity-60">
                        <span className="text-lg">🔵</span>
                        <span className="text-xs font-extrabold mt-0.5">Garmin</span>
                        <span className="text-[10px]">Not linked</span>
                      </div>
                    )}

                    {/* RunGo */}
                    {matchedGpxRoute.externalLinks?.rungoUrl ? (
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
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-stone-100/60 border border-stone-200 text-stone-400 font-bold text-center opacity-60">
                        <span className="text-lg">🟢</span>
                        <span className="text-xs font-extrabold mt-0.5">RunGo</span>
                        <span className="text-[10px]">Not linked</span>
                      </div>
                    )}

                    {/* Download GPX */}
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
                  </div>
                </div>

                {/* 2) Map of the run & 3) Turn by turn instructions */}
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

                {/* Next Page Navigation Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      confetti({
                        particleCount: 50,
                        spread: 60,
                        origin: { y: 0.7 },
                        colors: ['#f59e0b', '#2a859e', '#13495d'],
                      });
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
                                    x{badge.maxMultiplier && count >= badge.maxMultiplier ? `${badge.maxMultiplier}+` : count}
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
                        <span>🎉 Major Milestone Unlocked!</span>
                      </div>
                      <div className="font-extrabold text-sm sm:text-base font-display uppercase tracking-tight">
                        {justUnlockedMilestone.name}: {justUnlockedMilestone.reward}
                      </div>
                      <p className="text-xs text-stone-900 font-medium leading-snug">
                        Tonight's run organizer has been alerted with your shirt size (<strong className="font-bold">{successResult?.user?.shirtSize || currentUser.shirtSize}</strong>). Pick up your gear at the organizer table, and show your phone for {justUnlockedMilestone.perks}!
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
          ) : viewMode === 'checkin' ? (
            /* VIEW 2: CHECK-IN OR TIME-GATE LOCKED */
            !isCheckInUnlocked ? (
              /* TIME-GATE LOCKED STATE (Only opens 2 hours before run) */
              <div className="text-center py-4 space-y-4 animate-in fade-in">
                <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-amber-200">
                  <Clock className="w-8 h-8" />
                </div>

                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-700 text-xs font-bold uppercase tracking-wider mb-2 border border-stone-200">
                    <Lock className="w-3.5 h-3.5 text-stone-500" />
                    <span>Check-In Window Locked</span>
                  </span>
                  <h3 className="text-xl font-black text-stone-900 font-display">
                    Check-In Opens 2 Hours Before Run
                  </h3>
                  <p className="text-xs text-stone-600 mt-2 max-w-sm mx-auto leading-relaxed">
                    Event check-in unlocks Wednesday at <strong>4:00 PM</strong> (2 hours prior to the 6:00 PM run) on the patio at Blue Note Brewing Co.
                  </p>
                </div>

                {/* Logged-In Runner Status Card */}
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-woodland-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {currentUser.firstName?.[0] || 'W'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                          <span>{currentUser.displayName}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                            {currentUser.totalRuns} Runs
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500 font-mono truncate">{currentUser.email}</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      ✓ Member Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-snug pt-1 border-t border-stone-200/60">
                    You&apos;re signed in and ready! Check-in unlocks 2 hours before the run (Wednesday at 4:00 PM). Meet us on the patio at Blue Note Brewing to get the code word and check in with 1 tap.
                  </p>
                </div>

                {/* Organizer Early Bypass Option */}
                {(isOrganizerOrAdmin || isDevOrTest) && (
                  <div className="pt-2 border-t border-stone-100">
                    <button
                      onClick={() => setOrganizerBypass(true)}
                      className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Unlock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Organizer / Admin Early Test Bypass</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition"
                >
                  Close Window
                </button>
              </div>
            ) : (
            /* NORMAL UNLOCKED CHECK-IN FORM */
            <div className="space-y-5">
              {organizerBypass && (
                <div className="p-2 bg-amber-100 border border-amber-300 rounded-xl text-center text-xs font-bold text-amber-950 flex items-center justify-center gap-1.5">
                  <Unlock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Organizer Preview Mode: Early Check-In Active</span>
                </div>
              )}

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

                <div className="flex items-center gap-2">
                  {onOpenAuthModal && (
                    <>
                      <button
                        onClick={onOpenAuthModal}
                        className="text-[11px] text-woodland-700 hover:text-woodland-900 font-bold hover:underline"
                      >
                        Sign In
                      </button>
                      <span className="text-stone-300">|</span>
                    </>
                  )}
                  <button
                    onClick={() => setViewMode('register')}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold hover:underline"
                  >
                    + New Runner
                  </button>
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
                  {availableOptions.map((opt) => {
                    const isSelected = selectedOptionKey === opt.key;
                    const optLoops = opt.route.isLoop ? (loopSelections[opt.key] || 1) : 1;
                    const optBaseMiles = opt.route.baseMiles || opt.route.actualMiles;
                    const optTotalMiles = opt.route.isLoop ? (optBaseMiles * optLoops) : opt.route.actualMiles;
                    const optFormattedMiles = (Math.round(optTotalMiles * 10) / 10).toFixed(1);
                    const maxPresets = Math.max(opt.route.maxLoops || 4, 4);

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
                          <div
                            className="mt-2.5 pt-2 border-t border-stone-200/80 space-y-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-stone-800 flex items-center gap-1">
                                <span>🔄 Loops tonight:</span>
                                <span className="font-mono font-black text-woodland-900">{optLoops}x</span>
                              </span>
                              <span className="text-stone-500 font-medium text-[10px]">
                                ~{(Math.round(optBaseMiles * 10) / 10).toFixed(1)} mi/loop
                              </span>
                            </div>

                            {/* Quick presets (1, 2, 3, 4) + Stepper for 5, 6, etc. */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {Array.from({ length: maxPresets }, (_, i) => i + 1).map((n) => {
                                const loopMiles = (Math.round(optBaseMiles * n * 10) / 10).toFixed(1);
                                const isActive = optLoops === n;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => {
                                      setLoopSelections((prev) => ({ ...prev, [opt.key]: n }));
                                      setSelectedOptionKey(opt.key);
                                    }}
                                    className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                      isActive
                                        ? 'bg-woodland-900 text-white shadow-xs'
                                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200'
                                    }`}
                                  >
                                    <span>{n}</span>
                                    <span className={`text-[10px] font-mono ${isActive ? 'text-amber-300' : 'text-stone-500'}`}>
                                      ({loopMiles}m)
                                    </span>
                                  </button>
                                );
                              })}

                              {/* Stepper for ambitious runners (5, 6, etc.) */}
                              <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden bg-white ml-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.max(1, optLoops - 1);
                                    setLoopSelections((prev) => ({ ...prev, [opt.key]: next }));
                                    setSelectedOptionKey(opt.key);
                                  }}
                                  disabled={optLoops <= 1}
                                  className="px-2 py-0.5 text-xs font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                                  title="Fewer loops"
                                >
                                  −
                                </button>
                                <span className="px-1.5 text-xs font-mono font-black text-stone-900">{optLoops}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = Math.min(10, optLoops + 1);
                                    setLoopSelections((prev) => ({ ...prev, [opt.key]: next }));
                                    setSelectedOptionKey(opt.key);
                                  }}
                                  className="px-2 py-0.5 text-xs font-bold text-stone-600 hover:bg-stone-100"
                                  title="More loops"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
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
                  disabled={isSubmitting}
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
            )
          ) : viewMode === 'register' ? (
            /* VIEW 3: FIRST-TIME RUNNER ONBOARDING & LEGACY CLAIMING */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="border-b border-stone-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 font-display">
                    First-Time Runner Setup
                  </h3>
                  <p className="text-xs text-stone-500">
                    Quick 30-second profile setup to start logging runs &amp; claim past counts!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('checkin')}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="e.g. Matt"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="e.g. Settles"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="runner@example.com"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <span className="text-[10px] text-stone-500">
                  Keyed on email so your device automatically remembers you!
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Shirt Size</label>
                  <select
                    value={regShirtSize}
                    onChange={(e) => setRegShirtSize(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                  >
                    <option value="Youth">Youth</option>
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                    <option value="2XL">2XL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Birthday (Opt)
                    {calculateAge(regBirthday) !== undefined && (
                      <span className="ml-1 text-[10px] text-amber-700 font-bold font-mono">
                        (Age: {calculateAge(regBirthday)})
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={regBirthday}
                    onChange={(e) => setRegBirthday(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-2 py-2 text-xs rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none bg-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={regZip}
                    onChange={(e) => setRegZip(e.target.value)}
                    placeholder="95695"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* AUTOMATIC LEGACY MATCHES FINDER */}
              {legacyMatches.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Historical Run Records Found!</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    We found past check-in records matching your name. Check the ones that are yours to link them to your profile:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {legacyMatches.map((leg) => {
                      const isChecked = selectedLegacyClaims.includes(leg.name);
                      return (
                        <label
                          key={leg.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isChecked
                              ? 'bg-amber-100/90 border-amber-400 font-bold text-stone-900'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleLegacyClaim(leg.name)}
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span>{leg.name}</span>
                          </div>
                          <span className="font-mono text-xs bg-amber-200/80 px-2 py-0.5 rounded-full text-stone-900">
                            {leg.totalRuns} past runs
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Check into tonight's run right now (if check-in is unlocked) */}
              {isCheckInUnlocked && (
                <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Check into tonight's run now? (Optional)</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Today's Code Word
                    </label>
                    <input
                      type="text"
                      value={codeWordInput}
                      onChange={(e) => setCodeWordInput(e.target.value)}
                      placeholder="e.g. TURKEY (announced by organizer)"
                      className="w-full uppercase font-mono tracking-wider text-sm font-bold px-3 py-2 rounded-xl border border-stone-300 outline-none bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-1">Activity Tonight</label>
                      <select
                        value={selectedActivity}
                        onChange={(e) => setSelectedActivity(e.target.value as ActivityType)}
                        className="w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white font-medium"
                      >
                        <option value="running">🏃 Running</option>
                        <option value="walking">🚶 Walking</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-600 mb-1">Route &amp; Distance</label>
                      <select
                        value={selectedOptionKey}
                        onChange={(e) => setSelectedOptionKey(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-stone-300 bg-white font-medium truncate"
                      >
                        {availableOptions.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {(Math.round(opt.route.actualMiles * 10) / 10).toFixed(1)} mi — {opt.route.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-amber-200">
                    <input
                      type="checkbox"
                      id="regPetCheckbox"
                      checked={runningWithPet}
                      onChange={(e) => setRunningWithPet(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <label htmlFor="regPetCheckbox" className="text-xs font-semibold text-stone-700 cursor-pointer">
                      Running or walking with a Pet tonight? 🐕
                    </label>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-woodland-900 hover:bg-woodland-950 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>
                  {isSubmitting
                    ? 'Saving Profile...'
                    : isCheckInUnlocked && codeWordInput.trim()
                    ? 'Save Profile & Check In Tonight 🦫'
                    : 'Save Profile & Join Club 🦫'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};
