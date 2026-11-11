import { createStaffLoadingOps } from './store/staffLoading';
import { useEffect } from 'react';
import { RunEvent, Badge, MilestoneReward, SpecialEventDefinition } from '../types';
import { INITIAL_BADGES, INITIAL_SPECIAL_EVENTS, CLUB_MILESTONES } from '../data/catalog';
import { isFirebaseConfigured, db } from './firebase';
import { doc, collection, type DocumentData, orderBy, limit, onSnapshot, query } from 'firebase/firestore';
import { ClubNotification, showLocalNotification } from './notifications';
import { useStoreState } from './store/state';
import { createScheduleLoadingOps, subscribeSchedule } from './store/scheduleLoading';
import { createRouteLoadingOps } from './store/routeLoading';
import { createLegacyOps } from './store/legacy';
import { createPrivateSyncOps } from './store/privateSync';
import { createMemberOps } from './store/members';
import { createCheckInOps } from './store/checkIn';
import { createEventOps } from './store/events';
import { createBadgeOps } from './store/badges';
import { createMilestoneOps } from './store/milestones';
import { createRunOps } from './store/runs';
import { createAnnouncementOps } from './store/announcements';
import { isBadge, meetupFromPublicDoc, memberFromPublicDoc } from './store/helpers';
// Re-exported for existing importers.
export { cleanFirestoreData, formatRouteForFirestore, hydrateRouteFromFirestore, toPublicMember, RECENT_CHECKIN_DAYS } from './store/helpers';

/** Built-in catalog entries plus the ones saved in Firestore (saved copies win). */
function withCatalog<T extends { id: string }>(remote: T[], builtIn: T[]): T[] {
  const ids = new Set(remote.map((x) => x.id));
  return [...builtIn.filter((x) => !ids.has(x.id)), ...remote];
}

export function useClubStore({ loadLeaderboard = true } = {}) {
  const s = useStoreState();
  const {
    setBadges,
    setMilestones,
    setSpecialEvents,
    setNotifications,
    setIsSyncing,
    setBadgeCatalogLoaded,
    setSyncError,
    syncAttempt,
  } = s;

  // Each group of operations can use the state and every group created before it.
  // Extend one context in dependency order; each operation sees current render state.
  const c0 = Object.assign(s, createRouteLoadingOps(s), createScheduleLoadingOps(s), createStaffLoadingOps(s));
  const c1 = Object.assign(c0, createLegacyOps(c0));
  const c2 = Object.assign(c1, createPrivateSyncOps(c1));
  const c3 = Object.assign(c2, createMemberOps(c2));
  const c4 = Object.assign(c3, createCheckInOps(c3));
  const c5 = Object.assign(c4, createEventOps(c4));
  const c6 = Object.assign(c5, createBadgeOps(c5), createMilestoneOps(c5));
  const c7 = Object.assign(c6, createRunOps(c6));
  const store = Object.assign(c7, createAnnouncementOps(c7));

  // If Firebase is configured, fetch the public collections on initial load
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const currentDb = db;

    setIsSyncing(true);
    setSyncError(null);
    setBadgeCatalogLoaded(false);
    const loaded = new Set<string>();
    const errors = new Set<string>();
    const subscriptions: Array<() => void> = [];
    const handlers = {
      badges: (docs: DocumentData[]) => setBadges(withCatalog(docs as Badge[], INITIAL_BADGES).filter(isBadge)),
      milestones: (docs: DocumentData[]) => setMilestones(withCatalog(docs as MilestoneReward[], CLUB_MILESTONES).sort((a, b) => a.runsRequired - b.runsRequired)),
      special_events: (docs: DocumentData[]) => setSpecialEvents(withCatalog(docs as SpecialEventDefinition[], INITIAL_SPECIAL_EVENTS)),

    };
    for (const [name, apply] of Object.entries(handlers)) {
      subscriptions.push(onSnapshot(collection(currentDb, name), (snap) => {
        apply(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
        loaded.add(name);
        errors.delete(name);
        setSyncError(errors.size ? `Club data could not be loaded (${[...errors].join(', ')}).` : null);
        if (name === 'badges') setBadgeCatalogLoaded(true);
        setIsSyncing(loaded.size + errors.size < Object.keys(handlers).length);
      }, (err) => {
        console.warn(`${name} subscription failed:`, err);
        // Milestones fall back to the built-in list, so a failed load is not worth a warning banner
        // (it happens when the app is newer than the deployed rules).
        if (name === 'milestones') { loaded.add(name); setIsSyncing(loaded.size + errors.size < Object.keys(handlers).length); return; }
        errors.add(name);
        setSyncError(`Club data could not be loaded (${[...errors].join(', ')}). Please retry.`);
        if (name === 'badges') setBadgeCatalogLoaded(false);
        setIsSyncing(false);
      }));
    }

    // Route metadata is projected and paged; map geometry is fetched only on demand.
    if (!s.routePagePending.current && !s.routeCatalogComplete.current) void store.loadMoreRoutes().catch(() => {});

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

  const { linkedRunId, setLinkedRun, setLinkedMeetup, setLinkedRunLoading, setLinkedRunError } = s;
  useEffect(() => {
    if (!linkedRunId || !isFirebaseConfigured || !db) return;
    let active = true;
    const ready = new Set<string>();
    setLinkedRunLoading(true); setLinkedRunError(null);
    const fail = () => { if (active) { setLinkedRunError('This run could not be loaded. Please retry.'); setLinkedRunLoading(false); } };
    const stops = [onSnapshot(doc(db, 'runs', linkedRunId), { includeMetadataChanges: true }, (snapshot) => {
      if (!active || (!snapshot.exists() && snapshot.metadata.fromCache)) return;
      setLinkedRun(snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as RunEvent : null);
      ready.add('run'); if (ready.size === 2) setLinkedRunLoading(false);
    }, fail), onSnapshot(doc(db, 'meetup_events', linkedRunId), { includeMetadataChanges: true }, (snapshot) => {
      if (!active || (!snapshot.exists() && snapshot.metadata.fromCache)) return;
      setLinkedMeetup(snapshot.exists() ? meetupFromPublicDoc({ ...snapshot.data(), id: snapshot.id }) : null);
      ready.add('meetup'); if (ready.size === 2) setLinkedRunLoading(false);
    }, fail)];
    return () => { active = false; stops.forEach((stop) => stop()); };
  }, [linkedRunId, syncAttempt, setLinkedRun, setLinkedMeetup, setLinkedRunLoading, setLinkedRunError]);

  const { setMembers, setLeaderboardLoaded, setLeaderboardError } = s;
  useEffect(() => {
    if (!isFirebaseConfigured || !db || !loadLeaderboard) return;
    setLeaderboardLoaded(false); setLeaderboardError(null);
    return onSnapshot(collection(db, 'members'), { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache && snapshot.empty) return;
      setMembers(snapshot.docs.filter((doc) => !doc.id.includes('@')).map((doc) => memberFromPublicDoc({ ...doc.data(), id: doc.id })));
      setLeaderboardLoaded(true);
    }, () => { setLeaderboardError('The member leaderboard could not be loaded. Please retry.'); setLeaderboardLoaded(false); });
  }, [loadLeaderboard, syncAttempt, setMembers, setLeaderboardLoaded, setLeaderboardError]);

  const { clubToday, upcomingRunLimit, setScheduleDataLoaded, setScheduleError, setHasMoreUpcomingRuns, setRuns, setMeetupEvents, staffCodeWords } = s;
  useEffect(() => subscribeSchedule({ upcomingRunLimit, setScheduleDataLoaded, setScheduleError, setHasMoreUpcomingRuns, setRuns, setMeetupEvents, staffCodeWords }, clubToday),
    [clubToday, upcomingRunLimit, setScheduleDataLoaded, setScheduleError, setHasMoreUpcomingRuns, setRuns, setMeetupEvents, staffCodeWords, syncAttempt]);

  useEffect(() => {
    const ids = s.runs.flatMap((run) => [...(run.routeChoices || []).map((choice) => choice.routeId), ...(run.routeId ? [run.routeId] : [])]);
    void store.ensureRouteSummaries(ids).catch(() => s.setRouteCatalogError('Some scheduled route information could not be loaded. Please retry.'));
    // Only schedule changes or an explicit retry need to resolve references.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.runs, syncAttempt]);

  return {
    // State
    runs: store.runs,
    linkedRunId: store.linkedRunId, linkedRunLoading: store.linkedRunLoading, linkedRunError: store.linkedRunError,
    routes: store.routes,
    loadRoute: store.loadRoute,
    refreshRoutes: store.refreshRoutes,
    loadMoreRoutes: store.loadMoreRoutes,
    hasMoreRoutes: store.hasMoreRoutes,
    routesLoading: store.routesLoading,
    members: store.members,
    leaderboardLoaded: store.leaderboardLoaded, leaderboardError: store.leaderboardError,
    badges: store.badges,
    milestones: store.milestones,
    createMilestone: store.createMilestone,
    deleteMilestone: store.deleteMilestone,
    notifications: store.notifications,
    bellItems: store.bellItems,
    users: store.users,
    staffRosterLoaded: Boolean(store.staffRosterPage.current.cursor || store.staffRosterPage.current.complete),
    refreshStaffUsers: store.refreshStaffUsers, refreshGearHistory: store.refreshGearHistory,
    searchStaffUsers: store.searchStaffUsers, loadMoreStaffUsers: store.loadMoreStaffUsers, findStaffUser: store.findStaffUser, loadRunRoster: store.loadRunRoster, exportStaffUsers: store.exportStaffUsers,
    staffRosterLoading: store.staffRosterLoading, staffRosterError: store.staffRosterError, hasMoreStaffUsers: store.hasMoreStaffUsers,
    loadMoreGearHistory: store.loadMoreGearHistory, gearHistoryLoading: store.gearHistoryLoading, gearHistoryError: store.gearHistoryError, hasMoreGearHistory: store.hasMoreGearHistory,
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
    loadPriorRuns: store.loadPriorRuns, loadMoreUpcomingRuns: store.loadMoreUpcomingRuns,
    hasMoreUpcomingRuns: store.hasMoreUpcomingRuns, priorRunsLoaded: store.priorRunsLoaded,
    priorRunsLoading: store.priorRunsLoading, hasMorePriorRuns: store.hasMorePriorRuns, priorRunsError: store.priorRunsError,
    syncError: store.syncError || store.scheduleError || store.privateSyncError || store.routeCatalogError,
    syncRevision: store.syncAttempt,
    retrySync: store.retrySync,
    isFirebaseConfigured,

    // Sign-in and private data
    syncPrivateData: store.syncPrivateData,
    clearPrivateData: store.clearPrivateData,
    switchCurrentUser: store.switchCurrentUser,
    registerUser: store.registerUser,
    updateOwnProfile: store.updateOwnProfile,

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
