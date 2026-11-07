import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { MeetupEvent, UserProfile, RouteOption, ActivityType, DistanceTier, LegacyMember, Badge } from '../types';
import { 
  CheckCircle, 
  X, 
  Sparkles, 
  ExternalLink, 
  AlertCircle,
  Shirt,
  ChevronRight,
  ShieldCheck,
  Compass
} from 'lucide-react';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetupEvents: MeetupEvent[];
  currentUser: UserProfile;
  users: UserProfile[];
  onCheckInRunner: (params: {
    eventDate: string;
    userEmail: string;
    codeWordEntered: string;
    activity: ActivityType;
    distanceChoice: DistanceTier;
  }) => Promise<{
    success: boolean;
    message: string;
    route?: RouteOption;
    user?: UserProfile;
    newBadges?: Badge[];
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

export const CheckInModal: React.FC<CheckInModalProps> = ({
  isOpen,
  onClose,
  meetupEvents,
  currentUser,
  users,
  onCheckInRunner,
  onRegisterUser,
  onSearchLegacy,
  onSwitchUser,
  onOpenAuthModal,
}) => {
  // Current active meetup event (default to most recent or upcoming)
  const activeEvent = meetupEvents[0] || {
    id: '2026-11-11',
    date: '2026-11-11',
    title: 'Wednesday Woodchucker Meetup',
    codeWord: 'TURKEY',
    activeDistances: ['1', '3', '5'],
    routes: {},
  };

  // State
  const [viewMode, setViewMode] = useState<'checkin' | 'register' | 'switch'>('checkin');
  const [codeWordInput, setCodeWordInput] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('running');
  const [selectedDistance, setSelectedDistance] = useState<DistanceTier>(3);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Success state
  const [successResult, setSuccessResult] = useState<{
    message: string;
    route?: RouteOption;
    user?: UserProfile;
    newBadges?: Badge[];
  } | null>(null);

  // New runner onboarding state
  const [regEmail, setRegEmail] = useState<string>('');
  const [regFirstName, setRegFirstName] = useState<string>('');
  const [regLastName, setRegLastName] = useState<string>('');
  const [regShirtSize, setRegShirtSize] = useState<string>('L');
  const [regAge, setRegAge] = useState<string>('');
  const [regZip, setRegZip] = useState<string>('95695');
  const [selectedLegacyClaims, setSelectedLegacyClaims] = useState<string[]>([]);

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!regEmail || !regFirstName || !regLastName) {
      setErrorMsg('Please enter email, first name, and last name.');
      return;
    }

    try {
      await onRegisterUser(
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
      setViewMode('checkin');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error registering profile.');
    }
  };

  const handlePerformCheckIn = async () => {
    setErrorMsg(null);
    if (!codeWordInput.trim()) {
      setErrorMsg("Please enter today's code word!");
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

  // Milestone helper
  const nextMilestone = (currentUser.totalRuns < 50) ? 50 : (currentUser.totalRuns < 100) ? 100 : 250;
  const runsRemaining = Math.max(0, nextMilestone - currentUser.totalRuns);
  const progressPct = Math.min(100, Math.round((currentUser.totalRuns / nextMilestone) * 100));

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

              {/* Milestone & Mileage Progress Box */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-stone-600 flex items-center gap-1.5">
                    <Shirt className="w-4 h-4 text-amber-500" />
                    Milestone Shirt Progress
                  </span>
                  <span className="text-amber-700 font-bold">
                    {currentUser.totalRuns} / {nextMilestone} Runs
                  </span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-stone-500">
                  {runsRemaining > 0
                    ? `Only ${runsRemaining} more runs until you unlock your next Woodchucker shirt!`
                    : `Congratulations! You unlocked the ${nextMilestone} milestone!`}
                </p>

                <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                  <span className="text-stone-600">Lifetime Club Mileage:</span>
                  <span className="font-extrabold text-stone-900">
                    {currentUser.totalMiles} Miles
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
            /* VIEW 2: NORMAL CHECK-IN */
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

              {/* Step 3: Distance Choice (1, 3, or 5) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
                  3. Distance
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 3, 5].map((dist) => {
                    const isAvailable = activeEvent.activeDistances.includes(String(dist) as any);
                    const isSelected = selectedDistance === dist;

                    return (
                      <button
                        key={dist}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSelectedDistance(dist as DistanceTier)}
                        className={`py-3 rounded-xl border font-black text-center transition flex flex-col items-center justify-center ${
                          !isAvailable
                            ? 'opacity-40 bg-stone-100 border-stone-200 cursor-not-allowed text-stone-400'
                            : isSelected
                            ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-md scale-102'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <span className="text-xl leading-none font-display">{dist}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider mt-1">
                          {dist === 1 ? 'Mile' : 'Miles'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-stone-500">
                  Select your target route distance. The actual route map will display on check-in.
                </p>
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

              <button
                type="submit"
                className="w-full py-3 bg-woodland-900 hover:bg-woodland-950 text-white font-bold text-sm rounded-xl transition shadow-md flex items-center justify-center gap-2"
              >
                <span>Save Profile &amp; Go to Check-In</span>
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
