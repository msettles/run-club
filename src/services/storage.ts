import { useEffect } from 'react';
import { RunEvent, Badge, SpecialEventDefinition } from '../types';
import { INITIAL_ROUTES, INITIAL_BADGES, INITIAL_SPECIAL_EVENTS } from '../data/initialData';
import { isFirebaseConfigured, db } from './firebase';
import { collection, getDocs, orderBy, limit, onSnapshot, query } from 'firebase/firestore';
import { ClubNotification, showLocalNotification } from './notifications';
import { useStoreState } from './store/state';
import { createLegacyOps } from './store/legacy';
import { createPrivateSyncOps } from './store/privateSync';
import { createMemberOps } from './store/members';
import { createCheckInOps } from './store/checkIn';
import { createEventOps } from './store/events';
import { createBadgeOps } from './store/badges';
import { createRunOps } from './store/runs';
import { createAnnouncementOps } from './store/announcements';
import { hydrateRouteFromFirestore, meetupFromPublicDoc, memberFromPublicDoc } from './store/helpers';
// Re-exported for existing importers.
export { cleanFirestoreData, formatRouteForFirestore, hydrateRouteFromFirestore, toPublicMember, RECENT_CHECKIN_DAYS } from './store/helpers';

/** Built-in catalog entries plus the ones saved in Firestore (saved copies win). */
function withCatalog<T extends { id: string }>(remote: T[], builtIn: T[]): T[] {
  const ids = new Set(remote.map((x) => x.id));
  return [...builtIn.filter((x) => !ids.has(x.id)), ...remote];
}

export function useClubStore() {
  const s = useStoreState();
  const {
    setRuns,
    setRoutes,
    setMembers,
    setBadges,
    setSpecialEvents,
    setNotifications,
    setIsSyncing,
    setMeetupEvents,
    setScheduleLoaded,
    staffCodeWords,
  } = s;

  // Each group of operations can use the state and every group created before it.
  const c1 = { ...s, ...createLegacyOps(s) };
  const c2 = { ...c1, ...createPrivateSyncOps(c1) };
  const c3 = { ...c2, ...createMemberOps(c2) };
  const c4 = { ...c3, ...createCheckInOps(c3) };
  const c5 = { ...c4, ...createEventOps(c4) };
  const c6 = { ...c5, ...createBadgeOps(c5) };
  const c7 = { ...c6, ...createRunOps(c6) };
  const store = { ...c7, ...createAnnouncementOps(c7) };

  // If Firebase is configured, fetch the public collections on initial load
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const currentDb = db;

    async function syncFromFirestore() {
      setIsSyncing(true);
      try {
        const [runsSnap, routesSnap, membersSnap, badgesSnap, specialSnap, meetupsSnap] = await Promise.all(
          ['runs', 'routes', 'members', 'badges', 'special_events', 'meetup_events'].map((name) =>
            getDocs(collection(currentDb, name))
          )
        );
        setRuns(runsSnap.docs.map((d) => d.data() as RunEvent));

        // Routes: what's saved plus any official club route that isn't saved yet
        // (staff save those when they sign in; see syncPrivateData).
        const remoteRoutes = routesSnap.docs.map((d) => hydrateRouteFromFirestore(d.data()));
        const remoteRouteIds = new Set(remoteRoutes.map((r) => r.id));
        setRoutes([...remoteRoutes, ...INITIAL_ROUTES.filter((r) => !remoteRouteIds.has(r.id)).map(hydrateRouteFromFirestore)]);

        // Public leaderboard projection (keyed by hashed email, no PII).
        // Ignore any old email-keyed docs left over from the previous schema.
        setMembers(membersSnap.docs.filter((d) => !d.id.includes('@')).map((d) => memberFromPublicDoc(d.data())));

        setBadges(withCatalog(badgesSnap.docs.map((d) => d.data() as Badge), INITIAL_BADGES));
        setSpecialEvents(withCatalog(specialSnap.docs.map((d) => d.data() as SpecialEventDefinition), INITIAL_SPECIAL_EVENTS));

        // Public part only; code words live in meetup_secrets. Keep code words
        // already loaded for staff (whichever sync finished first).
        const remoteMeetups = meetupsSnap.docs.map((d) => meetupFromPublicDoc(d.data()));
        setMeetupEvents((prev) =>
          remoteMeetups.map((m) => ({
            ...m,
            codeWord: prev.find((p) => p.id === m.id)?.codeWord || staffCodeWords.current[m.id] || '',
          }))
        );
      } catch (err) {
        console.warn('Firestore initial fetch skipped or failed:', err);
      } finally {
        setIsSyncing(false);
        setScheduleLoaded(true);
      }
    }

    syncFromFirestore();

    // Club announcements (public, latest 30), live: new ones appear in everyone's bell.
    let unsubscribeAnnouncements: (() => void) | undefined;
    try {
      let firstSnapshot = true;
      unsubscribeAnnouncements = onSnapshot(
        query(collection(currentDb, 'announcements'), orderBy('timestamp', 'desc'), limit(30)),
        (snap) => {
          // Replace the feed with the server's list (never append), so nothing shows twice.
          setNotifications(snap.docs.map((d) => ({ ...(d.data() as ClubNotification), kind: 'announcement' as const })));
          if (!firstSnapshot) {
            snap.docChanges()
              .filter((c) => c.type === 'added' && !c.doc.metadata.hasPendingWrites)
              .forEach((c) => {
                const a = c.doc.data() as ClubNotification;
                showLocalNotification(a.title, a.body);
              });
          }
          firstSnapshot = false;
        },
        (err) => console.warn('Announcements listener error:', err)
      );
    } catch (e) {
      console.warn('Real-time announcement listener error:', e);
    }

    return () => {
      unsubscribeAnnouncements?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    runs: store.runs,
    routes: store.routes,
    members: store.members,
    badges: store.badges,
    notifications: store.notifications,
    bellItems: store.bellItems,
    users: store.users,
    setUsers: store.setUsers,
    meetupEvents: store.meetupEvents,
    checkins: store.checkins,
    legacyMembers: store.legacyMembers,
    milestoneAlerts: store.milestoneAlerts,
    specialEvents: store.specialEvents,
    currentUser: store.currentUser,
    currentUserEmail: store.currentUserEmail,
    currentMember: store.currentMember,
    isSyncing: store.isSyncing,
    scheduleLoaded: store.scheduleLoaded,
    isFirebaseConfigured,

    // Sign-in and private data
    syncPrivateData: store.syncPrivateData,
    clearPrivateData: store.clearPrivateData,
    switchCurrentUser: store.switchCurrentUser,
    registerUser: store.registerUser,

    // Runners
    setUserRole: store.setUserRole,
    adminDeleteRunner: store.adminDeleteRunner,

    // Legacy (old app) names
    loadLegacyPool: store.loadLegacyPool,
    claimLegacyProfile: store.claimLegacyProfile,
    adminSetLegacyClaim: store.adminSetLegacyClaim,
    importLegacyData: store.importLegacyData,
    refreshDerivedStats: store.refreshDerivedStats,

    // Check-ins and gear
    checkInRunner: store.checkInRunner,
    markMilestoneFulfilled: store.markMilestoneFulfilled,

    // Runs and check-in events
    saveMeetupEvent: store.saveMeetupEvent,
    resolveRunByCodeWord: store.resolveRunByCodeWord,
    countPushDevices: store.countPushDevices,
    countRunCheckIns: store.countRunCheckIns,
    toggleRSVP: store.toggleRSVP,
    createRunWithCheckIn: store.createRunWithCheckIn,
    updateRun: store.updateRun,
    deleteRun: store.deleteRun,

    // Routes
    addRoute: store.addRoute,
    updateRoute: store.updateRoute,
    deleteRoute: store.deleteRoute,

    // Badges and special events
    createBadge: store.createBadge,
    deleteBadge: store.deleteBadge,

    // Announcements
    sendPushAnnouncement: store.sendPushAnnouncement,
    deleteAnnouncement: store.deleteAnnouncement,
  };
}
