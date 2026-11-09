import { useEffect } from 'react';
import { 
  RunEvent, 
  Badge, 
} from '../types';
import { 
  INITIAL_RUNS, 
  INITIAL_ROUTES, 
  INITIAL_MEMBERS, 
  INITIAL_USERS,
  INITIAL_MEETUP_EVENTS,
  INITIAL_CHECKINS,
  INITIAL_LEGACY_MEMBERS,
} from '../data/initialData';
import { isFirebaseConfigured, db } from './firebase';
import {
  collection,
  getDocs,
  orderBy,
  limit,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { 
  ClubNotification, 
  showLocalNotification 
} from './notifications';
import { useStoreState } from './store/state';
import { createLegacyOps } from './store/legacy';
import { createPrivateSyncOps } from './store/privateSync';
import { createMemberOps } from './store/members';
import { createCheckInOps } from './store/checkIn';
import { createEventOps } from './store/events';
import { createBadgeOps } from './store/badges';
import { createRunOps } from './store/runs';
import { createAnnouncementOps } from './store/announcements';
import { STORAGE_KEYS, hydrateRouteFromFirestore, meetupFromPublicDoc, memberFromPublicDoc } from './store/helpers';
// Re-exported for existing importers.
export { cleanFirestoreData, formatRouteForFirestore, hydrateRouteFromFirestore, toPublicMember, RECENT_CHECKIN_DAYS } from './store/helpers';


export function useClubStore() {
  const s = useStoreState();
  const {
    runs,
    setRuns,
    routes,
    setRoutes,
    members,
    setMembers,
    currentMemberId,
    setCurrentMemberId,
    badges,
    setBadges,
    specialEvents,
    notifications,
    setNotifications,
    isSyncing,
    setIsSyncing,
    users,
    setUsers,
    meetupEvents,
    setMeetupEvents,
    scheduleLoaded,
    setScheduleLoaded,
    checkins,
    setCheckins,
    setLegacyMembers,
    currentUserEmail,
    setCurrentUserEmail,
    milestoneAlerts,
    bellItems,
    legacyMembers,
    currentUser,
    currentMember,
  } = s;

  const legacyOps = createLegacyOps({ ...s });
  const { searchLegacyMatches, loadLegacyPool, refreshDerivedStats, claimLegacyProfile, adminSetLegacyClaim, importLegacyData } = legacyOps;
  const privateSyncOps = createPrivateSyncOps({ ...s, ...legacyOps });
  const { syncPrivateData, clearPrivateData } = privateSyncOps;
  const membersOps = createMemberOps({ ...s, ...legacyOps, ...privateSyncOps });
  const { registerUser, adminDeleteRunner, setUserRole, switchCurrentUser } = membersOps;
  const checkInOps = createCheckInOps({ ...s, ...legacyOps, ...privateSyncOps, ...membersOps });
  const { checkInRunner, markMilestoneFulfilled } = checkInOps;
  const eventsOps = createEventOps({ ...s, ...legacyOps, ...privateSyncOps, ...membersOps, ...checkInOps });
  const { saveMeetupEvent, countPushDevices, resolveRunByCodeWord } = eventsOps;
  const badgesOps = createBadgeOps({ ...s, ...legacyOps, ...privateSyncOps, ...membersOps, ...checkInOps, ...eventsOps });
  const { createBadge, deleteBadge, createSpecialEvent, deleteSpecialEvent } = badgesOps;
  const runsOps = createRunOps({ ...s, ...legacyOps, ...privateSyncOps, ...membersOps, ...checkInOps, ...eventsOps, ...badgesOps });
  const { toggleRSVP, createRunWithCheckIn, addRoute, updateRoute, deleteRoute, updateRun, countRunCheckIns, deleteRun } = runsOps;
  const announcementsOps = createAnnouncementOps({ ...s, ...legacyOps, ...privateSyncOps, ...membersOps, ...checkInOps, ...eventsOps, ...badgesOps, ...runsOps });
  const { sendPushAnnouncement, deleteAnnouncement } = announcementsOps;


  // If Firebase is configured, fetch collections on initial load
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    async function syncFromFirestore() {
      if (!db) return;
      const currentDb = db;
      setIsSyncing(true);
      try {
        const runsSnap = await getDocs(collection(currentDb, 'runs'));
        setRuns(runsSnap.docs.map((d) => d.data() as RunEvent));

        // Routes: read only. Show what's saved plus any official club route that
        // isn't saved yet (staff save those when they sign in; see syncPrivateData).
        const routesSnap = await getDocs(collection(currentDb, 'routes'));
        const remoteRoutes = routesSnap.docs.map((d) => hydrateRouteFromFirestore(d.data()));
        const remoteIds = new Set(remoteRoutes.map((r) => r.id));
        setRoutes([...remoteRoutes, ...INITIAL_ROUTES.filter((r) => !remoteIds.has(r.id))]);

        // Public leaderboard projection (keyed by hashed email, no PII).
        // Ignore any old email-keyed docs left over from the previous schema.
        const membersSnap = await getDocs(collection(currentDb, 'members'));
        if (!membersSnap.empty) {
          const remoteMembers = membersSnap.docs
            .filter((d) => !d.id.includes('@'))
            .map((d) => memberFromPublicDoc(d.data()));
          setMembers(remoteMembers);
        }

        // Sync badges
        const badgesSnap = await getDocs(collection(currentDb, 'badges'));
        if (!badgesSnap.empty) {
          const remoteBadges = badgesSnap.docs.map((d) => d.data() as Badge);
          const remoteIds = new Set(remoteBadges.map((b) => b.id));
          setBadges((prev) => {
            const localOnly = prev.filter((b) => !remoteIds.has(b.id));
            return [...remoteBadges, ...localOnly];
          });
        }

        // Sync meetup events (public part only; code words live in meetup_secrets)
        const meetupsSnap = await getDocs(collection(currentDb, 'meetup_events'));
        const remoteMeetups = meetupsSnap.docs.map((d) => meetupFromPublicDoc(d.data()));
        // Keep code words already loaded for staff (they come from meetup_secrets).
        setMeetupEvents((prev) =>
          remoteMeetups.map((m) => ({ ...m, codeWord: prev.find((p) => p.date === m.date)?.codeWord || '' }))
        );
        setScheduleLoaded(true);
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
        query(collection(db, 'announcements'), orderBy('timestamp', 'desc'), limit(30)),
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
  }, []);

  /**
   * Reset local state to defaults
   */
  const resetToDefaults = () => {
    setRuns(INITIAL_RUNS);
    setRoutes(INITIAL_ROUTES);
    setMembers(INITIAL_MEMBERS);
    setCurrentMemberId('');
    setUsers(INITIAL_USERS);
    setMeetupEvents(INITIAL_MEETUP_EVENTS);
    setCheckins(INITIAL_CHECKINS);
    setLegacyMembers(INITIAL_LEGACY_MEMBERS);
    setCurrentUserEmail('');

    localStorage.removeItem(STORAGE_KEYS.RUNS);
    localStorage.removeItem(STORAGE_KEYS.ROUTES);
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.MEETUP_EVENTS);
    localStorage.removeItem(STORAGE_KEYS.CHECKINS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_EMAIL);
  };

  return {
    // V2 Relational Collections
    syncPrivateData,
    clearPrivateData,
    setUserRole,
    adminDeleteRunner,
    loadLegacyPool,
    claimLegacyProfile,
    adminSetLegacyClaim,
    importLegacyData,
    refreshDerivedStats,
    users,
    setUsers,
    meetupEvents,
    checkins,
    legacyMembers,
    currentUser,
    currentUserEmail,
    registerUser,
    checkInRunner,
    saveMeetupEvent,
    resolveRunByCodeWord,
    countPushDevices,
    countRunCheckIns,
    searchLegacyMatches,
    switchCurrentUser,
    milestoneAlerts,
    markMilestoneFulfilled,
    specialEvents,
    createBadge,
    deleteBadge,
    createSpecialEvent,
    deleteSpecialEvent,

    // V1 / Shared
    runs,
    routes,
    members,
    badges,
    notifications,
    currentMember,
    currentMemberId,
    setCurrentMemberId,
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
    resetToDefaults,
    isSyncing,
    scheduleLoaded,
    isFirebaseConfigured,
  };
}
