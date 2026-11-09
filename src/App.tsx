import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useClubStore } from './services/storage';
import { RunEvent, GPXRoute, UserProfile } from './types';
import { buildMeetupFromRun, deleteRunConfirmMessage, getRunChoices, resolveChoices } from './utils/runChoices';
import { Navbar } from './components/Navbar';
import { RunCard } from './components/RunCard';
import { MapViewer } from './components/MapViewer';
import { Leaderboard } from './components/Leaderboard';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { InstallAppLink } from './components/InstallAppLink';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MilestonesPage } from './components/MilestonesPage';
import { FULL_VERSION } from './utils/version';
import { onAuthChange, logoutUser, checkAndCompleteEmailLinkSignIn } from './services/authService';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from './services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { downloadGPXFile } from './utils/gpxParser';
import { isAdminProfile, isStaffProfile } from './utils/roles';
import { formatOpening, nextCheckInEvent, openCheckInEvents, checkInWindow, upcomingRuns, priorRuns, isRunLive } from './utils/checkInWindow';

// Lazy-loaded heavy components & modals (saves >60% initial mobile bundle size)
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const RouteStudioModal = lazy(() => import('./components/RouteStudioModal').then((m) => ({ default: m.RouteStudioModal })));
const CheckInModal = lazy(() => import('./components/CheckInModal').then((m) => ({ default: m.CheckInModal })));
const NewRunModal = lazy(() => import('./components/NewRunModal').then((m) => ({ default: m.NewRunModal })));
const EditRunModal = lazy(() => import('./components/EditRunModal').then((m) => ({ default: m.EditRunModal })));
const FirebaseSetupGuide = lazy(() => import('./components/FirebaseSetupGuide').then((m) => ({ default: m.FirebaseSetupGuide })));
const BrandAssetsModal = lazy(() => import('./components/BrandAssetsModal').then((m) => ({ default: m.BrandAssetsModal })));
const VersionModal = lazy(() => import('./components/VersionModal').then((m) => ({ default: m.VersionModal })));
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const NewUserModal = lazy(() => import('./components/NewUserModal').then((m) => ({ default: m.NewUserModal })));
import {
  Plus,
  Compass,
  AlertCircle,
  Mountain,
  Download,
  Sparkles,
  Bell,
  X,
  Palette,
  Gift,
  UserPlus,
  Edit3,
  CheckCircle
} from 'lucide-react';

export function App() {
  const {
    runs,
    members,
    routes,
    badges,
    notifications,
    currentMember,
    toggleRSVP,
    createRunWithCheckIn,
    updateRun,
    deleteRun,
    sendPushAnnouncement,
    deleteAnnouncement,
    bellItems,
    addRoute,
    updateRoute,
    deleteRoute,
    isFirebaseConfigured,
    // V2 Relational props
    syncPrivateData,
    clearPrivateData,
    setUserRole,
    adminDeleteRunner,
    loadLegacyPool,
    adminSetLegacyClaim,
    importLegacyData,
    users,
    setUsers,
    meetupEvents,
    checkins,
    legacyMembers,
    currentUser,
    registerUser,
    checkInRunner,
    saveMeetupEvent,
    resolveRunByCodeWord,
    countPushDevices,
    countRunCheckIns,
    scheduleLoaded,
    searchLegacyMatches,
    switchCurrentUser,
    milestoneAlerts,
    markMilestoneFulfilled,
    specialEvents,
    createBadge,
    deleteBadge,
  } = useClubStore();

  const [activeTab, setActiveTab] = useState<'runs' | 'routes' | 'milestones' | 'leaderboard' | 'admin'>('runs');
  
  // Modals state
  // Which run a check-in is for: one run, or (when several are open at once) the
  // candidates, in which case the runner's code word picks the run.
  type CheckInTarget = { runId?: string; candidateIds?: string[] };
  const [selectedRunForCheckIn, setSelectedRunForCheckIn] = useState<CheckInTarget | null>(null);
  const [checkInNotice, setCheckInNotice] = useState<string | null>(null);
  const [showPriorRuns, setShowPriorRuns] = useState<boolean>(false);
  const [isNewRunOpen, setIsNewRunOpen] = useState<boolean>(false);
  const [editingRun, setEditingRun] = useState<RunEvent | null>(null);
  const [isRouteStudioOpen, setIsRouteStudioOpen] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<GPXRoute | null>(null);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState<boolean>(false);
  const [isBrandAssetsOpen, setIsBrandAssetsOpen] = useState<boolean>(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  // Bell: items newer than the last time this browser opened the feed count as unread.
  const BELL_SEEN_KEY = 'woodchuckers_bell_seen_at';
  const [bellSeenAt, setBellSeenAt] = useState<string>(() => {
    try {
      return localStorage.getItem(BELL_SEEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const toggleBell = () => {
    setShowNotificationsDrawer((open) => {
      if (!open) {
        const now = new Date().toISOString();
        setBellSeenAt(now);
        try {
          localStorage.setItem(BELL_SEEN_KEY, now);
        } catch {
          // ignore
        }
      }
      return !open;
    });
  };

  // Selected route for viewing
  const [selectedRoute, setSelectedRoute] = useState<GPXRoute>(routes[0]);

  // Keep selectedRoute valid and in sync when routes load or change
  useEffect(() => {
    if (routes.length > 0) {
      if (!selectedRoute || !routes.some((r) => r.id === selectedRoute.id)) {
        setSelectedRoute(routes[0]);
      }
    }
  }, [routes, selectedRoute]);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // False until Firebase has restored the sign-in (and loaded the profile), so the
  // navbar doesn't flash a Sign In button on refresh.
  const [authReady, setAuthReady] = useState<boolean>(!isFirebaseConfigured);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [onboardingEmail, setOnboardingEmail] = useState<string>('');
  const [onboardingDisplayName, setOnboardingDisplayName] = useState<string>('');
  const [pendingCheckInRun, setPendingCheckInRun] = useState<CheckInTarget | null>(null);

  // With Firebase, only a real signed-in account counts — never a profile cached in localStorage.
  const isUserLoggedIn = isFirebaseConfigured
    ? Boolean(firebaseUser)
    : Boolean(currentUser && currentUser.email && currentUser.role !== 'guest');
  const isProfileVerified = isFirebaseConfigured
    ? Boolean(firebaseUser?.email && firebaseUser.email.toLowerCase() === currentUser.email.toLowerCase())
    : isUserLoggedIn;
  const isAdmin = isUserLoggedIn && isProfileVerified && isAdminProfile(currentUser);
  const isOrganizerOrAdmin = isUserLoggedIn && isProfileVerified && isStaffProfile(currentUser);

  // Runs the signed-in runner has checked into, and whether that includes a run open right now.
  const myEmail = (currentUser.email || '').toLowerCase();
  const myCheckedInRunIds = new Set(
    isUserLoggedIn && myEmail
      ? checkins.filter((c) => c.userEmail.toLowerCase() === myEmail && c.runId).map((c) => c.runId as string)
      : []
  );
  const checkedInTonight = openCheckInEvents(meetupEvents).some((e) => myCheckedInRunIds.has(e.id));

  // Refs so the auth listener can be subscribed once without stale values
  const usersRef = useRef(users);
  usersRef.current = users;
  const pendingCheckInRunRef = useRef(pendingCheckInRun);
  pendingCheckInRunRef.current = pendingCheckInRun;

  // Handle post-auth check: if user has a profile, switch to them; if new, launch onboarding
  const handleUserAuthenticated = async (email: string, displayName?: string | null) => {
    const cleanEmail = email.trim().toLowerCase();
    
    let existingProfile = usersRef.current.find((u) => u.email.toLowerCase() === cleanEmail);
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'users', cleanEmail));
        if (snap.exists()) {
          existingProfile = snap.data() as UserProfile;
          setUsers((prev) => [existingProfile!, ...prev.filter((u) => u.email.toLowerCase() !== cleanEmail)]);
        } else {
          // Document does not exist in Firestore: ensure stale local cache is pruned
          existingProfile = undefined;
          setUsers((prev) => prev.filter((u) => u.email.toLowerCase() !== cleanEmail));
        }
      } catch (err) {
        console.warn('Firestore user check error:', err);
      }
    }

    if (existingProfile) {
      switchCurrentUser(cleanEmail);
      syncPrivateData(cleanEmail, isStaffProfile(existingProfile), isAdminProfile(existingProfile));
      const pending = pendingCheckInRunRef.current;
      if (pending) {
        setSelectedRunForCheckIn(pending);
        setPendingCheckInRun(null);
      }
    } else {
      // First time this email is seen in club profiles! Load the old-app name
      // pool for claiming, then launch onboarding.
      loadLegacyPool().catch((err) => console.warn('Legacy pool load failed:', err));
      setOnboardingEmail(cleanEmail);
      setOnboardingDisplayName(displayName || '');
      setIsOnboardingOpen(true);
    }
  };

  // Listen to Firebase Auth state & complete passwordless email link sign-in.
  // Subscribed once: re-subscribing on every users change caused an endless
  // getDoc -> setUsers -> re-subscribe loop.
  useEffect(() => {
    // Completing the link signs the user in; onAuthChange below then handles them.
    checkAndCompleteEmailLinkSignIn().catch((err) => console.error('Email sign in check error:', err));

    const unsubscribe = onAuthChange((user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        handleUserAuthenticated(user.email, user.displayName).finally(() => setAuthReady(true));
      } else {
        switchCurrentUser('');
        clearPrivateData();
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCheckInFor = (target: CheckInTarget) => {
    if (!isUserLoggedIn) {
      setPendingCheckInRun(target);
      setIsAuthModalOpen(true);
    } else {
      setSelectedRunForCheckIn(target);
    }
  };
  const handleOpenCheckIn = (run: Pick<RunEvent, 'id'>) => openCheckInFor({ runId: run.id });

  const handleOpenRegister = () => {
    if (isUserLoggedIn) {
      alert(`You are already a registered Woodchucker (${currentUser.displayName})!`);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  // Quick Check-in and the table QR code: open the event whose check-in window
  // is open right now (2 hours before start until midnight). Never guess another night's run.
  const handleQuickCheckIn = () => {
    const open = openCheckInEvents(meetupEvents);
    if (open.length > 0) {
      setCheckInNotice(null);
      openCheckInFor(open.length === 1 ? { runId: open[0].id } : { candidateIds: open.map((e) => e.id) });
      return;
    }
    const next = nextCheckInEvent(meetupEvents);
    setCheckInNotice(
      next
        ? `No run right now. Check-in for the next run opens ${formatOpening(checkInWindow(next).opensAt)}.`
        : 'No run right now, and no upcoming runs are scheduled yet.'
    );
  };

  // Auto-open check-in if scanned from the table QR code (?checkin=true or #checkin),
  // once the events have loaded.
  const qrHandledRef = useRef(false);
  useEffect(() => {
    if (qrHandledRef.current || !scheduleLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkin') === 'true' || window.location.hash === '#checkin') {
      qrHandledRef.current = true;
      handleQuickCheckIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleLoaded, meetupEvents]);

  // Scheduling or editing a run also updates that night's check-in event,
  // so runners pick from the run's distance options when they check in.
  // Errors from these are shown inside the New Run / Edit Run form, which stays open.
  const friendlyRunError = (err: any): Error =>
    new Error(
      err?.code === 'duplicate-code-word'
        ? err.message
        : err?.code === 'permission-denied'
          ? "Not saved: the code word is locked once this run's check-in has opened."
          : "Not saved. Please check your connection and try again."
    );

  const handleToggleRSVP = async (runId: string) => {
    try {
      await toggleRSVP(runId);
    } catch (err) {
      console.error('RSVP failed:', err);
      alert("Your RSVP couldn't be saved. Please check your connection and try again.");
    }
  };

  const handleDeleteRun = async (runId: string) => {
    try {
      await deleteRun(runId);
    } catch (err: any) {
      console.error('Deleting run failed:', err);
      alert(err?.code === 'needs-admin' ? err.message : "The run couldn't be fully deleted. Please try again; it's safe to retry.");
    }
  };

  // Past runs can't be edited; admins can still delete one (check-ins are rolled back).
  const confirmDeletePastRun = async (run: RunEvent) => {
    // Staff only load recent check-ins, so ask the server how many this run has.
    let count = checkins.filter((c) => c.runId === run.id).length;
    try {
      count = await countRunCheckIns(run.id);
    } catch (err) {
      console.warn('Could not count check-ins for this run:', err);
    }
    if (window.confirm(deleteRunConfirmMessage(run.title, count))) handleDeleteRun(run.id);
  };

  const handleAddRun = async (run: Omit<RunEvent, 'id' | 'attendees'>, codeWord: string) => {
    try {
      await createRunWithCheckIn(run, codeWord);
    } catch (err) {
      console.error('Creating run failed:', err);
      throw friendlyRunError(err);
    }
  };

  const handleUpdateRun = async (run: RunEvent, codeWord: string) => {
    try {
      await updateRun(run);
      const existing = meetupEvents.find((e) => e.id === run.id);
      await saveMeetupEvent(buildMeetupFromRun(run, routes, codeWord, existing));
    } catch (err) {
      console.error('Saving run failed:', err);
      throw friendlyRunError(err);
    }
  };

  const handleViewRouteFromRun = (route: GPXRoute) => {
    setSelectedRoute(route);
    setActiveTab('routes');
  };

  const handleSaveRoute = async (routeData: Omit<GPXRoute, 'id'>, existingId?: string) => {
    if (!isOrganizerOrAdmin) {
      alert('Only organizers and club administrators can create or edit routes.');
      return;
    }
    if (existingId) {
      const updated = await updateRoute(existingId, routeData);
      setSelectedRoute(updated);
    } else {
      const saved = await addRoute(routeData);
      setSelectedRoute(saved);
    }
    setIsRouteStudioOpen(false);
    setEditingRoute(null);
    setActiveTab('routes');
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (!isOrganizerOrAdmin) {
      alert('Only organizers and club administrators can delete routes.');
      return;
    }
    try {
      await deleteRoute(routeId);
    } catch (err) {
      console.error('Deleting route failed:', err);
      alert("The route couldn't be deleted. Please check your connection and try again.");
      return;
    }
    if (selectedRoute.id === routeId && routes.length > 1) {
      setSelectedRoute(routes.find((r) => r.id !== routeId) || routes[0]);
    }
    setIsRouteStudioOpen(false);
    setEditingRoute(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-sans pb-16 md:pb-0 w-full overflow-x-hidden">
      {/* Mobile PWA Install & Push Notification Banner */}
      <InstallPwaBanner
        pushAccount={isUserLoggedIn && currentUser.email ? { email: currentUser.email, memberKey: currentMember.id } : undefined}
      />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        firebaseUser={firebaseUser}
        authReady={authReady}
        unreadNotifsCount={bellItems.filter((n) => n.timestamp > bellSeenAt).length}
        onOpenNewRun={() => setIsNewRunOpen(true)}
        onOpenUploadGpx={() => {
          setEditingRoute(null);
          setIsRouteStudioOpen(true);
        }}
        onToggleNotifications={toggleBell}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenRegister={handleOpenRegister}
        onOpenVersionModal={() => setIsVersionModalOpen(true)}
        onLogout={async () => {
          await logoutUser();
          setFirebaseUser(null);
          switchCurrentUser('');
          clearPrivateData();
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: RUN SCHEDULES */}
        {activeTab === 'runs' && (
          <div className="space-y-6">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] text-white p-6 sm:p-8 shadow-lg border border-woodland-700/60">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-woodland-500/20 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 -mb-20 w-60 h-60 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-woodland-500/20 text-woodland-200 border border-woodland-400/30 text-xs font-semibold mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Spring 2026 Season • Blue Note Brewing Co.</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-display font-extrabold tracking-wide uppercase leading-tight">
                    Woodland Woodchuckers
                  </h1>
                  <p className="mt-2 text-sm sm:text-base text-woodland-100/90 leading-relaxed font-sans">
                    Join our weekly Wednesday group runs, check in to build your milestone shirt streak,
                    track your lifetime miles, and earn club badges — 100% free with zero fees!
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleQuickCheckIn}
                      className={`flex items-center gap-2 px-5 py-2.5 font-black text-xs sm:text-sm rounded-xl transition shadow-md font-display uppercase tracking-wide cursor-pointer ${
                        checkedInTonight
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-stone-950'
                      }`}
                    >
                      {checkedInTonight ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Checked In ✓</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-stone-950" />
                          <span>Check In Tonight 🦫</span>
                        </>
                      )}
                    </button>

                    {/* Prominent Join Club button for Guests */}
                    {authReady && (currentUser.role === 'guest' || !currentUser.email) && (
                      <button
                        onClick={handleOpenRegister}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-xl transition shadow-md font-display uppercase tracking-wide cursor-pointer"
                        title="Join the Club (Free, 24/7/365)"
                      >
                        <UserPlus className="w-4 h-4 text-emerald-200" />
                        <span>Join Club (Free)</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTab('milestones')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold text-xs sm:text-sm rounded-xl border border-amber-400/30 transition backdrop-blur-xs"
                    >
                      <Gift className="w-4 h-4 text-amber-300" />
                      <span>Milestones 🏆</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('routes')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-woodland-700/60 hover:bg-woodland-700 text-white font-semibold text-xs sm:text-sm rounded-xl border border-woodland-500/40 transition"
                    >
                      <Compass className="w-4 h-4 text-woodland-300" />
                      <span>Explore Runs</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setActiveTab('admin')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm rounded-xl border border-stone-700 transition"
                      >
                        <span>Admin Portal</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Run Schedule Header */}
            <div className="pt-2">
              <h3 className="text-xl font-bold text-stone-900 font-display">Upcoming Run Schedule</h3>
              <p className="text-xs text-stone-500">
                Wednesdays at Blue Note Brewing Co. (6:00 PM) • All runs start &amp; finish on the brewery patio!
              </p>
            </div>

            {/* Run Cards List: upcoming soonest first; prior runs on request, newest first */}
            {(() => {
              const renderRun = (run: RunEvent, past = false) => {
                const choices = resolveChoices(getRunChoices(run, routes), routes);
                const attachedRoute = choices[0]?.route || routes.find((r) => r.id === run.routeId);
                return (
                  <RunCard
                    key={run.id}
                    run={run}
                    route={attachedRoute}
                    choices={choices}
                    currentMember={currentMember}
                    onToggleRSVP={handleToggleRSVP}
                    onOpenCheckIn={handleOpenCheckIn}
                    onViewRoute={handleViewRouteFromRun}
                    isCheckedIn={myCheckedInRunIds.has(run.id)}
                    notLive={!isRunLive(run, meetupEvents)}
                    onEdit={isOrganizerOrAdmin && !past ? setEditingRun : undefined}
                    onDelete={isAdmin && past ? confirmDeletePastRun : undefined}
                  />
                );
              };
              // Runs without a saved code word aren't live: only staff see them (to finish setting them up).
              const visible = runs.filter((r) => isOrganizerOrAdmin || isRunLive(r, meetupEvents));
              const upcoming = upcomingRuns(visible);
              const prior = priorRuns(visible);
              return (
                <div className="space-y-4">
                  {upcoming.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
                      <AlertCircle className="w-8 h-8 text-stone-400 mx-auto" />
                      <p className="text-stone-600 font-medium text-sm">No upcoming runs scheduled.</p>
                    </div>
                  ) : (
                    upcoming.map((r) => renderRun(r))
                  )}

                  {prior.length > 0 && (
                    <div className="pt-2 space-y-4">
                      <button
                        type="button"
                        onClick={() => setShowPriorRuns((v) => !v)}
                        aria-expanded={showPriorRuns}
                        className="w-full py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-xl transition"
                      >
                        {showPriorRuns ? 'Hide prior runs' : `Show prior runs (${prior.length})`}
                      </button>
                      {showPriorRuns && (
                        <>
                          <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Prior Runs</h4>
                          {prior.map((r) => renderRun(r, true))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 2: GPX ROUTE EXPLORER */}
        {activeTab === 'routes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900 font-display">Woodland Run Library</h3>
                <p className="text-xs text-stone-500">
                  Interactive OpenStreetMap run tracks, elevation profiles, and downloadable GPS routes.
                </p>
              </div>
              {isOrganizerOrAdmin && (
                <button
                  onClick={() => {
                    setEditingRoute(null);
                    setIsRouteStudioOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-woodland-800 hover:bg-woodland-900 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload &amp; Create Route</span>
                </button>
              )}
            </div>

            {/* Route Selector Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {routes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoute(r)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-2 ${
                    selectedRoute.id === r.id
                      ? 'bg-woodland-800 text-white shadow-sm'
                      : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <span>{r.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    selectedRoute.id === r.id ? 'bg-woodland-950 text-woodland-200' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {r.distanceMiles} mi
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Route Map Viewer */}
            {selectedRoute && (
              <MapViewer
                route={selectedRoute}
                height="480px"
                showElevationProfile={true}
                canEdit={isOrganizerOrAdmin}
                onEditRoute={(r) => {
                  setEditingRoute(r);
                  setIsRouteStudioOpen(true);
                }}
              />
            )}

            {/* Route Cards Carousel / Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {routes.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoute(r)}
                  className={`p-4 rounded-xl border bg-white cursor-pointer transition ${
                    selectedRoute.id === r.id
                      ? 'border-woodland-600 ring-2 ring-woodland-500/20 shadow-sm'
                      : 'border-stone-200 hover:border-woodland-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-stone-900 leading-snug">{r.name}</h4>
                    <span className="text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-semibold shrink-0">
                      {r.surface}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-2 mb-3 leading-relaxed">
                    {r.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-stone-100">
                    <span className="font-bold text-woodland-800">{r.distanceMiles} miles</span>
                    <span className="flex items-center gap-1 text-stone-500 font-medium">
                      <Mountain className="w-3 h-3 text-amber-600" /> +{r.elevationGainFt} ft
                    </span>
                    <div className="flex items-center gap-1">
                      {isOrganizerOrAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRoute(r);
                            setIsRouteStudioOpen(true);
                          }}
                          className="text-stone-400 hover:text-woodland-800 p-1"
                          title="Edit Route Details & Directions"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadGPXFile(r);
                        }}
                        className="text-stone-400 hover:text-stone-800 p-1"
                        title="Download GPX"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MILESTONES & REWARDS SHOWCASE */}
        {activeTab === 'milestones' && (
          <MilestonesPage
            currentUser={currentUser}
            badges={badges}
            onOpenCheckIn={handleQuickCheckIn}
          />
        )}

        {/* TAB 4: MEMBERS & LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <Leaderboard
            members={members}
            badges={badges}
            currentMember={currentMember}
          />
        )}

        {/* TAB 5: ADMIN DASHBOARD */}
        {activeTab === 'admin' && (
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white rounded-2xl border border-stone-200">
                <div className="w-8 h-8 border-4 border-woodland-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-stone-500 font-semibold">Loading Admin Dashboard...</p>
              </div>
            }
          >
            <AdminDashboard
              routes={routes}
              badges={badges}
              notifications={notifications}
              meetupEvents={meetupEvents}
              checkins={checkins}
              users={users}
              legacyMembers={legacyMembers}
              milestoneAlerts={milestoneAlerts}
              onMarkMilestoneFulfilled={markMilestoneFulfilled}
              currentUser={currentUser}
              specialEvents={specialEvents}
              onCreateBadge={createBadge}
              onDeleteBadge={deleteBadge}
              onOpenNewRun={() => setIsNewRunOpen(true)}
              onSendBroadcast={sendPushAnnouncement}
              onDeleteAnnouncement={deleteAnnouncement}
              onSetUserRole={setUserRole}
              onDeleteRunner={adminDeleteRunner}
              onSetLegacyClaim={adminSetLegacyClaim}
              onImportLegacyData={importLegacyData}
              onReloadLegacyPool={loadLegacyPool}
              onCountPushDevices={countPushDevices}
            />
          </Suspense>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        onQuickCheckIn={handleQuickCheckIn}
      />

      {/* Footer (Mobile & Desktop with bottom navigation spacing) */}
      <footer className="bg-white border-t border-stone-200 py-6 mt-12 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <img src="/Woodchucker2026.png" alt="2026 Mascot" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-stone-800">Woodland Woodchuckers Run Club</span>
            <span>• Blue Note Brewing Co.</span>
            <button
              type="button"
              onClick={() => setIsVersionModalOpen(true)}
              title="Click to view build details & check for updates"
              className="font-mono text-[11px] font-bold text-woodland-800 bg-stone-100 hover:bg-stone-200 border border-stone-200 px-2 py-0.5 rounded transition shadow-2xs cursor-pointer select-none"
            >
              {FULL_VERSION}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <InstallAppLink />
            <button
              onClick={() => setIsBrandAssetsOpen(true)}
              className="text-woodland-700 hover:text-woodland-900 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Logos &amp; Brand</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className="text-woodland-800 hover:underline font-bold cursor-pointer"
              >
                Admin Dashboard
              </button>
            )}
            <button
              onClick={() => setIsSetupGuideOpen(true)}
              className="text-woodland-700 hover:underline font-semibold cursor-pointer"
            >
              Setup Guide
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsVersionModalOpen(true)}
              className="text-stone-400 hover:text-woodland-700 transition cursor-pointer"
            >
              PWA Ready • Offline Enabled
            </button>
          </div>
        </div>
      </footer>

      {/* Notifications Drawer */}
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-[1000] flex justify-end bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm h-full shadow-2xl p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base text-stone-900">Club Announcements</h3>
              </div>
              <button onClick={() => setShowNotificationsDrawer(false)} className="text-stone-400 hover:text-stone-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {bellItems.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-8">No announcements yet.</p>
              ) : (
                bellItems.map((n) => {
                  const isPush = n.kind === 'push';
                  const when = new Date(n.timestamp);
                  const content = (
                    <>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${isPush ? 'text-indigo-600' : 'text-amber-700'}`}>
                        {isPush ? '📲 Push notification' : '📣 Announcement'}
                      </div>
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <strong className={`font-bold ${isPush ? 'text-indigo-950' : 'text-stone-900'}`}>{n.title}</strong>
                        <span className="text-[10px] text-stone-400 shrink-0">
                          {when.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      {n.body && <p className={`text-xs leading-relaxed ${isPush ? 'text-indigo-900/80' : 'text-stone-600'}`}>{n.body}</p>}
                      {n.timestamp > bellSeenAt && <span className="sr-only">New</span>}
                    </>
                  );
                  const box = `block p-3 rounded-xl space-y-1 border ${isPush ? 'bg-indigo-50 border-indigo-200' : 'bg-stone-50 border-stone-200'}`;
                  return isPush && n.link && n.link !== '/' ? (
                    <a key={n.id} href={n.link} className={`${box} hover:bg-indigo-100`}>
                      {content}
                    </a>
                  ) : (
                    <div key={n.id} className={box}>
                      {content}
                    </div>
                  );
                })
              )}
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setShowNotificationsDrawer(false);
                  setActiveTab('admin');
                }}
                className="w-full py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition"
              >
                Post Announcement
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lazy-Loaded Modals & Drawers */}
      <Suspense fallback={null}>
        {checkInNotice && (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/70 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkin-notice-title"
          >
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 text-center space-y-4">
              <div className="text-4xl" aria-hidden="true">🦫</div>
              <h3 id="checkin-notice-title" className="text-lg font-display font-black uppercase tracking-wide text-stone-900">
                Check-in
              </h3>
              <p className="text-sm text-stone-700">{checkInNotice}</p>
              <button
                type="button"
                onClick={() => setCheckInNotice(null)}
                className="w-full py-2.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-sm rounded-xl transition"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Check In Modal (New Relational Check-in Experience) */}
        {selectedRunForCheckIn && (
          <CheckInModal
            isOpen={Boolean(selectedRunForCheckIn)}
            onClose={() => setSelectedRunForCheckIn(null)}
            meetupEvents={meetupEvents}
            eventId={selectedRunForCheckIn.runId}
            candidateEventIds={selectedRunForCheckIn.candidateIds}
            runs={runs}
            onResolveCodeWord={resolveRunByCodeWord}
            currentUser={currentUser}
            routes={routes}
            checkins={checkins}
            onCheckInRunner={checkInRunner}
            onRegisterUser={registerUser}
            onSearchLegacy={searchLegacyMatches}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {isNewRunOpen && (
          <NewRunModal
            isOpen={isNewRunOpen}
            onClose={() => setIsNewRunOpen(false)}
            routes={routes}
            organizerName={currentMember.name}
            onAddRun={handleAddRun}
            specialEvents={specialEvents}
          />
        )}

        {editingRun && (
          <EditRunModal
            run={editingRun}
            routes={routes}
            isOpen={Boolean(editingRun)}
            onClose={() => setEditingRun(null)}
            onSave={handleUpdateRun}
            onDelete={handleDeleteRun}
            checkInCount={checkins.filter((c) => c.runId === editingRun.id).length}
            specialEvents={specialEvents}
            currentCodeWord={meetupEvents.find((e) => e.id === editingRun.id)?.codeWord || ''}
            codeWordLockedSince={(() => {
              const ev = meetupEvents.find((e) => e.id === editingRun.id);
              // Only an existing code word locks; a run without one can always get its first.
              if (!ev || ev.codeWordSet === false || !ev.codeWord) return undefined;
              const { opensAt } = checkInWindow(ev);
              return opensAt <= new Date() ? formatOpening(opensAt) : undefined;
            })()}
          />
        )}

        {isRouteStudioOpen && isOrganizerOrAdmin && (
          <RouteStudioModal
            isOpen={isRouteStudioOpen}
            onClose={() => {
              setIsRouteStudioOpen(false);
              setEditingRoute(null);
            }}
            existingRoute={editingRoute}
            onSaveRoute={handleSaveRoute}
            onDeleteRoute={handleDeleteRoute}
          />
        )}

        <FirebaseSetupGuide
          isOpen={isSetupGuideOpen}
          onClose={() => setIsSetupGuideOpen(false)}
          isConfigured={isFirebaseConfigured}
        />

        <BrandAssetsModal
          isOpen={isBrandAssetsOpen}
          onClose={() => setIsBrandAssetsOpen(false)}
        />

        <VersionModal
          isOpen={isVersionModalOpen}
          onClose={() => setIsVersionModalOpen(false)}
        />

        {/* Passwordless & Google Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={(email, displayName) => {
            setIsAuthModalOpen(false);
            handleUserAuthenticated(email, displayName);
          }}
        />

        {/* First-Time Runner Profile Creation & Historical Merge */}
        {isOnboardingOpen && (
          <NewUserModal
            isOpen={isOnboardingOpen}
            onClose={() => {
              setIsOnboardingOpen(false);
              setPendingCheckInRun(null);
            }}
            email={onboardingEmail}
            initialDisplayName={onboardingDisplayName}
            legacyMembers={legacyMembers}
            onRegisterUser={registerUser}
            onSuccess={(newUser) => {
              switchCurrentUser(newUser.email);
              setIsOnboardingOpen(false);
              if (pendingCheckInRun) {
                setSelectedRunForCheckIn(pendingCheckInRun);
                setPendingCheckInRun(null);
              }
            }}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
