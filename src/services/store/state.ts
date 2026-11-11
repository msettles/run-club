import { newStaffSearchCache, newStaffPage } from './staffLoading';
/** All club-store state (React state, browser persistence, derived current user). */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  RunEvent,
  GPXRoute,
  Member,
  Badge,
  UserProfile,
  MeetupEvent,
  CheckInRecord,
  LegacyMember,
  MilestoneAlert,
  MilestoneReward,
  SpecialEventDefinition,
} from '../../types';
import {
  type LegacyEvent,
} from '../../utils/legacy';
import { INITIAL_BADGES, INITIAL_SPECIAL_EVENTS, CLUB_MILESTONES, GUEST_USER } from '../../data/catalog';
import { DEFAULT_PARTNER, type ClubPartner } from '../../data/partner';
import { createRouteCatalogClient, RouteDetailsCache } from '../routeCatalog';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { clubYmd } from '../../utils/dateUtils';
import { sharedRunId } from '../../utils/runLinks';
import { RUN_PAGE_SIZE } from './scheduleLoading';
import { fetchFullRoute } from './routeLoading';
import { isFirebaseConfigured, db } from '../firebase';
import { memberKeyFor } from '../../utils/memberKey';
import {
  ClubNotification,
  getStoredNotifications,
} from '../notifications';
import { onPushReceived, readReceivedPushes, type ReceivedPush } from '../push';
import { STORAGE_KEYS, hydrateRouteFromFirestore, isBadge, loadFromStorage, memberFromUser, saveToStorage, withCatalog } from './helpers';
import { sortMilestones } from '../../utils/milestones';

/**
 * Local (no-Firebase) mode keeps everything in this browser, starting from the
 * sample data. With Firebase, Firestore is the only source: state starts empty
 * (or with the built-in catalog) and nothing is cached in localStorage, so sample
 * people never show up in production and other runners' data never sits on a device.
 */
const LOCAL_MODE = !isFirebaseConfigured;

/** Stored list plus any sample entries it doesn't have yet (local mode only). */
function loadMerged<T>(key: string, initial: T[], idOf: (x: T) => string): T[] {
  const stored = loadFromStorage<T[]>(key, initial);
  const ids = new Set(stored.map(idOf));
  return [...stored, ...initial.filter((x) => !ids.has(idOf(x)))];
}

/** Save a piece of state to localStorage whenever it changes (local mode only). */
function usePersist<T>(key: string, value: T, ready: boolean) {
  useEffect(() => {
    if (LOCAL_MODE && ready) saveToStorage(key, value);
  }, [key, value, ready]);
}

const emailOf = (x: { email: string }) => x.email.toLowerCase();
const idOf = (x: { id: string }) => x.id;

export function useStoreState() {
  const [localReady, setLocalReady] = useState(!LOCAL_MODE);
  // Builds before this one cached club data in localStorage in Firebase mode too
  // (including the staff roster). Drop it: Firestore is the source of truth.
  useEffect(() => {
    if (LOCAL_MODE) return;
    for (const key of Object.values(STORAGE_KEYS)) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }, []);

  const [runs, setRuns] = useState<RunEvent[]>(() => (LOCAL_MODE ? loadFromStorage(STORAGE_KEYS.RUNS, []) : []));
  // Production routes come only from Firestore; deleted routes stay deleted.
  const [routes, setRoutes] = useState<GPXRoute[]>(() =>
    (LOCAL_MODE ? loadMerged(STORAGE_KEYS.ROUTES, [], idOf) : []).map(hydrateRouteFromFirestore)
  );
  const [linkedRunId] = useState(() => sharedRunId(window.location.search));
  const [linkedRun, setLinkedRun] = useState<RunEvent | null>(null);
  const [linkedMeetup, setLinkedMeetup] = useState<MeetupEvent | null>(null);
  const [linkedRunLoading, setLinkedRunLoading] = useState(Boolean(linkedRunId && isFirebaseConfigured));
  const [linkedRunError, setLinkedRunError] = useState<string | null>(null);
  const routeCatalogClient = useMemo(() => isFirebaseConfigured && db ? createRouteCatalogClient(`https://firestore.googleapis.com/v1/projects/${db.app.options.projectId}/databases/(default)/documents`) : null, []);
  const routeDetailsCache = useMemo(() => new RouteDetailsCache(fetchFullRoute), []);
  const routePageToken = useRef<string | undefined>();
  const routePagePending = useRef(false);
  const routeCatalogComplete = useRef(false);
  const [hasMoreRoutes, setHasMoreRoutes] = useState(isFirebaseConfigured);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routeCatalogError, setRouteCatalogError] = useState<string | null>(null);
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(LOCAL_MODE);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const staffSearchCache = useRef(newStaffSearchCache());
  const staffRosterPage = useRef(newStaffPage(LOCAL_MODE));
  const gearHistoryPage = useRef(newStaffPage(LOCAL_MODE));
  const [staffRosterLoading, setStaffRosterLoading] = useState(false);
  const [staffRosterError, setStaffRosterError] = useState<string | null>(null);
  const [hasMoreStaffUsers, setHasMoreStaffUsers] = useState(!LOCAL_MODE);
  const [gearHistoryLoading, setGearHistoryLoading] = useState(false);
  const [gearHistoryError, setGearHistoryError] = useState<string | null>(null);
  const [hasMoreGearHistory, setHasMoreGearHistory] = useState(!LOCAL_MODE);
  const [members, setMembers] = useState<Member[]>(() => (LOCAL_MODE ? loadMerged<Member>(STORAGE_KEYS.MEMBERS, [], emailOf) : []));
  // Badges, milestones and special events are the club's own data, saved in Firestore and editable by admins.
  // The starter pack in data/catalog.ts is written there once (settings/catalog marks that it was); until then
  // the starter pack is shown alongside anything saved. Milestones (gear tiers) and badges are separate.
  const [badgeDocs, setBadges] = useState<Badge[]>(() => (LOCAL_MODE ? loadFromStorage<Badge[]>(STORAGE_KEYS.BADGES, INITIAL_BADGES) : []));
  const [milestoneDocs, setMilestones] = useState<MilestoneReward[]>(() => (LOCAL_MODE ? loadFromStorage<MilestoneReward[]>(STORAGE_KEYS.MILESTONES, CLUB_MILESTONES) : []));
  const [specialEventDocs, setSpecialEvents] = useState<SpecialEventDefinition[]>(() =>
    LOCAL_MODE ? loadFromStorage<SpecialEventDefinition[]>(STORAGE_KEYS.SPECIAL_EVENTS, INITIAL_SPECIAL_EVENTS) : []
  );
  const [catalogSeeded, setCatalogSeeded] = useState(LOCAL_MODE);   // the starter pack has been written
  const [catalogSettled, setCatalogSettled] = useState(LOCAL_MODE); // we know whether it has (the settings have loaded)
  const badges = useMemo(() => (catalogSeeded ? badgeDocs : withCatalog(badgeDocs, INITIAL_BADGES)).filter(isBadge), [catalogSeeded, badgeDocs]);
  const milestones = useMemo(() => sortMilestones(catalogSeeded ? milestoneDocs : withCatalog(milestoneDocs, CLUB_MILESTONES)), [catalogSeeded, milestoneDocs]);
  const specialEvents = useMemo(() => (catalogSeeded ? specialEventDocs : withCatalog(specialEventDocs, INITIAL_SPECIAL_EVENTS)), [catalogSeeded, specialEventDocs]);
  // The club's home-base partner; admins can edit it (settings/partner), the app ships with a default.
  const [partner, setPartner] = useState<ClubPartner>(DEFAULT_PARTNER);
  // Club announcements: shared via Firestore (announcements collection); local mode keeps them in the browser.
  const [notifications, setNotifications] = useState<ClubNotification[]>(() => (LOCAL_MODE ? getStoredNotifications() : []));
  // Pushes this device received from the Firebase console (saved by the push worker).
  const [receivedPushes, setReceivedPushes] = useState<ClubNotification[]>([]);
  useEffect(() => {
    const toItem = (p: ReceivedPush): ClubNotification => ({
      id: p.id,
      title: p.title,
      body: p.body,
      link: p.link,
      timestamp: p.timestamp,
      sender: 'Push notification',
      kind: 'push',
    });
    readReceivedPushes().then((list) => setReceivedPushes(list.map(toItem)));
    return onPushReceived((p) => setReceivedPushes((prev) => [toItem(p), ...prev.filter((x) => x.id !== p.id)]));
  }, []);
  /** Bell feed: announcements + received pushes, newest first. */
  const bellItems = useMemo(
    () => [...notifications, ...receivedPushes].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [notifications, receivedPushes]
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [users, setUsers] = useState<UserProfile[]>(() => (LOCAL_MODE ? loadMerged<UserProfile>(STORAGE_KEYS.USERS, [], emailOf) : []));
  // Never mix sample/cached events into Firebase mode, or the table QR code
  // could open a run that doesn't exist on the server.
  const [meetupEvents, setMeetupEvents] = useState<MeetupEvent[]>(() =>
    LOCAL_MODE ? loadFromStorage(STORAGE_KEYS.MEETUP_EVENTS, []) : []
  );
  // Staff code words by run ID (from meetup_secrets). Kept here too so they survive
  // the public schedule loading after the staff sync (the two run in parallel).
  const privateSyncEpoch = useRef(0);
  const privateSessionEpoch = useRef(0);
  const staffCodeWords = useRef<Record<string, string>>({});
  // True once the schedule and check-in events have loaded (immediately in local mode).
  const [privateSyncError, setPrivateSyncError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const retrySync = () => setSyncAttempt((n) => n + 1);
  const privateUnsubscribers = useRef<Array<() => void>>([]);
  useEffect(() => () => {
    privateSyncEpoch.current++;
    privateSessionEpoch.current++;
    privateUnsubscribers.current.splice(0).forEach((stop) => stop());
  }, []);
  const [badgeCatalogLoaded, setBadgeCatalogLoaded] = useState(LOCAL_MODE);
  const [scheduleDataLoaded, setScheduleDataLoaded] = useState(LOCAL_MODE);
  const scheduleLoaded = LOCAL_MODE ? localReady : badgeCatalogLoaded && scheduleDataLoaded;
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [clubToday, setClubToday] = useState(() => clubYmd());
  useEffect(() => { const timer = setInterval(() => setClubToday(clubYmd()), 60000); return () => clearInterval(timer); }, []);
  const [upcomingRunLimit, setUpcomingRunLimit] = useState(RUN_PAGE_SIZE);
  const [hasMoreUpcomingRuns, setHasMoreUpcomingRuns] = useState(false);
  const priorRunsCursor = useRef<QueryDocumentSnapshot<DocumentData>>();
  const priorRunsPending = useRef(false);
  const priorRunsComplete = useRef(LOCAL_MODE);
  const [priorRunsLoaded, setPriorRunsLoaded] = useState(LOCAL_MODE);
  const [priorRunsLoading, setPriorRunsLoading] = useState(false);
  const [hasMorePriorRuns, setHasMorePriorRuns] = useState(!LOCAL_MODE);
  const [priorRunsError, setPriorRunsError] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<CheckInRecord[]>(() => (LOCAL_MODE ? loadMerged<CheckInRecord>(STORAGE_KEYS.CHECKINS, [], idOf) : []));
  // With Firebase the pool comes from Firestore (loadLegacyPool).
  const [legacyPool, setLegacyMembers] = useState<LegacyMember[]>(() =>
    LOCAL_MODE ? loadMerged<LegacyMember>(STORAGE_KEYS.LEGACY_MEMBERS, [], (m) => m.name.toUpperCase()) : []
  );
  useEffect(() => {
    if (!LOCAL_MODE) return;
    let active = true;
    import('../../data/initialData').then((seed) => {
      if (!active) return;
      setRuns(loadFromStorage(STORAGE_KEYS.RUNS, seed.INITIAL_RUNS));
      setRoutes(loadMerged(STORAGE_KEYS.ROUTES, seed.INITIAL_ROUTES, idOf).map(hydrateRouteFromFirestore));
      setMembers(loadMerged(STORAGE_KEYS.MEMBERS, seed.INITIAL_MEMBERS, emailOf));
      setUsers(loadMerged(STORAGE_KEYS.USERS, seed.INITIAL_USERS, emailOf));
      setMeetupEvents(loadFromStorage(STORAGE_KEYS.MEETUP_EVENTS, seed.INITIAL_MEETUP_EVENTS));
      setCheckins(loadMerged(STORAGE_KEYS.CHECKINS, seed.INITIAL_CHECKINS, idOf));
      setLegacyMembers(loadMerged(STORAGE_KEYS.LEGACY_MEMBERS, seed.INITIAL_LEGACY_MEMBERS, (m) => m.name.toUpperCase()));
      setMilestoneAlerts(loadFromStorage(STORAGE_KEYS.MILESTONE_ALERTS, seed.INITIAL_MILESTONE_ALERTS));
      setScheduleDataLoaded(true);
      setLocalReady(true);
    }).catch((err) => { console.warn('Local sample load failed:', err); if (active) setSyncError('Local club data could not be loaded. Please reload.'); });
    return () => { active = false; };
  }, []);

  // Profiles are the source of truth for who claimed what (linkedLegacyIds /
  // linkedLegacyNames); claimedBy on the legacy doc is the server-side lock.
  const legacyMembers = useMemo<LegacyMember[]>(() => {
    const byId = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const u of users) {
      for (const id of u.linkedLegacyIds || []) byId.set(id, u.email);
      for (const name of u.linkedLegacyNames || []) byName.set(name.toUpperCase(), u.email);
    }
    return legacyPool.map((m) => {
      const email = byId.get(m.id) || byName.get(m.name.toUpperCase()) || null;
      return email ? { ...m, claimedByEmail: email } : m;
    });
  }, [legacyPool, users]);

  // Dated old-app sign-ins for the signed-in runner's claimed names (streaks/badges).
  const [ownLegacyEvents, setOwnLegacyEvents] = useState<LegacyEvent[]>([]);

  // With Firebase the signed-in account decides this (App sets it on sign-in).
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() =>
    LOCAL_MODE ? loadFromStorage<string>(STORAGE_KEYS.CURRENT_USER_EMAIL, '') : ''
  );
  const [milestoneAlerts, setMilestoneAlerts] = useState<MilestoneAlert[]>(() =>
    LOCAL_MODE ? loadFromStorage(STORAGE_KEYS.MILESTONE_ALERTS, []) : []
  );

  usePersist(STORAGE_KEYS.RUNS, runs, localReady);
  usePersist(STORAGE_KEYS.ROUTES, routes, localReady);
  usePersist(STORAGE_KEYS.MEMBERS, members, localReady);
  usePersist(STORAGE_KEYS.USERS, users, localReady);
  usePersist(STORAGE_KEYS.MEETUP_EVENTS, meetupEvents, localReady);
  usePersist(STORAGE_KEYS.CHECKINS, checkins, localReady);
  usePersist(STORAGE_KEYS.LEGACY_MEMBERS, legacyPool, localReady);
  usePersist(STORAGE_KEYS.CURRENT_USER_EMAIL, currentUserEmail, localReady);
  usePersist(STORAGE_KEYS.MILESTONE_ALERTS, milestoneAlerts, localReady);
  usePersist(STORAGE_KEYS.BADGES, badgeDocs, localReady);
  usePersist(STORAGE_KEYS.MILESTONES, milestoneDocs, localReady);
  usePersist(STORAGE_KEYS.SPECIAL_EVENTS, specialEventDocs, localReady);

  // Derived current user (Falls back to GUEST_USER if not logged in)
  const currentUser: UserProfile = useMemo(
    () => (currentUserEmail ? users.find((u) => u.email.toLowerCase() === currentUserEmail.toLowerCase()) || GUEST_USER : GUEST_USER),
    [currentUserEmail, users]
  );
  // Hashed public key for the signed-in runner (members doc ID / RSVP attendee ID)
  const [currentMemberKey, setCurrentMemberKey] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    if (!currentUserEmail) {
      setCurrentMemberKey('');
      return;
    }
    memberKeyFor(currentUserEmail).then((key) => {
      if (!cancelled) setCurrentMemberKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserEmail]);

  const currentMember: Member = useMemo(() => {
    if (!currentUserEmail || !currentMemberKey || currentUser === GUEST_USER) return GUEST_MEMBER;
    return memberFromUser(currentUser, currentMemberKey);
  }, [currentUserEmail, currentMemberKey, currentUser]);

  const loadedRuns = useMemo(() => linkedRun ? [...runs.filter((run) => run.id !== linkedRun.id), linkedRun] : runs, [runs, linkedRun]);
  const loadedMeetups = useMemo(() => linkedMeetup ? [...meetupEvents.filter((event) => event.id !== linkedMeetup.id), { ...linkedMeetup, codeWord: staffCodeWords.current[linkedMeetup.id] || linkedMeetup.codeWord }] : meetupEvents, [meetupEvents, linkedMeetup]);

  return {
    runs: loadedRuns,
    linkedRunId, linkedRunLoading, linkedRunError, setLinkedRun, setLinkedMeetup, setLinkedRunLoading, setLinkedRunError,
    setRuns,
    routes,
    setRoutes,
    routeCatalogClient, routeDetailsCache, routePageToken, routePagePending, routeCatalogComplete,
    hasMoreRoutes, setHasMoreRoutes, routesLoading, setRoutesLoading, routeCatalogError, setRouteCatalogError,
    members,
    setMembers,
    leaderboardLoaded, setLeaderboardLoaded, leaderboardError, setLeaderboardError,
    badges,
    badgeDocs,
    setBadges,
    milestones,
    milestoneDocs,
    setMilestones,
    partner,
    setPartner,
    specialEvents,
    specialEventDocs,
    setSpecialEvents,
    catalogSeeded, setCatalogSeeded, catalogSettled, setCatalogSettled,
    notifications,
    setNotifications,
    receivedPushes,
    setReceivedPushes,
    isSyncing,
    setIsSyncing,
    users,
    setUsers,
    staffSearchCache, staffRosterPage, gearHistoryPage, staffRosterLoading, setStaffRosterLoading, staffRosterError, setStaffRosterError,
    hasMoreStaffUsers, setHasMoreStaffUsers, gearHistoryLoading, setGearHistoryLoading, gearHistoryError, setGearHistoryError, hasMoreGearHistory, setHasMoreGearHistory,
    meetupEvents: loadedMeetups,
    setMeetupEvents,
    staffCodeWords,
    privateSyncEpoch,
    privateSessionEpoch,
    scheduleLoaded,
    syncError, setSyncError, privateSyncError, setPrivateSyncError, syncAttempt, retrySync, privateUnsubscribers,
    badgeCatalogLoaded, setBadgeCatalogLoaded, scheduleDataLoaded, setScheduleDataLoaded, scheduleError, setScheduleError,
    clubToday, upcomingRunLimit, setUpcomingRunLimit, hasMoreUpcomingRuns, setHasMoreUpcomingRuns,
    priorRunsCursor, priorRunsPending, priorRunsComplete, priorRunsLoaded, setPriorRunsLoaded,
    priorRunsLoading, setPriorRunsLoading, hasMorePriorRuns, setHasMorePriorRuns, priorRunsError, setPriorRunsError,
    checkins,
    setCheckins,
    legacyPool,
    setLegacyMembers,
    ownLegacyEvents,
    setOwnLegacyEvents,
    currentUserEmail,
    setCurrentUserEmail,
    milestoneAlerts,
    setMilestoneAlerts,
    currentMemberKey,
    setCurrentMemberKey,
    bellItems,
    legacyMembers,
    currentUser,
    currentMember,
  };
}

const GUEST_MEMBER: Member = { ...GUEST_USER, id: 'guest', name: 'Guest Runner', streak: 0, favoritePace: 'Any', joinedDate: '' };

export type StoreState = ReturnType<typeof useStoreState>;
