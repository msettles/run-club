import { friendlyRunError } from './utils/runSaveError';
import { RouteSearch } from './components/RouteSearch';
import { emptyRouteFilters, filterRoutes } from './utils/routeSearch';
import { authReturnUrl } from './utils/authReturn';
import { Modal } from './components/Modal';
import { ModalLoadBoundary } from './components/ModalLoadBoundary';
import { LazyRouteMap } from './components/LazyRouteMap';
import { routeVersionLabel } from './utils/runChoices';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useClubStore } from './services/storage';
import { RunEvent, GPXRoute, UserProfile } from './types';
import { deleteRunConfirmMessage, getRunChoices, resolveChoices } from './utils/runChoices';
import { Navbar } from './components/Navbar';
import { MaintenanceNotice } from './components/MaintenanceNotice';
import { RunCard } from './components/RunCard';
import { StandingsPage } from './components/StandingsPage';
import { SubscribeMenu } from './components/SubscribeMenu';
import { EditProfileModal } from './components/EditProfileModal';
import { RunRosterModal } from './components/RunRosterModal';
import { PartnerThanks } from './components/PartnerThanks';
import { safeUrl } from './data/partner';
import { CLUB_ESTABLISHED } from './data/club';
import { memberKeyFor } from './utils/memberKey';
import { alertHasGear } from './utils/milestones';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { InstallAppLink } from './components/InstallAppLink';
import { MobileBottomNav } from './components/MobileBottomNav';
import { MilestonesPage } from './components/MilestonesPage';
import { FULL_VERSION } from './utils/version';
import { reconcilePushAccount, disablePushOnThisDevice, getPushStatus } from './services/push';
import { onAuthChange, logoutUser, checkAndCompleteEmailLinkSignIn } from './services/authService';
import { User as FirebaseUser } from 'firebase/auth';
import { auth, db } from './services/firebase';
import { rewardsAreCurrent } from './services/store/rewardSync';
import { doc, getDoc } from 'firebase/firestore';
import { downloadGPXFile } from './utils/gpxParser';
import { isAdminProfile, isStaffProfile } from './utils/roles';
import { formatOpening, formatCountdown, nextCheckInEvent, openCheckInEvents, checkInWindow, upcomingRuns, priorRuns, isRunLive } from './utils/checkInWindow';

// Lazy-loaded heavy components & modals (saves >60% initial mobile bundle size)
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const RouteStudioModal = lazy(() => import('./components/RouteStudioModal').then((m) => ({ default: m.RouteStudioModal })));
const RouteImportModal = lazy(() => import('./components/RouteImportModal').then((m) => ({ default: m.RouteImportModal })));
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
  AlertCircle,
  Mountain,
  Download,
  Sparkles,
  Bell,
  X,
  Palette,
  UserPlus,
  Edit3,
  CheckCircle,
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'runs' | 'routes' | 'milestones' | 'leaderboard' | 'admin'>('runs');

  const {
    runs,
    linkedRunId, linkedRunLoading, linkedRunError,
    members,
    leaderboardLoaded, leaderboardError,
    routes,
    loadRoute, refreshRoutes, loadMoreRoutes, hasMoreRoutes, routesLoading,
    badges,
    milestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    updateBadge,
    installStarterCatalog,
    catalogSeeded,
    catalogSettled,
    partner,
    savePartner,
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
    importRoute,
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
    importClubData,
    recomputeRewards,
    users,
    staffRosterLoaded, refreshStaffUsers, refreshGearHistory, loadMoreStaffUsers, searchStaffUsers, findStaffUser, loadRunRoster, exportStaffUsers, staffRosterLoading, staffRosterError, hasMoreStaffUsers,
    loadMoreGearHistory, gearHistoryLoading, gearHistoryError, hasMoreGearHistory,
    setUsers,
    meetupEvents,
    checkins,
    legacyMembers,
    currentUser,
    registerUser,
    updateOwnProfile,
    checkInRunner,
    refreshDerivedStats,
    resolveRunByCodeWord,
    countPushDevices,
    countRunCheckIns,
    scheduleLoaded,
    loadPriorRuns, loadMoreUpcomingRuns, hasMoreUpcomingRuns, priorRunsLoaded, priorRunsLoading, hasMorePriorRuns, priorRunsError,
    syncError,
    syncRevision,
    retrySync,
    switchCurrentUser,
    milestoneAlerts,
    markMilestoneFulfilled,
    specialEvents,
    createBadge,
    deleteBadge,
  } = useClubStore({ loadLeaderboard: activeTab === 'leaderboard' });

  
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
  const [isRouteImportOpen, setIsRouteImportOpen] = useState(false);
  const [routeActionId, setRouteActionId] = useState<string | null>(null);
  const [routeActionError, setRouteActionError] = useState<string>();
  const routeActionPending = useRef(false);
  const [editingRoute, setEditingRoute] = useState<GPXRoute | null>(null);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState<boolean>(false);
  const [isBrandAssetsOpen, setIsBrandAssetsOpen] = useState<boolean>(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState<boolean>(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  // Bell read state (per browser): items read one by one, plus "mark all as read"
  // which marks everything up to that moment.
  const BELL_READ_KEY = 'woodchuckers_bell_read_v1';
  const [bellRead, setBellRead] = useState<{ allBefore: string; ids: string[] }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(BELL_READ_KEY) || 'null');
      if (saved && typeof saved.allBefore === 'string' && Array.isArray(saved.ids)) return saved;
      // Earlier builds stored "last opened": treat everything before it as read.
      return { allBefore: localStorage.getItem('woodchuckers_bell_seen_at') || '', ids: [] };
    } catch {
      return { allBefore: '', ids: [] };
    }
  });
  const saveBellRead = (next: { allBefore: string; ids: string[] }) => {
    setBellRead(next);
    try {
      localStorage.setItem(BELL_READ_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };
  const isBellItemRead = (n: { id: string; timestamp: string }) => n.timestamp <= bellRead.allBefore || bellRead.ids.includes(n.id);
  const markBellItemRead = (id: string) => {
    if (!bellRead.ids.includes(id)) saveBellRead({ ...bellRead, ids: [...bellRead.ids, id].slice(-200) });
  };
  const markAllBellRead = () => saveBellRead({ allBefore: new Date().toISOString(), ids: [] });
  const toggleBell = () => setShowNotificationsDrawer((open) => !open);

  // Selected route for viewing
  const [routeFilters, setRouteFilters] = useState({ ...emptyRouteFilters });
  const [routeSearchError, setRouteSearchError] = useState(false);
  const filteredLibraryRoutes = filterRoutes(routes, routeFilters);
  useEffect(() => {
    if (activeTab !== 'routes' || !hasMoreRoutes || routesLoading || routeSearchError) return;
    void loadMoreRoutes().catch(() => setRouteSearchError(true));
  }, [activeTab, hasMoreRoutes, routesLoading, routes.length, routeSearchError, loadMoreRoutes]);

  const [selectedRoute, setSelectedRoute] = useState<GPXRoute | undefined>(routes[0]);

  // Keep selectedRoute valid and in sync when routes load or change
  useEffect(() => {
    const latest = routes.find((r) => r.id === selectedRoute?.id) || routes[0];
    if (latest !== selectedRoute) setSelectedRoute(latest);
  }, [routes, selectedRoute]);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // False until Firebase has restored the sign-in (and loaded the profile), so the
  // navbar doesn't flash a Sign In button on refresh.
  const [authReady, setAuthReady] = useState<boolean>(!isFirebaseConfigured);
  const [authLinkReady, setAuthLinkReady] = useState(!isFirebaseConfigured);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [rosterRun, setRosterRun] = useState<RunEvent | null>(null);
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

  // First time an admin opens a club whose starter pack (milestones, badges, special events) hasn't been written yet,
  // save it, so everything is the club's own data that can be edited or deleted. It runs once.
  const seedingStarted = useRef(false);
  useEffect(() => {
    if (!isFirebaseConfigured || !isAdmin || !catalogSettled || catalogSeeded || seedingStarted.current) return;
    seedingStarted.current = true;
    void installStarterCatalog().catch((error) => { seedingStarted.current = false; console.warn('Could not save the starter milestones and badges:', error); });
  }, [isAdmin, catalogSettled, catalogSeeded, installStarterCatalog]);

  // Runs the signed-in runner has checked into, and whether that includes a run open right now.
  const myEmail = (currentUser.email || '').toLowerCase();
  const myCheckedInRunIds = new Set(
    isUserLoggedIn && myEmail
      ? checkins.filter((c) => c.userEmail.toLowerCase() === myEmail && c.runId).map((c) => c.runId as string)
      : []
  );
  // Standings are for signed-in runners; send anyone else back to Runs.
  useEffect(() => {
    if (authReady && activeTab === 'leaderboard' && !isUserLoggedIn) setActiveTab('runs');
  }, [authReady, activeTab, isUserLoggedIn]);
  // Gear still owed to a runner who checks in again: the run card counts it too. Alerts are keyed by email
  // and RSVPs by member key, so keep a small email -> key map for the outstanding alerts.
  const [alertKeys, setAlertKeys] = useState<Record<string, string>>({});
  const owedEmails = milestoneAlerts.filter((a) => !a.fulfilled).map((a) => a.userEmail.toLowerCase()).sort().join(',');
  useEffect(() => {
    if (!isOrganizerOrAdmin || !owedEmails) { setAlertKeys({}); return; }
    let live = true;
    void Promise.all([...new Set(owedEmails.split(','))].map(async (email) => [email, await memberKeyFor(email)] as const))
      .then((pairs) => { if (live) setAlertKeys(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [isOrganizerOrAdmin, owedEmails]);
  const milestoneAlertsFor = (run: RunEvent): number => {
    const ids = new Set(milestoneAlerts.filter((a) => a.runId === run.id && !a.fulfilled).map((a) => a.id));
    const here = new Set(run.attendees.filter((a) => a.checkedIn).map((a) => a.memberId));
    for (const a of milestoneAlerts) if (!a.fulfilled && alertHasGear(a) && alertKeys[a.userEmail.toLowerCase()] && here.has(alertKeys[a.userEmail.toLowerCase()])) ids.add(a.id);
    return ids.size;
  };
  // RSVP lists keep the name saved at RSVP time; show the runner's current name where we know it.
  const nameForMember = (memberId: string, stored: string) =>
    memberId === currentMember.id ? currentMember.name : members.find((m) => m.id === memberId)?.name || stored;
  const checkedInTonight = openCheckInEvents(meetupEvents).some((e) => myCheckedInRunIds.has(e.id));
  // Tick each minute so the hero button's "opens in …" countdown stays current.
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClockNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const checkInOpenNow = openCheckInEvents(meetupEvents, clockNow).length > 0;
  const nextCheckIn = checkInOpenNow ? undefined : nextCheckInEvent(meetupEvents, clockNow);

  // Refs so the auth listener can be subscribed once without stale values
  const usersRef = useRef(users);
  usersRef.current = users;
  const pendingCheckInRunRef = useRef(pendingCheckInRun);
  pendingCheckInRunRef.current = pendingCheckInRun;

  const authEpoch = useRef(0);
  const authenticatedEmail = useRef('');

  // Handle post-auth check: if user has a profile, switch to them; if new, launch onboarding
  const handleUserAuthenticated = async (email: string, displayName?: string | null, epoch = authEpoch.current) => {
    const cleanEmail = email.trim().toLowerCase();
    
    let existingProfile = usersRef.current.find((u) => u.email.toLowerCase() === cleanEmail);
    if (isFirebaseConfigured && db) {
      try {
        const snap = await getDoc(doc(db, 'users', cleanEmail));
        if (epoch !== authEpoch.current) return;
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
        if (epoch === authEpoch.current) setCheckInNotice('Your sign-in succeeded, but your club profile could not be loaded. Please reload the app and try again.');
        return;
      }
    }

    if (epoch !== authEpoch.current) return;
    setIsAuthModalOpen(false);
    if (existingProfile) {
      switchCurrentUser(cleanEmail);
      reconcilePushAccount(cleanEmail).catch((err) => console.warn('Notification account registration failed:', err));
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
    let active = true;
    checkAndCompleteEmailLinkSignIn().then(() => {
      if (active) setAuthLinkReady(true);
    }).catch((err) => {
      if (!active) return;
      setAuthLinkReady(false);
      console.error('Email sign in check error:', err);
      setCheckInNotice('The sign-in link could not be completed. Request a fresh link and try again.');
      setIsAuthModalOpen(true);
    });

    const sessionEpoch = authEpoch;
    const unsubscribe = onAuthChange((user) => {
      const epoch = ++authEpoch.current;
      if (isFirebaseConfigured) { setAuthReady(false); clearPrivateData(); }
      setSelectedRunForCheckIn(null);
      setIsOnboardingOpen(false);
      authenticatedEmail.current = user?.email?.toLowerCase() || '';
      setFirebaseUser(user);
      if (user && user.email) {
        handleUserAuthenticated(user.email, user.displayName, epoch).finally(() => {
          if (epoch === authEpoch.current) setAuthReady(true);
        });
      } else {
        // Local mode has no accounts: the browser's saved runner stays selected.
        if (isFirebaseConfigured) {
          switchCurrentUser('');
          clearPrivateData();
        }
        setAuthReady(true);
      }
    });

    return () => { active = false; sessionEpoch.current++; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Role changes must replace subscriptions as well as update navigation.
  useEffect(() => {
    if (!isFirebaseConfigured || !authReady || !currentUser.email || currentUser.role === 'guest') return;
    void syncPrivateData(currentUser.email, isStaffProfile(currentUser), isAdminProfile(currentUser));
    // The operation closures change each render; only identity/role changes restart listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, currentUser.email, currentUser.role, syncRevision]);

  // Badges and streaks are recalculated from the runner's whole history, which is
  // many reads. Skip it when this device already refreshed against the same profile
  // state and badge catalog (the catalog is part of scheduleLoaded).
  useEffect(() => {
    if (!isFirebaseConfigured || !authReady || !scheduleLoaded || !currentUser.email || currentUser.role === 'guest') return;
    let active = true;
    void rewardsAreCurrent(currentUser, badges).then((current) => {
      if (active && !current) return refreshDerivedStats(currentUser);
    }).catch((err) => console.warn('Reward refresh needs a retry:', err));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, scheduleLoaded, currentUser.email, currentUser.role, syncRevision]);

  const openCheckInFor = (target: CheckInTarget) => {
    if (!isUserLoggedIn || currentUser.role === 'guest') {
      setPendingCheckInRun(target);
      handleOpenRegister();
    } else {
      setSelectedRunForCheckIn(target);
    }
  };
  const handleOpenCheckIn = (run: Pick<RunEvent, 'id'>) => openCheckInFor({ runId: run.id });

  const handleOpenRegister = () => {
    if (firebaseUser?.email && currentUser.role === 'guest') {
      setOnboardingEmail(firebaseUser.email);
      setOnboardingDisplayName(firebaseUser.displayName || '');
      setIsOnboardingOpen(true);
    } else if (isUserLoggedIn) {
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
    if (qrHandledRef.current || !scheduleLoaded || !authReady || !authLinkReady || (linkedRunId && linkedRunLoading)) return;
    if (isFirebaseConfigured && auth?.currentUser?.uid !== firebaseUser?.uid) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkin') === 'true' || window.location.hash === '#checkin') {
      qrHandledRef.current = true;
      if (linkedRunId) openCheckInFor({ runId: linkedRunId });
      else handleQuickCheckIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleLoaded, meetupEvents, authReady, authLinkReady, firebaseUser?.uid, linkedRunId, linkedRunLoading]);

  // Scheduling or editing a run also updates that night's check-in event,
  // so runners pick from the run's distance options when they check in.
  // Errors from these are shown inside the New Run / Edit Run form, which stays open.

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
      await updateRun(run, codeWord);
    } catch (err) {
      console.error('Saving run failed:', err);
      throw friendlyRunError(err);
    }
  };

  const handleViewRouteFromRun = (route: GPXRoute) => {
    setSelectedRoute(route);
    setActiveTab('routes');
  };

  const handleRouteAction = async (route: GPXRoute, action: 'edit' | 'download') => {
    if (routeActionPending.current) return;
    routeActionPending.current = true; setRouteActionId(route.id); setRouteActionError(undefined);
    try {
      const full = await loadRoute(route.id);
      if (action === 'download') downloadGPXFile(full);
      else { setEditingRoute(full); setIsRouteStudioOpen(true); }
    } catch (cause) { setRouteActionError(cause instanceof Error ? cause.message : 'Route details could not be loaded. Please retry.'); }
    finally { routeActionPending.current = false; setRouteActionId(null); }
  };

  const handleSaveRoute = async (routeData: Omit<GPXRoute, 'id'>, existingId?: string) => {
    if (!isOrganizerOrAdmin) {
      alert('Only organizers and club administrators can create or edit routes.');
      return;
    }
    // Errors are shown inside the Route Studio, which stays open.
    try {
      setSelectedRoute(existingId ? await updateRoute(existingId, routeData) : await addRoute(routeData));
    } catch (err) {
      console.error('Saving route failed:', err);
      const { code, message } = (err || {}) as { code?: string; message?: string };
      throw new Error(
        code === 'route-too-large' && message
          ? message
          : `Route not saved${code ? ` (${code})` : ''}. Please check your connection and try again.`
      );
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
    if (selectedRoute?.id === routeId && routes.length > 1) {
      setSelectedRoute(routes.find((r) => r.id !== routeId) || routes[0]);
    }
    setIsRouteStudioOpen(false);
    setEditingRoute(null);
  };

  const closeLazyDialogs = () => {
    setCheckInNotice(null); setSelectedRunForCheckIn(null); setPendingCheckInRun(null);
    setIsNewRunOpen(false); setEditingRun(null); setIsRouteStudioOpen(false); setEditingRoute(null);
    setIsSetupGuideOpen(false); setIsBrandAssetsOpen(false); setIsVersionModalOpen(false);
    setIsAuthModalOpen(false); setIsOnboardingOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100 font-sans pb-16 md:pb-0 w-full overflow-x-hidden">
      {/* Mobile PWA Install & Push Notification Banner */}
      <InstallPwaBanner
        pushAccount={isUserLoggedIn && currentUser.email ? { email: currentUser.email, memberKey: currentMember.id } : undefined}
      />

      {/* Top Navigation */}
      <MaintenanceNotice isAdmin={isAdmin} />
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        firebaseUser={firebaseUser}
        isSignedIn={isUserLoggedIn}
        onEditProfile={isUserLoggedIn && isProfileVerified ? () => setIsEditProfileOpen(true) : undefined}
        authReady={authReady}
        unreadNotifsCount={bellItems.filter((n) => !isBellItemRead(n)).length}
        onOpenUploadGpx={() => {
          setEditingRoute(null);
          setIsRouteStudioOpen(true);
        }}
        onToggleNotifications={toggleBell}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenRegister={handleOpenRegister}
        onOpenVersionModal={() => setIsVersionModalOpen(true)}
        onLogout={async () => {
          try { if (await getPushStatus() === 'on') await disablePushOnThisDevice(); }
          catch (err) { console.warn('Notification cleanup failed during sign-out:', err); }
          setSelectedRunForCheckIn(null);
          setPendingCheckInRun(null);
          await logoutUser();
          setFirebaseUser(null);
          switchCurrentUser('');
          clearPrivateData();
        }}
      />

      {syncError && <div role="alert" className="mx-auto mt-4 w-full max-w-7xl rounded-xl bg-amber-100 p-3 text-sm text-amber-950">{syncError} <button type="button" onClick={retrySync} className="font-bold underline">Retry loading</button></div>}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Admins: a shortcut to the portal on every page except the portal itself */}
        {isAdmin && activeTab !== 'admin' && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="flex items-center gap-1.5 rounded-full border border-stone-700 bg-stone-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-stone-800 cursor-pointer"
            >
              <span>Admin Portal</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
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
                    <span>
                      Wednesday Night Runs •{' '}
                      {safeUrl(partner.website) ? (
                        <a href={safeUrl(partner.website)} target="_blank" rel="noopener noreferrer" className="underline decoration-woodland-300/60 underline-offset-2 hover:text-white">{partner.name}</a>
                      ) : partner.name}
                    </span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl font-display font-extrabold tracking-wide uppercase leading-tight">
                    Woodland Woodchuckers
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm font-semibold uppercase tracking-widest text-amber-300/90">Established {CLUB_ESTABLISHED}</p>
                  <p className="mt-2 text-sm sm:text-base text-woodland-100/90 leading-relaxed font-sans">
                    Join our weekly Wednesday night group runs, starting at Blue Note Brewing Company in
                    Woodland CA, check in to build your milestones, get a club shirt, $1 off beers, track
                    your lifetime miles, and earn other fun club badges — 100% free!
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* One primary action: join (guests, nothing open), else check in or the countdown */}
                    {!checkInOpenNow && !isUserLoggedIn ? (
                      authReady && (
                        <button
                          onClick={handleOpenRegister}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] sm:text-sm rounded-xl transition shadow-md font-display uppercase tracking-wide cursor-pointer"
                          title="Join the Club (Free, 24/7/365)"
                        >
                          <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-200" />
                          <span>Join Club<span className="hidden sm:inline"> (Free)</span></span>
                        </button>
                      )
                    ) : (
                      <button
                        onClick={handleQuickCheckIn}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 font-black text-[11px] sm:text-sm rounded-xl transition shadow-md font-display uppercase tracking-wide cursor-pointer ${
                          checkedInTonight
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 text-stone-950'
                        }`}
                      >
                        {checkedInTonight ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Checked In ✓</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-950" />
                            <span>
                              {nextCheckIn
                                ? (<>
                                    <span className="sm:hidden">Opens in {formatCountdown(checkInWindow(nextCheckIn).opensAt, clockNow)}</span>
                                    <span className="hidden sm:inline">Check In opens in {formatCountdown(checkInWindow(nextCheckIn).opensAt, clockNow)}</span>
                                  </>)
                                : 'Check In 🦫'}
                            </span>
                          </>
                        )}
                      </button>
                    )}

                  </div>
                </div>
              </div>
            </div>

            {/* Run Schedule Header */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-stone-900 font-display">Upcoming Run Schedule</h3>
                <p className="text-xs text-stone-500">
                  Wednesdays at Blue Note Brewing Co. (6:30 PM) • All runs start &amp; finish on the brewery patio!
                </p>
              </div>
              {isOrganizerOrAdmin && (
                <button type="button" onClick={() => setIsNewRunOpen(true)} className="flex items-center gap-2 rounded-xl bg-woodland-700 px-4 py-2 text-sm font-bold text-white hover:bg-woodland-800">
                  <Plus className="w-4 h-4" />
                  <span>Create run</span>
                </button>
              )}
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
                    nameFor={nameForMember}
                    isSignedIn={isUserLoggedIn}
                    isCheckedIn={myCheckedInRunIds.has(run.id)}
                    notLive={!isRunLive(run, meetupEvents)}
                    onOpenRoster={isOrganizerOrAdmin ? setRosterRun : undefined}
                    milestoneAlertCount={isOrganizerOrAdmin && !past ? milestoneAlertsFor(run) : 0}
                    onEdit={isOrganizerOrAdmin && !past ? setEditingRun : undefined}
                    onDelete={isAdmin && past ? confirmDeletePastRun : undefined}
                  />
                );
              };
              // Runs without a saved code word aren't live: only staff see them (to finish setting them up).
              const visible = runs.filter((r) => isOrganizerOrAdmin || isRunLive(r, meetupEvents));
              const shared = visible.find((run) => run.id === linkedRunId);
              const upcoming = upcomingRuns(visible.filter((run) => run.id !== shared?.id));
              const prior = priorRuns(visible.filter((run) => run.id !== shared?.id));
              return (
                <div className="space-y-4">
                  {linkedRunId && <section aria-label="Shared run" className="space-y-3 rounded-2xl border-2 border-woodland-600 p-3">
                    <h3 className="text-xl font-bold">Shared run</h3>
                    {linkedRunLoading ? <p role="status">Loading shared run…</p> : linkedRunError ? <p role="alert">{linkedRunError} <button type="button" onClick={retrySync} className="underline">Retry</button></p> : shared ? renderRun(shared, priorRuns([shared]).length > 0) : <p>This run is unavailable or is no longer published.</p>}
                  </section>}
                  {upcoming.length === 0 && !shared ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
                      <AlertCircle className="w-8 h-8 text-stone-400 mx-auto" />
                      <p className="text-stone-600 font-medium text-sm">{scheduleLoaded ? 'No upcoming runs scheduled.' : syncError ? 'The run schedule is unavailable. Please retry loading.' : 'Loading run schedule…'}</p>
                    </div>
                  ) : (
                    upcoming.map((r) => renderRun(r))
                  )}

                  {hasMoreUpcomingRuns && <button type="button" onClick={loadMoreUpcomingRuns} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">Load more upcoming runs</button>}
                  <div className="pt-1">
                    <SubscribeMenu />
                  </div>
                  {(prior.length > 0 || isFirebaseConfigured) && (
                    <div className="pt-2 space-y-4">
                      <button
                        type="button"
                        onClick={() => { if (!showPriorRuns && !priorRunsLoaded) void loadPriorRuns().catch(() => {}); setShowPriorRuns((v) => !v); }}
                        aria-expanded={showPriorRuns}
                        className="w-full py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 rounded-xl transition"
                      >
                        {showPriorRuns ? 'Hide prior runs' : 'Show prior runs'}
                      </button>
                      {showPriorRuns && (
                        <>
                          <h4 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Prior Runs</h4>
                          {prior.map((r) => renderRun(r, true))}
                          {priorRunsError && <p role="alert" className="text-sm text-amber-900">{priorRunsError}</p>}
                          {priorRunsLoading && <p role="status" className="text-sm text-stone-500">Loading prior runs…</p>}
                          {!priorRunsLoading && priorRunsLoaded && !prior.length && !priorRunsError && <p className="text-sm text-stone-500">No published prior runs on this page.</p>}
                          {(hasMorePriorRuns || priorRunsError) && <button type="button" disabled={priorRunsLoading} onClick={() => { void loadPriorRuns().catch(() => {}); }} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{priorRunsError ? 'Retry prior runs' : 'Load more prior runs'}</button>}
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
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setIsRouteImportOpen(true)} className="px-4 py-2 border border-woodland-800 text-woodland-800 font-bold text-xs rounded-xl hover:bg-stone-100">Import routes</button>
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
              )}
            </div>

            {routeActionId && <p role="status" className="text-sm text-stone-600">Loading route details…</p>}
            {routeActionError && <p role="alert" className="text-sm text-amber-900">{routeActionError}</p>}

            {/* Selected Route Map Viewer */}
            {selectedRoute && (
              <div id="selected-library-route" className="scroll-mt-20"><Suspense
                fallback={<div className="h-[480px] rounded-2xl bg-white border border-stone-200 animate-pulse" aria-label="Loading map" />}
              >
                <LazyRouteMap
                  loadRoute={loadRoute}
                  route={selectedRoute}
                  height="480px"
                  showElevationProfile={true}
                  canEdit={isOrganizerOrAdmin}
                  onEditRoute={(r) => {
                    setEditingRoute(r);
                    setIsRouteStudioOpen(true);
                  }}
                />
              </Suspense></div>
            )}

            <RouteSearch filters={routeFilters} onChange={setRouteFilters} routes={routes} count={filteredLibraryRoutes.length} incomplete={hasMoreRoutes && !routeSearchError} />
            {routeSearchError && <p role="alert" className="text-sm text-amber-900">Search covers loaded routes only because the rest of the library could not be loaded. <button type="button" onClick={() => setRouteSearchError(false)} className="underline font-bold">Retry loading routes</button></p>}
            {filteredLibraryRoutes.length === 0 && <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">No routes match these filters. Try a different name or mileage range.</p>}

            {/* Route Cards Carousel / Grid */}
            <div id="library-route-cards" className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {filteredLibraryRoutes.map((r) => (
                <div
                  key={r.id}
                  className={`p-4 rounded-xl border bg-white transition ${
                    selectedRoute?.id === r.id
                      ? 'border-woodland-600 ring-2 ring-woodland-500/20 shadow-sm'
                      : 'border-stone-200 hover:border-woodland-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-stone-900 leading-snug"><button type="button" onClick={() => { setSelectedRoute(r); document.getElementById('selected-library-route')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} aria-pressed={selectedRoute?.id === r.id} className="text-left underline-offset-4 hover:underline">{r.name}</button></h4>
                    {r.updatedAt && <p className="text-[10px] text-stone-500">{routeVersionLabel(r)}</p>}
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
                            void handleRouteAction(r, 'edit');
                          }}
                          className="text-stone-400 hover:text-woodland-800 p-1"
                          disabled={Boolean(routeActionId)}
                          title="Edit Route Details & Directions"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRouteAction(r, 'download');
                        }}
                        className="text-stone-400 hover:text-stone-800 p-1"
                        disabled={Boolean(routeActionId)}
                        title="Download GPX"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {isFirebaseConfigured && <div className="flex justify-center pt-2"><button type="button" disabled={routesLoading} onClick={() => { setRouteSearchError(false); void refreshRoutes().catch(() => setRouteSearchError(true)); }} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh route library</button></div>}
          </div>
        )}

        {/* TAB 3: MILESTONES & REWARDS SHOWCASE */}
        {activeTab === 'milestones' && (
          <MilestonesPage
            currentUser={currentUser}
            badges={badges}
            milestones={milestones}
            partner={partner}
            isSignedIn={isUserLoggedIn}
            onJoin={handleOpenRegister}
          />
        )}

        {/* TAB 4: STANDINGS (signed-in runners only) */}
        {activeTab === 'leaderboard' && isUserLoggedIn && (
          <StandingsPage
            members={members}
            loading={!leaderboardLoaded} error={leaderboardError} onRetry={retrySync}
            badges={badges}
            milestones={milestones}
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
              staffRosterLoaded={staffRosterLoaded} onRefreshStaffUsers={refreshStaffUsers} onRefreshGearHistory={refreshGearHistory}
              onSearchStaffUsers={searchStaffUsers} onLoadMoreStaffUsers={loadMoreStaffUsers} onFindStaffUser={findStaffUser} onExportStaffUsers={exportStaffUsers}
              staffRosterLoading={staffRosterLoading} staffRosterError={staffRosterError} hasMoreStaffUsers={hasMoreStaffUsers}
              onLoadMoreGearHistory={loadMoreGearHistory} gearHistoryLoading={gearHistoryLoading} gearHistoryError={gearHistoryError} hasMoreGearHistory={hasMoreGearHistory}
              legacyMembers={legacyMembers}
              milestoneAlerts={milestoneAlerts}
              onMarkMilestoneFulfilled={markMilestoneFulfilled}
              currentUser={currentUser}
              specialEvents={specialEvents}
              partner={partner}
              onSavePartner={savePartner}
              milestones={milestones}
              onCreateMilestone={createMilestone}
              onUpdateMilestone={updateMilestone}
              onUpdateBadge={updateBadge}
              onInstallStarterCatalog={installStarterCatalog}
              onDeleteMilestone={deleteMilestone}
              onCreateBadge={createBadge}
              onDeleteBadge={deleteBadge}
              onOpenNewRun={() => setIsNewRunOpen(true)}
              onSendBroadcast={sendPushAnnouncement}
              onDeleteAnnouncement={deleteAnnouncement}
              onSetUserRole={setUserRole}
              onDeleteRunner={adminDeleteRunner}
              onSetLegacyClaim={adminSetLegacyClaim}
              onImportLegacyData={importLegacyData}
              onImportClubData={importClubData}
              onRecomputeRewards={recomputeRewards}
              onReloadLegacyPool={loadLegacyPool}
              onCountPushDevices={countPushDevices}
              onLoadPriorRuns={loadPriorRuns} priorRunsLoading={priorRunsLoading} hasMorePriorRuns={hasMorePriorRuns} priorRunsError={priorRunsError}
            />
          </Suspense>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSignedIn={isUserLoggedIn}
        onQuickCheckIn={handleQuickCheckIn}
      />

      {/* Thank-you to the club's home-base partner, on every page */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-10">
        <PartnerThanks partner={partner} />
      </div>

      {/* Footer (Mobile & Desktop with bottom navigation spacing) */}
      <footer className="bg-white border-t border-stone-200 py-6 mt-6 pb-24 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <img src="/Woodchucker2026.png" alt="2026 Mascot" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-stone-800">Woodland Woodchuckers Run Club</span>
            <span>• Est. {CLUB_ESTABLISHED}</span>
            <span>
              •{' '}
              {safeUrl(partner.website) ? (
                <a href={safeUrl(partner.website)} target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-800">{partner.name}</a>
              ) : partner.name}
            </span>
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
            <a
              href="https://github.com/msettles/run-club"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-stone-500 hover:underline"
              data-testid="built-with-run-club"
            >
              <span>Built with</span>
              <img src="/runclub-icon.png" alt="" width={16} height={16} className="w-4 h-4 object-contain" />
              <span className="font-semibold text-stone-800">Run Club</span>
            </a>
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
              {bellItems.some((n) => !isBellItemRead(n)) && (
                <button
                  type="button"
                  onClick={markAllBellRead}
                  className="ml-auto mr-2 text-[11px] font-bold text-woodland-700 hover:text-woodland-900 hover:underline"
                >
                  Mark all as read
                </button>
              )}
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
                  const unread = !isBellItemRead(n);
                  const when = new Date(n.timestamp);
                  const box = `block w-full text-left p-3 rounded-xl space-y-1 border transition ${
                    isPush ? 'bg-indigo-50' : 'bg-stone-50'
                  } ${
                    unread
                      ? isPush ? 'border-indigo-400 shadow-sm' : 'border-amber-400 shadow-sm'
                      : isPush ? 'border-indigo-200 opacity-80' : 'border-stone-200 opacity-80'
                  }`;
                  const content = (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isPush ? 'text-indigo-600' : 'text-amber-700'}`}>
                          {isPush ? '📲 Push notification' : '📣 Announcement'}
                        </span>
                        {unread && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950">
                            New
                          </span>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2 text-xs">
                        <strong className={`${unread ? 'font-black' : 'font-bold'} ${isPush ? 'text-indigo-950' : 'text-stone-900'}`}>{n.title}</strong>
                        <span className="text-[10px] text-stone-400 shrink-0">
                          {when.toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      {n.body && <p className={`text-xs leading-relaxed ${isPush ? 'text-indigo-900/80' : 'text-stone-600'}`}>{n.body}</p>}
                      {unread && <span className="block text-[10px] text-stone-400">Tap to mark as read</span>}
                    </>
                  );
                  return isPush && n.link && n.link !== '/' ? (
                    <a key={n.id} href={n.link} onClick={() => markBellItemRead(n.id)} className={`${box} hover:bg-indigo-100`}>
                      {content}
                    </a>
                  ) : (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markBellItemRead(n.id)}
                      aria-label={`${n.title}${unread ? ', unread. Mark as read' : ''}`}
                      className={box}
                    >
                      {content}
                    </button>
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
      <ModalLoadBoundary onClose={closeLazyDialogs}>
      <Suspense fallback={<Modal title="Loading window" onClose={closeLazyDialogs} className="fixed inset-0 flex items-center justify-center bg-stone-950/80 p-4"><div className="rounded-2xl bg-white p-6"><p role="status">Loading…</p><button type="button" onClick={closeLazyDialogs} className="mt-4 rounded border px-4 py-2">Cancel</button></div></Modal>}>
        {checkInNotice && (
          <Modal title="Check-in notice" onClose={() => setCheckInNotice(null)}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/70 backdrop-blur-sm p-4"
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
          </Modal>
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
            milestones={milestones}
            routes={routes}
            checkins={checkins}
            onCheckInRunner={checkInRunner}
            onLoadRoute={loadRoute}
            onOpenAuthModal={() => { setPendingCheckInRun(selectedRunForCheckIn); handleOpenRegister(); }}
          />
        )}

        {isNewRunOpen && isOrganizerOrAdmin && (
          <NewRunModal
            isOpen={isNewRunOpen}
            onClose={() => setIsNewRunOpen(false)}
            routes={routes}
            organizerName={currentMember.name}
            onLoadMoreRoutes={loadMoreRoutes} hasMoreRoutes={hasMoreRoutes} routesLoading={routesLoading}
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
            onLoadMoreRoutes={loadMoreRoutes} hasMoreRoutes={hasMoreRoutes} routesLoading={routesLoading}
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

        {isRouteImportOpen && isOrganizerOrAdmin && (
          <RouteImportModal onClose={() => setIsRouteImportOpen(false)} onImport={async (id, route) => {
            if (!isOrganizerOrAdmin) throw new Error('Only organizers and administrators can import routes.');
            return importRoute(id, route);
          }} />
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

        {/* Rendered only while open, so their code downloads on first use, not at startup. */}
        {isSetupGuideOpen && (
          <FirebaseSetupGuide
            isOpen
            onClose={() => setIsSetupGuideOpen(false)}
            isConfigured={isFirebaseConfigured}
          />
        )}

        {isBrandAssetsOpen && <BrandAssetsModal isOpen onClose={() => setIsBrandAssetsOpen(false)} />}

        {isVersionModalOpen && <VersionModal isOpen onClose={() => setIsVersionModalOpen(false)} />}

        {/* Passwordless & Google Auth Modal. The auth listener above loads the
            profile after any sign-in, so success here only closes the modal. */}
        {isAuthModalOpen && (
          <AuthModal
            returnUrl={authReturnUrl(window.location.href, pendingCheckInRun || undefined)}
            isOpen
            onClose={() => setIsAuthModalOpen(false)}
            onAuthSuccess={() => { setAuthLinkReady(true); setIsAuthModalOpen(false); }}
          />
        )}

        {rosterRun && isOrganizerOrAdmin && (
          <RunRosterModal
            run={rosterRun}
            alerts={milestoneAlerts}
            users={users}
            onLoadRoster={loadRunRoster}
            onFindUser={findStaffUser}
            onMarkFulfilled={markMilestoneFulfilled}
            staffName={currentUser.displayName || currentUser.email || 'Organizer'}
            onClose={() => setRosterRun(null)}
          />
        )}

        {isEditProfileOpen && isUserLoggedIn && (
          <EditProfileModal user={currentUser} onSave={updateOwnProfile} onClose={() => setIsEditProfileOpen(false)} />
        )}

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
              if (isFirebaseConfigured && authenticatedEmail.current !== newUser.email.toLowerCase()) return;
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
      </ModalLoadBoundary>
    </div>
  );
}

export default App;
