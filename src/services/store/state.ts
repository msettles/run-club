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
  SpecialEventDefinition,
} from '../../types';
import {
  type LegacyEvent,
} from '../../utils/legacy';
import {
  INITIAL_RUNS,
  INITIAL_ROUTES,
  INITIAL_MEMBERS,
  INITIAL_BADGES,
  INITIAL_SPECIAL_EVENTS,
  INITIAL_USERS,
  INITIAL_MEETUP_EVENTS,
  INITIAL_CHECKINS,
  INITIAL_LEGACY_MEMBERS,
  INITIAL_MILESTONE_ALERTS,
  GUEST_USER
} from '../../data/initialData';
import { isFirebaseConfigured } from '../firebase';
import { memberKeyFor } from '../../utils/memberKey';
import {
  ClubNotification,
  getStoredNotifications,
} from '../notifications';
import { onPushReceived, readReceivedPushes, type ReceivedPush } from '../push';
import { STORAGE_KEYS, hydrateRouteFromFirestore, loadFromStorage, memberFromUser, saveToStorage } from './helpers';

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
function usePersist<T>(key: string, value: T) {
  useEffect(() => {
    if (LOCAL_MODE) saveToStorage(key, value);
  }, [key, value]);
}

const emailOf = (x: { email: string }) => x.email.toLowerCase();
const idOf = (x: { id: string }) => x.id;

export function useStoreState() {
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

  const [runs, setRuns] = useState<RunEvent[]>(() => (LOCAL_MODE ? loadFromStorage(STORAGE_KEYS.RUNS, INITIAL_RUNS) : []));
  // Production routes come only from Firestore; deleted routes stay deleted.
  const [routes, setRoutes] = useState<GPXRoute[]>(() =>
    (LOCAL_MODE ? loadMerged(STORAGE_KEYS.ROUTES, INITIAL_ROUTES, idOf) : []).map(hydrateRouteFromFirestore)
  );
  const [members, setMembers] = useState<Member[]>(() => (LOCAL_MODE ? loadMerged(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS, emailOf) : []));
  // The built-in badge catalog is part of the app; admin-made badges come from Firestore.
  const [badges, setBadges] = useState<Badge[]>(() => (LOCAL_MODE ? loadMerged(STORAGE_KEYS.BADGES, INITIAL_BADGES, idOf) : INITIAL_BADGES));
  const [specialEvents, setSpecialEvents] = useState<SpecialEventDefinition[]>(() =>
    LOCAL_MODE ? loadMerged(STORAGE_KEYS.SPECIAL_EVENTS, INITIAL_SPECIAL_EVENTS, idOf) : INITIAL_SPECIAL_EVENTS
  );
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

  const [users, setUsers] = useState<UserProfile[]>(() => (LOCAL_MODE ? loadMerged(STORAGE_KEYS.USERS, INITIAL_USERS, emailOf) : []));
  // Never mix sample/cached events into Firebase mode, or the table QR code
  // could open a run that doesn't exist on the server.
  const [meetupEvents, setMeetupEvents] = useState<MeetupEvent[]>(() =>
    LOCAL_MODE ? loadFromStorage(STORAGE_KEYS.MEETUP_EVENTS, INITIAL_MEETUP_EVENTS) : []
  );
  // Staff code words by run ID (from meetup_secrets). Kept here too so they survive
  // the public schedule loading after the staff sync (the two run in parallel).
  const privateSyncEpoch = useRef(0);
  const staffCodeWords = useRef<Record<string, string>>({});
  // True once the schedule and check-in events have loaded (immediately in local mode).
  const [scheduleLoaded, setScheduleLoaded] = useState<boolean>(LOCAL_MODE);
  const [checkins, setCheckins] = useState<CheckInRecord[]>(() => (LOCAL_MODE ? loadMerged(STORAGE_KEYS.CHECKINS, INITIAL_CHECKINS, idOf) : []));
  // With Firebase the pool comes from Firestore (loadLegacyPool).
  const [legacyPool, setLegacyMembers] = useState<LegacyMember[]>(() =>
    LOCAL_MODE ? loadMerged(STORAGE_KEYS.LEGACY_MEMBERS, INITIAL_LEGACY_MEMBERS, (m) => m.name.toUpperCase()) : []
  );
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
    LOCAL_MODE ? loadFromStorage(STORAGE_KEYS.MILESTONE_ALERTS, INITIAL_MILESTONE_ALERTS) : []
  );

  usePersist(STORAGE_KEYS.RUNS, runs);
  usePersist(STORAGE_KEYS.ROUTES, routes);
  usePersist(STORAGE_KEYS.MEMBERS, members);
  usePersist(STORAGE_KEYS.USERS, users);
  usePersist(STORAGE_KEYS.MEETUP_EVENTS, meetupEvents);
  usePersist(STORAGE_KEYS.CHECKINS, checkins);
  usePersist(STORAGE_KEYS.LEGACY_MEMBERS, legacyPool);
  usePersist(STORAGE_KEYS.CURRENT_USER_EMAIL, currentUserEmail);
  usePersist(STORAGE_KEYS.MILESTONE_ALERTS, milestoneAlerts);
  usePersist(STORAGE_KEYS.BADGES, badges);
  usePersist(STORAGE_KEYS.SPECIAL_EVENTS, specialEvents);

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
    const row = members.find((m) => m.id === currentMemberKey);
    return { ...memberFromUser(currentUser, currentMemberKey), ...(row ? { streak: row.streak } : {}) };
  }, [currentUserEmail, currentMemberKey, currentUser, members]);

  return {
    runs,
    setRuns,
    routes,
    setRoutes,
    members,
    setMembers,
    badges,
    setBadges,
    specialEvents,
    setSpecialEvents,
    notifications,
    setNotifications,
    receivedPushes,
    setReceivedPushes,
    isSyncing,
    setIsSyncing,
    users,
    setUsers,
    meetupEvents,
    setMeetupEvents,
    staffCodeWords,
    privateSyncEpoch,
    scheduleLoaded,
    setScheduleLoaded,
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
