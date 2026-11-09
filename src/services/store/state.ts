/** All club-store state (React state, browser persistence, derived current user). */
import { useState, useEffect, useMemo } from 'react';
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

export function useStoreState() {
  // Legacy / existing state
  // With Firebase the schedule comes only from Firestore (sample runs are for local mode).
  const [runs, setRuns] = useState<RunEvent[]>(() => (isFirebaseConfigured ? [] : loadFromStorage(STORAGE_KEYS.RUNS, INITIAL_RUNS)));
  const [routes, setRoutes] = useState<GPXRoute[]>(() => {
    const stored = loadFromStorage<GPXRoute[]>(STORAGE_KEYS.ROUTES, INITIAL_ROUTES).map(hydrateRouteFromFirestore);
    const existingIds = new Set(stored.map((r) => r.id));
    const missing = INITIAL_ROUTES.filter((r) => !existingIds.has(r.id)).map(hydrateRouteFromFirestore);
    return [...stored, ...missing];
  });
  const [members, setMembers] = useState<Member[]>(() => {
    const stored = loadFromStorage<Member[]>(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS);
    const existingEmails = new Set(stored.map((m) => m.email.toLowerCase()));
    const missing = INITIAL_MEMBERS.filter((m) => !existingEmails.has(m.email.toLowerCase()));
    const updated = stored.map((m) => {
      const match = INITIAL_MEMBERS.find((init) => init.email.toLowerCase() === m.email.toLowerCase());
      if (match && m.totalRuns < match.totalRuns) {
        return { ...m, ...match };
      }
      return m;
    });
    return [...updated, ...missing];
  });
  const [currentMemberId, setCurrentMemberId] = useState<string>(() => {
    const stored = loadFromStorage<string>(STORAGE_KEYS.CURRENT_USER_ID, '');
    return stored;
  });
  const [badges, setBadges] = useState<Badge[]>(() => {
    const stored = loadFromStorage<Badge[]>(STORAGE_KEYS.BADGES, INITIAL_BADGES);
    const existingIds = new Set(stored.map((b) => b.id));
    const missing = INITIAL_BADGES.filter((b) => !existingIds.has(b.id));
    return [...stored, ...missing];
  });
  const [specialEvents, setSpecialEvents] = useState<SpecialEventDefinition[]>(() => {
    const stored = loadFromStorage<SpecialEventDefinition[]>(STORAGE_KEYS.SPECIAL_EVENTS, INITIAL_SPECIAL_EVENTS);
    const existingIds = new Set(stored.map((s) => s.id));
    const missing = INITIAL_SPECIAL_EVENTS.filter((s) => !existingIds.has(s.id));
    return [...stored, ...missing];
  });
  // Club announcements: shared via Firestore (announcements collection); local mode keeps them in the browser.
  const [notifications, setNotifications] = useState<ClubNotification[]>(() =>
    isFirebaseConfigured ? [] : getStoredNotifications()
  );
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

  // New Relational Collections state (local testing / offline first)
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const stored = loadFromStorage<UserProfile[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const existingEmails = new Set(stored.map((u) => u.email.toLowerCase()));
    const missing = INITIAL_USERS.filter((u) => !existingEmails.has(u.email.toLowerCase()));
    const updated = stored.map((u) => {
      const match = INITIAL_USERS.find((init) => init.email.toLowerCase() === u.email.toLowerCase());
      if (match && u.totalRuns < match.totalRuns) {
        return { ...u, ...match };
      }
      return u;
    });
    return [...updated, ...missing];
  });
  // Same for check-in events: never mix in sample/cached events, or the table QR code
  // could open a run that doesn't exist on the server.
  const [meetupEvents, setMeetupEvents] = useState<MeetupEvent[]>(() =>
    isFirebaseConfigured ? [] : loadFromStorage(STORAGE_KEYS.MEETUP_EVENTS, INITIAL_MEETUP_EVENTS)
  );
  // True once the schedule and check-in events have loaded (immediately in local mode).
  const [scheduleLoaded, setScheduleLoaded] = useState<boolean>(!isFirebaseConfigured);
  const [checkins, setCheckins] = useState<CheckInRecord[]>(() => {
    const stored = loadFromStorage<CheckInRecord[]>(STORAGE_KEYS.CHECKINS, INITIAL_CHECKINS);
    const existingIds = new Set(stored.map((c) => c.id));
    const missing = INITIAL_CHECKINS.filter((c) => !existingIds.has(c.id));
    return [...stored, ...missing];
  });
  const [legacyPool, setLegacyMembers] = useState<LegacyMember[]>(() => {
    // With Firebase the pool comes from Firestore (loadLegacyPool); the local
    // sample pool is only for offline/local mode.
    if (isFirebaseConfigured) return [];
    const stored = loadFromStorage<LegacyMember[]>(STORAGE_KEYS.LEGACY_MEMBERS, INITIAL_LEGACY_MEMBERS);
    const existingNames = new Set(stored.map((m) => m.name.toUpperCase()));
    const missing = INITIAL_LEGACY_MEMBERS.filter((m) => !existingNames.has(m.name.toUpperCase()));
    const updated = stored.map((m) => {
      const match = INITIAL_LEGACY_MEMBERS.find((init) => init.name.toUpperCase() === m.name.toUpperCase());
      return match ? { ...m, ...match } : m;
    });
    return [...updated, ...missing];
  });
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

  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() => {
    const stored = loadFromStorage<string>(STORAGE_KEYS.CURRENT_USER_EMAIL, '');
    return stored;
  });
  const [milestoneAlerts, setMilestoneAlerts] = useState<MilestoneAlert[]>(() => {
    const stored = loadFromStorage<MilestoneAlert[]>(STORAGE_KEYS.MILESTONE_ALERTS, INITIAL_MILESTONE_ALERTS);
    return stored;
  });

  // Sync state changes to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.RUNS, runs);
  }, [runs]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ROUTES, routes);
  }, [routes]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEMBERS, members);
  }, [members]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, currentMemberId);
  }, [currentMemberId]);

  // Sync V2 state changes to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.USERS, users);
  }, [users]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEETUP_EVENTS, meetupEvents);
  }, [meetupEvents]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CHECKINS, checkins);
  }, [checkins]);

  useEffect(() => {
    if (!isFirebaseConfigured) saveToStorage(STORAGE_KEYS.LEGACY_MEMBERS, legacyPool);
  }, [legacyPool]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER_EMAIL, currentUserEmail);
  }, [currentUserEmail]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MILESTONE_ALERTS, milestoneAlerts);
  }, [milestoneAlerts]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.BADGES, badges);
  }, [badges]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SPECIAL_EVENTS, specialEvents);
  }, [specialEvents]);

  // Derived current user (Falls back to GUEST_USER if not logged in)
  const currentUser: UserProfile = currentUserEmail
    ? (users.find((u) => u.email.toLowerCase() === currentUserEmail.toLowerCase()) || GUEST_USER)
    : GUEST_USER;
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

  const guestMember: Member = { ...GUEST_USER, id: 'guest', name: 'Guest Runner', streak: 0, favoritePace: 'Any', joinedDate: '' };
  const currentMember: Member = currentUserEmail && currentMemberKey && currentUser !== GUEST_USER
    ? { ...memberFromUser(currentUser, currentMemberKey), ...(members.find((m) => m.id === currentMemberKey) ? { streak: members.find((m) => m.id === currentMemberKey)!.streak } : {}) }
    : guestMember;

  return {
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
    guestMember,
    currentMember,
  };
}

export type StoreState = ReturnType<typeof useStoreState>;
