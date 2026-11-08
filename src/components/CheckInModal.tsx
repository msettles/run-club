import React, { useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { MeetupEvent, UserProfile, RouteOption, ActivityType, DistanceTier, LegacyMember, Badge } from '../types';
import { CLUB_MILESTONES } from '../data/initialData';
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
  Unlock
} from 'lucide-react';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetupEvents: MeetupEvent[];
  eventDate?: string; // Date of the run being checked into; falls back to the latest event
  currentUser: UserProfile;
  users: UserProfile[];
  initialMode?: 'checkin' | 'register';
  onCheckInRunner: (params: {
    eventDate: string;
    userEmail: string;
    codeWordEntered: string;
    activity: ActivityType;
    distanceChoice: DistanceTier;
    withPet?: boolean;
  }) => Promise<{
    success: boolean;
    message: string;
    route?: RouteOption;
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
      age?: number;
      city?: string;
      zipCode?: string;
    },
    claimedLegacyNames?: string[]
  ) => Promise<UserProfile>;
  onSearchLegacy: (query: string) => LegacyMember[];
  onSwitchUser: (email: string) => void;
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
  eventDate,
  currentUser,
  users,
  initialMode = 'checkin',
  onCheckInRunner,
  onRegisterUser,
  onSearchLegacy,
  onSwitchUser,
  onOpenAuthModal,
}) => {
  // Current active meetup event (default to most recent or upcoming)
  const activeEvent = (eventDate && meetupEvents.find((e) => e.date === eventDate)) || meetupEvents[0] || {
    id: '2026-11-11',
    date: '2026-11-11',
    time: '06:00 PM',
    title: 'Wednesday Woodchucker Meetup',
    codeWord: 'TURKEY',
    activeDistances: ['1', '3', '5'],
    routes: {},
  };

  const isGuest = currentUser.role === 'guest' || !currentUser.email;
  const isOrganizerOrAdmin = currentUser.role === 'admin' || currentUser.role === 'organizer' || currentUser.email === 'woodlandwoodchuckers@gmail.com';

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
  const [viewMode, setViewMode] = useState<'checkin' | 'register' | 'switch'>(
    initialMode === 'register' || isGuest ? 'register' : 'checkin'
  );
  const [codeWordInput, setCodeWordInput] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('running');
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>(() => {
    return availableOptions[0]?.key || '3';
  });

  const selectedOption = useMemo(() => {
    return availableOptions.find((o) => o.key === selectedOptionKey) || availableOptions[0];
  }, [availableOptions, selectedOptionKey]);

  const selectedDistance = selectedOption.route.actualMiles;
  const [runningWithPet, setRunningWithPet] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [organizerBypass, setOrganizerBypass] = useState<boolean>(false);

  // Success state
  const [successResult, setSuccessResult] = useState<{
    message: string;
    route?: RouteOption;
    user?: UserProfile;
    newBadges?: Badge[];
  } | null>(null);

  // New runner onboarding state
  const [regEmail, setRegEmail] = useState<string>(currentUser.email || '');
  const [regFirstName, setRegFirstName] = useState<string>(currentUser.firstName !== 'Guest' ? currentUser.firstName : '');
  const [regLastName, setRegLastName] = useState<string>(currentUser.lastName !== 'Runner' ? currentUser.lastName : '');
  const [regShirtSize, setRegShirtSize] = useState<string>(currentUser.shirtSize || 'L');
  const [regAge, setRegAge] = useState<string>('');
  const [regZip, setRegZip] = useState<string>('95695');
  const [selectedLegacyClaims, setSelectedLegacyClaims] = useState<string[]>([]);
  const autoCheckInAfterRegister = true;

  if (!isOpen) return null;

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
  const isTimeWindowOpen = now >= windowOpenTime && now <= windowCloseTime;
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
          age: regAge ? parseInt(regAge, 10) : undefined,
          zipCode: regZip,
        },
        selectedLegacyClaims
      );

      // If user provided code word during first-time signup at check-in time, complete check-in now!
      if (autoCheckInAfterRegister && codeWordInput.trim() && isCheckInUnlocked) {
        const res = await onCheckInRunner({
          eventDate: activeEvent.date,
          userEmail: newUser.email,
          codeWordEntered: codeWordInput,
          activity: selectedActivity,
          distanceChoice: selectedDistance,
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
    if (!codeWordInput.trim()) {
      setErrorMsg("Please enter today's code word!");
      return;
    }

    if (isGuest) {
      setErrorMsg("Please join the club or sign in before checking in.");
      setViewMode('register');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onCheckInRunner({
        eventDate: activeEvent.date,
        userEmail: currentUser.email,
        codeWordEntered: codeWordInput,
        activity: selectedActivity,
        distanceChoice: selectedDistance,
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] px-6 py-5 text-white flex items-center justify-between">
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
        <div className="p-6">
          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* VIEW 1: SUCCESS CELEBRATION */}
          {successResult ? (
            <div className="text-center py-2 space-y-5 animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-9 h-9" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Checked In!
                </span>
                <h3 className="text-2xl font-black text-stone-900 font-display">
                  Boom, {currentUser.firstName}! 🎉
                </h3>
                <p className="text-sm text-stone-600 mt-1">
                  You're all set for the <strong className="text-stone-900">{selectedDistance}-Mile {selectedActivity}</strong>.
                </p>
              </div>

              {/* Badge Unlock Celebration Card */}
              {successResult.newBadges && successResult.newBadges.length > 0 && (
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
                      Tonight's run organizer has been alerted with your shirt size (<strong className="font-bold">{successResult.user?.shirtSize || currentUser.shirtSize}</strong>). Pick up your gear at the organizer table, and show your phone for {justUnlockedMilestone.perks}!
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
                    {successResult.user?.totalMiles || currentUser.totalMiles} Miles
                  </span>
                </div>
              </div>

              {/* ROUTE DISPLAY CARD (STUBBED FOR NOW) */}
              {successResult.route && (
                <div className="bg-woodland-50 border border-woodland-200 rounded-2xl p-4 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-woodland-900">
                      <Compass className="w-4 h-4 text-woodland-600" />
                      Your Selected Route: {successResult.route.name}
                    </span>
                    <span className="px-2 py-0.5 bg-woodland-200/60 text-woodland-900 font-bold text-xs rounded-full">
                      {successResult.route.actualMiles} mi
                    </span>
                  </div>

                  {successResult.route.directions && (
                    <div className="bg-white/80 rounded-xl p-3 text-xs text-stone-700 border border-woodland-100 space-y-1">
                      <div className="font-semibold text-stone-900 text-[11px] uppercase tracking-wider">
                        Turn-by-Turn Directions:
                      </div>
                      <p className="leading-relaxed font-sans">{successResult.route.directions}</p>
                    </div>
                  )}

                  {successResult.route.routeUrl && (
                    <a
                      href={successResult.route.routeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2 bg-woodland-700 hover:bg-woodland-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      <span>Open Route (Strava / Garmin / Watch)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm rounded-xl transition shadow-md"
              >
                Done • Have a Great Run!
              </button>
            </div>
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

                {/* Membership Sign-Up Promotion (Available 24/7/365) */}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-left space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Not a Member Yet? Join Anytime!</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed font-sans">
                    Club membership is 100% free with zero fees! You can register your profile right now so check-in is 1 tap tonight at the brewery!
                  </p>
                  <button
                    onClick={() => setViewMode('register')}
                    className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs rounded-xl transition shadow-sm font-display uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <span>Register Member Profile Ahead of Time</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Organizer Early Bypass Option */}
                {isOrganizerOrAdmin && (
                  <div className="pt-2 border-t border-stone-100">
                    <button
                      onClick={() => setOrganizerBypass(true)}
                      className="text-xs text-stone-600 hover:text-stone-900 font-bold underline flex items-center justify-center gap-1 mx-auto"
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
                    onClick={() => setViewMode('switch')}
                    className="text-[11px] text-stone-600 hover:text-stone-900 font-semibold hover:underline"
                  >
                    Switch
                  </button>
                  <span className="text-stone-300">|</span>
                  <button
                    onClick={() => setViewMode('register')}
                    className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold hover:underline"
                  >
                    + New Runner
                  </button>
                </div>
              </div>

              {/* Step 1: Code Word */}
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
                                {opt.route.actualMiles} mi
                              </span>
                              {opt.route.targetTier && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                                  {opt.route.targetTier}
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

                        {/* External App Links */}
                        {opt.route.externalLinks && (
                          <div className="flex items-center gap-1.5 pt-2 flex-wrap">
                            {opt.route.externalLinks.stravaUrl && (
                              <a
                                href={opt.route.externalLinks.stravaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-bold rounded hover:bg-orange-200 transition"
                              >
                                🟠 Strava
                              </a>
                            )}
                            {opt.route.externalLinks.garminUrl && (
                              <a
                                href={opt.route.externalLinks.garminUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-0.5 bg-cyan-100 text-cyan-900 text-[10px] font-bold rounded hover:bg-cyan-200 transition"
                              >
                                🔵 Garmin
                              </a>
                            )}
                            {opt.route.externalLinks.rungoUrl && (
                              <a
                                href={opt.route.externalLinks.rungoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-bold rounded hover:bg-emerald-200 transition"
                              >
                                🟢 RunGo
                              </a>
                            )}
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

              {/* Submit Button */}
              <button
                type="button"
                onClick={handlePerformCheckIn}
                disabled={isSubmitting}
                className="w-full mt-4 py-3.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-stone-950 font-black text-base rounded-2xl transition shadow-lg flex items-center justify-center gap-2 font-display uppercase tracking-wide cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5 text-stone-950" />
                <span>{isSubmitting ? 'Checking In...' : 'Check In & Get Route 🦫'}</span>
              </button>
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
                  <label className="block text-xs font-bold text-stone-700 mb-1">Age (Opt)</label>
                  <input
                    type="number"
                    value={regAge}
                    onChange={(e) => setRegAge(e.target.value)}
                    placeholder="e.g. 35"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
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
                            {opt.route.actualMiles} mi — {opt.route.name}
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
          ) : (
            /* VIEW 4: SWITCH RUNNER (FOR TESTING) */
            <div className="space-y-3">
              <div className="border-b border-stone-200 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-stone-900">Switch Testing Runner</h3>
                  <p className="text-xs text-stone-500">Pick an active dummy runner to test check-in:</p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('checkin')}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                >
                  Back
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {users.map((u) => (
                  <button
                    key={u.email}
                    onClick={() => {
                      onSwitchUser(u.email);
                      setViewMode('checkin');
                    }}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition ${
                      currentUser.email.toLowerCase() === u.email.toLowerCase()
                        ? 'bg-amber-50 border-amber-400 font-bold'
                        : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs text-stone-900">{u.displayName} ({u.shirtSize})</div>
                      <div className="text-[11px] text-stone-500">{u.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-woodland-800">
                        {u.totalRuns} runs
                      </div>
                      <div className="text-[10px] text-stone-400">{u.totalMiles} mi</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
