import { useState, useEffect } from 'react';
import { useClubStore } from './services/storage';
import { RunEvent, GPXRoute } from './types';
import { buildMeetupFromRun, getRunChoices, resolveChoices } from './utils/runChoices';
import { Navbar } from './components/Navbar';
import { RunCard } from './components/RunCard';
import { MapViewer } from './components/MapViewer';
import { Leaderboard } from './components/Leaderboard';
import { AdminDashboard } from './components/AdminDashboard';
import { CheckInModal } from './components/CheckInModal';
import { NewRunModal } from './components/NewRunModal';
import { EditRunModal } from './components/EditRunModal';
import { GpxUploader } from './components/GpxUploader';
import { RouteStudioModal } from './components/RouteStudioModal';
import { FirebaseSetupGuide } from './components/FirebaseSetupGuide';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { MobileBottomNav } from './components/MobileBottomNav';
import { BrandAssetsModal } from './components/BrandAssetsModal';
import { AuthModal } from './components/AuthModal';
import { MilestonesPage } from './components/MilestonesPage';
import { onAuthChange, logoutUser, checkAndCompleteEmailLinkSignIn } from './services/authService';
import { User as FirebaseUser } from 'firebase/auth';
import { downloadGPXFile } from './utils/gpxParser';
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
  Edit3
} from 'lucide-react';

export function App() {
  const {
    runs,
    members,
    routes,
    badges,
    notifications,
    currentMember,
    setCurrentMemberId,
    toggleRSVP,
    addRun,
    updateRun,
    deleteRun,
    updateMemberStats,
    sendPushAnnouncement,
    addRoute,
    updateRoute,
    deleteRoute,
    isSyncing,
    isFirebaseConfigured,
    // V2 Relational props
    users,
    meetupEvents,
    checkins,
    legacyMembers,
    currentUser,
    registerUser,
    checkInRunner,
    saveMeetupEvent,
    searchLegacyMatches,
    switchCurrentUser,
    milestoneAlerts,
    markMilestoneFulfilled,
    specialEvents,
    createBadge,
    deleteBadge,
    createSpecialEvent,
    deleteSpecialEvent,
  } = useClubStore();

  const [activeTab, setActiveTab] = useState<'runs' | 'routes' | 'milestones' | 'leaderboard' | 'admin'>('runs');
  const [checkInInitialMode, setCheckInInitialMode] = useState<'checkin' | 'register'>('checkin');
  
  // Modals state
  const [selectedRunForCheckIn, setSelectedRunForCheckIn] = useState<RunEvent | null>(null);
  const [isNewRunOpen, setIsNewRunOpen] = useState<boolean>(false);
  const [editingRun, setEditingRun] = useState<RunEvent | null>(null);
  const [isUploadGpxOpen, setIsUploadGpxOpen] = useState<boolean>(false);
  const [isRouteStudioOpen, setIsRouteStudioOpen] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<GPXRoute | null>(null);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState<boolean>(false);
  const [isBrandAssetsOpen, setIsBrandAssetsOpen] = useState<boolean>(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const isAdmin = currentUser.role === 'admin' || currentUser.email === 'woodlandwoodchuckers@gmail.com';
  const isOrganizerOrAdmin = isAdmin || currentUser.role === 'organizer';

  // Listen to Firebase Auth state & check for passwordless email link sign-in
  useEffect(() => {
    checkAndCompleteEmailLinkSignIn().then((user) => {
      if (user && user.email) {
        console.info('Passwordless sign in verified for:', user.email);
        switchCurrentUser(user.email);
      }
    }).catch((err) => console.error('Email sign in check error:', err));

    const unsubscribe = onAuthChange((user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        switchCurrentUser(user.email);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-open check-in modal if scanned from table QR code (e.g. ?checkin=true or #checkin)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkin') === 'true' || window.location.hash === '#checkin') {
      if (runs.length > 0) {
        setSelectedRunForCheckIn(runs[0]);
      }
    }
  }, [runs]);

  // Scheduling or editing a run also updates that night's check-in event,
  // so runners pick from the run's distance options when they check in.
  const syncCheckInEvent = (run: Omit<RunEvent, 'id' | 'attendees'>, codeWord: string) => {
    const existing = meetupEvents.find((e) => e.date === run.date);
    saveMeetupEvent(buildMeetupFromRun(run, routes, codeWord, existing));
  };

  const handleAddRun = (run: Omit<RunEvent, 'id' | 'attendees'>, codeWord: string) => {
    addRun(run);
    syncCheckInEvent(run, codeWord);
  };

  const handleUpdateRun = (run: RunEvent, codeWord: string) => {
    updateRun(run);
    syncCheckInEvent(run, codeWord);
  };

  const handleViewRouteFromRun = (route: GPXRoute) => {
    setSelectedRoute(route);
    setActiveTab('routes');
  };

  const handleRouteUploaded = (newRouteData: Omit<GPXRoute, 'id'>) => {
    addRoute(newRouteData).then((saved) => {
      setSelectedRoute(saved);
      setIsUploadGpxOpen(false);
      setActiveTab('routes');
    });
  };

  const handleSaveRoute = async (routeData: Omit<GPXRoute, 'id'>, existingId?: string) => {
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
    await deleteRoute(routeId);
    if (selectedRoute.id === routeId && routes.length > 1) {
      setSelectedRoute(routes.find((r) => r.id !== routeId) || routes[0]);
    }
    setIsRouteStudioOpen(false);
    setEditingRoute(null);
  };

  const handleOpenRegister = () => {
    setCheckInInitialMode('register');
    if (runs.length > 0) {
      setSelectedRunForCheckIn(runs[0]);
    }
  };

  const handleQuickCheckIn = () => {
    setCheckInInitialMode('checkin');
    if (runs.length > 0) {
      setSelectedRunForCheckIn(runs[0]);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-sans pb-16 sm:pb-0">
      {/* Mobile PWA Install & Push Notification Banner */}
      <InstallPwaBanner />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        firebaseUser={firebaseUser}
        isFirebaseConfigured={isFirebaseConfigured}
        isSyncing={isSyncing}
        unreadNotifsCount={notifications.length}
        onOpenNewRun={() => setIsNewRunOpen(true)}
        onOpenUploadGpx={() => {
          setEditingRoute(null);
          setIsRouteStudioOpen(true);
        }}
        onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
        onOpenBrandAssets={() => setIsBrandAssetsOpen(true)}
        onToggleNotifications={() => setShowNotificationsDrawer(!showNotificationsDrawer)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenRegister={handleOpenRegister}
        onLogout={async () => {
          await logoutUser();
          setFirebaseUser(null);
          switchCurrentUser('');
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
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs sm:text-sm rounded-xl transition shadow-md font-display uppercase tracking-wide cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-stone-950" />
                      <span>Check In Tonight 🦫</span>
                    </button>

                    {/* Prominent Join Club button for Guests */}
                    {(currentUser.role === 'guest' || !currentUser.email) && (
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
                      <span>Club Milestones 🏆</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('routes')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-woodland-700/60 hover:bg-woodland-700 text-white font-semibold text-xs sm:text-sm rounded-xl border border-woodland-500/40 transition"
                    >
                      <Compass className="w-4 h-4 text-woodland-300" />
                      <span>Explore GPX Trails</span>
                    </button>
                    <button
                      onClick={() => setIsBrandAssetsOpen(true)}
                      className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/20 transition backdrop-blur-xs"
                      title="View & Download Official 2026 & Heritage Logos"
                    >
                      <Palette className="w-4 h-4 text-amber-300" />
                      <span>Club Logos</span>
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

                {/* Dual Logo Showcase */}
                <div className="flex items-center gap-4 shrink-0">
                  <div
                    onClick={() => setIsBrandAssetsOpen(true)}
                    className="cursor-pointer group flex flex-col items-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-xl transition group-hover:scale-105"
                    title="Click to view & download the 2026 Run Crew mascot logo"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center p-1 relative">
                      <img
                        src="/Woodchucker2026.png"
                        alt="Woodland Woodchuckers 2026 Run Crew Mascot"
                        className="max-h-full max-w-full object-contain filter drop-shadow-md transition group-hover:scale-110"
                      />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full mt-1.5 shadow-xs">
                      2026 Mascot
                    </span>
                  </div>

                  <div
                    onClick={() => setIsBrandAssetsOpen(true)}
                    className="hidden sm:flex cursor-pointer group flex-col items-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-xl transition group-hover:scale-105"
                    title="Click to view & download the original Blue Note bottle cap logo"
                  >
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shadow-md">
                      <img
                        src="/woodchuck.svg"
                        alt="Woodchuck Bottle Cap Logo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full mt-1.5 border border-white/30">
                      Classic Heritage
                    </span>
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

            {/* Run Cards List */}
            {runs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
                <AlertCircle className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-stone-600 font-medium text-sm">No group runs currently scheduled.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {runs.map((run) => {
                  const choices = resolveChoices(getRunChoices(run, routes), routes);
                  const attachedRoute = choices[0]?.route || routes.find((r) => r.id === run.routeId);
                  return (
                    <RunCard
                      key={run.id}
                      run={run}
                      route={attachedRoute}
                      choices={choices}
                      currentMember={currentMember}
                      onToggleRSVP={toggleRSVP}
                      onOpenCheckIn={(r) => setSelectedRunForCheckIn(r)}
                      onViewRoute={handleViewRouteFromRun}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GPX ROUTE EXPLORER */}
        {activeTab === 'routes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900 font-display">Woodland GPX Trail Library</h3>
                <p className="text-xs text-stone-500">
                  Interactive OpenStreetMap trail tracks, elevation profiles, and downloadable GPS routes.
                </p>
              </div>
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
            onOpenCheckIn={handleQuickCheckIn}
          />
        )}

        {/* TAB 4: MEMBERS & LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <Leaderboard
            members={members}
            badges={badges}
            currentMember={currentMember}
            onSelectMember={(id) => setCurrentMemberId(id)}
          />
        )}

        {/* TAB 5: ADMIN DASHBOARD */}
        {activeTab === 'admin' && (
          <AdminDashboard
            runs={runs}
            members={members}
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
            onCreateSpecialEvent={createSpecialEvent}
            onDeleteSpecialEvent={deleteSpecialEvent}
            onSaveMeetupEvent={saveMeetupEvent}
            onOpenNewRun={() => setIsNewRunOpen(true)}
            onEditRun={(r) => setEditingRun(r)}
            onDeleteRun={deleteRun}
            onUpdateMemberStats={updateMemberStats}
            onSendBroadcast={sendPushAnnouncement}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdmin={isAdmin}
        onQuickCheckIn={handleQuickCheckIn}
      />

      {/* Footer (Desktop) */}
      <footer className="hidden sm:block bg-white border-t border-stone-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <img src="/Woodchucker2026.png" alt="2026 Mascot" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-stone-800">Woodland Woodchuckers Run Club</span>
            <span>• Blue Note Brewing Co. • #1A607C Teal Brand</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsBrandAssetsOpen(true)}
              className="text-woodland-700 hover:text-woodland-900 hover:underline font-bold flex items-center gap-1"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Logos &amp; Brand Assets</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className="text-woodland-800 hover:underline font-bold"
              >
                Admin Dashboard
              </button>
            )}
            <button
              onClick={() => setIsSetupGuideOpen(true)}
              className="text-woodland-700 hover:underline font-semibold"
            >
              Zero-Credit-Card Setup Guide
            </button>
            <span>•</span>
            <span className="text-stone-400">PWA Ready • Offline Enabled</span>
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
              {notifications.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-8">No announcements yet.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <strong className="text-stone-900 font-bold">{n.title}</strong>
                      <span className="text-[10px] text-stone-400">
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">{n.body}</p>
                  </div>
                ))
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
                Send New Push Announcement
              </button>
            )}
          </div>
        </div>
      )}

      {/* Check In Modal (New Relational Check-in Experience) */}
      {selectedRunForCheckIn && (
        <CheckInModal
          isOpen={Boolean(selectedRunForCheckIn)}
          onClose={() => setSelectedRunForCheckIn(null)}
          meetupEvents={meetupEvents}
          eventDate={selectedRunForCheckIn.date}
          currentUser={currentUser}
          users={users}
          initialMode={checkInInitialMode}
          onCheckInRunner={checkInRunner}
          onRegisterUser={registerUser}
          onSearchLegacy={searchLegacyMatches}
          onSwitchUser={switchCurrentUser}
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
          onDelete={deleteRun}
          specialEvents={specialEvents}
          currentCodeWord={meetupEvents.find((e) => e.date === editingRun.date)?.codeWord || ''}
        />
      )}

      {isRouteStudioOpen && (
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

      {isUploadGpxOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl">
            <GpxUploader
              onRouteAdded={handleRouteUploaded}
              onCancel={() => setIsUploadGpxOpen(false)}
            />
          </div>
        </div>
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

      {/* Passwordless & Google Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(email) => {
          switchCurrentUser(email);
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}

export default App;
