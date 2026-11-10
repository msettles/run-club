import { useEffect } from 'react';
import { RunEvent, Badge, SpecialEventDefinition } from '../types';
import { INITIAL_BADGES, INITIAL_SPECIAL_EVENTS } from '../data/catalog';
import { isFirebaseConfigured, db } from './firebase';
import { collection, type DocumentData, orderBy, limit, onSnapshot, query } from 'firebase/firestore';
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
    setSyncError,
    syncAttempt,
    staffCodeWords,
  } = s;

  // Each group of operations can use the state and every group created before it.
  // Extend one context in dependency order; each operation sees current render state.
  const c1 = Object.assign(s, createLegacyOps(s));
  const c2 = Object.assign(c1, createPrivateSyncOps(c1));
  const c3 = Object.assign(c2, createMemberOps(c2));
  const c4 = Object.assign(c3, createCheckInOps(c3));
  const c5 = Object.assign(c4, createEventOps(c4));
  const c6 = Object.assign(c5, createBadgeOps(c5));
  const c7 = Object.assign(c6, createRunOps(c6));
  const store = Object.assign(c7, createAnnouncementOps(c7));

  // If Firebase is configured, fetch the public collections on initial load
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const currentDb = db;

    setIsSyncing(true);
    setSyncError(null);
    setScheduleLoaded(false);
    const loaded = new Set<string>();
    const errors = new Set<string>();
    const subscriptions: Array<() => void> = [];
    const handlers = {
      runs: (docs: DocumentData[]) => setRuns(docs as RunEvent[]),
      routes: (docs: DocumentData[]) => setRoutes(docs.map(hydrateRouteFromFirestore)),
      members: (docs: DocumentData[]) => setMembers(docs.filter((d) => !String(d.id).includes('@')).map(memberFromPublicDoc)),
      badges: (docs: DocumentData[]) => setBadges(withCatalog(docs as Badge[], INITIAL_BADGES)),
      special_events: (docs: DocumentData[]) => setSpecialEvents(withCatalog(docs as SpecialEventDefinition[], INITIAL_SPECIAL_EVENTS)),
      meetup_events: (docs: DocumentData[]) => setMeetupEvents((prev) => docs.map((d) => {
        const m = meetupFromPublicDoc(d);
        return { ...m, codeWord: prev.find((p) => p.id === m.id)?.codeWord || staffCodeWords.current[m.id] || '' };
      })),
    };
    for (const [name, apply] of Object.entries(handlers)) {
      subscriptions.push(onSnapshot(collection(currentDb, name), (snap) => {
        apply(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        loaded.add(name);
        errors.delete(name);
        setSyncError(errors.size ? `Club data could not be loaded (${[...errors].join(', ')}).` : null);
        setScheduleLoaded(['runs', 'meetup_events', 'badges'].every((name) => loaded.has(name) && !errors.has(name)));
        setIsSyncing(loaded.size + errors.size < Object.keys(handlers).length);
      }, (err) => {
        console.warn(`${name} subscription failed:`, err);
        errors.add(name);
        setSyncError(`Club data could not be loaded (${[...errors].join(', ')}). Please retry.`);
        if (['runs', 'meetup_events', 'badges'].includes(name)) setScheduleLoaded(false);
        setIsSyncing(false);
      }));
    }

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
      subscriptions.forEach((stop) => stop());
      unsubscribeAnnouncements?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncAttempt]);

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
    syncError: store.syncError || store.privateSyncError,
    syncRevision: store.syncAttempt,
    retrySync: store.retrySync,
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
