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
  ActivityType,
  DistanceChoice,
  RouteOption,
  MilestoneAlert,
  SpecialEventDefinition,
  BadgeCategory,
  BadgeTriggerConfig
} from '../types';
import { calculateAge } from '../utils/dateUtils';
import { computeCheckInWindow, eventStart } from '../utils/checkInWindow';
import {
  buildLegacyImport,
  datedEventsFrom,
  matchLegacyNames,
  recomputeBadges,
  computeStreaks,
  isLegacyClaimed,
  type LegacyEvent,
} from '../utils/legacy';
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
  CLUB_MILESTONES,
  INITIAL_MILESTONE_ALERTS,
  GUEST_USER
} from '../data/initialData';
import { isFirebaseConfigured, db } from './firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { codeKeyFor, memberKeyFor } from '../utils/memberKey';
import { ADMIN_EMAILS } from '../utils/roles';
import { 
  ClubNotification, 
  getStoredNotifications, 
  storeNotification, 
  showLocalNotification 
} from './notifications';

/**
 * Recursively removes any keys with `undefined` values, which Firestore rejects.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanFirestoreData) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Prepares a route document for Firestore storage by serializing
 * rich GeoJSON and direction step objects to JSON strings.
 * Firestore strictly forbids nested arrays (e.g. coordinates: [[x, y], ...])
 * and arrays within maps within arrays (e.g. step.point: [x, y]).
 */
export function formatRouteForFirestore(route: Partial<GPXRoute>): any {
  const cleaned = cleanFirestoreData(route);
  const formatted: any = { ...cleaned };

  if (formatted.directions !== undefined && typeof formatted.directions !== 'string') {
    formatted.directions = JSON.stringify(formatted.directions);
  }
  if (formatted.geoJson !== undefined && typeof formatted.geoJson !== 'string') {
    formatted.geoJson = JSON.stringify(formatted.geoJson);
  }

  // Ensure points does not contain nested arrays
  if (Array.isArray(formatted.points)) {
    formatted.points = formatted.points.map((pt: any) => {
      if (Array.isArray(pt)) {
        return { lat: pt[0], lon: pt[1] };
      }
      return pt;
    });
  }

  return formatted;
}

/**
 * Hydrates a route document fetched from Firestore or storage, parsing
 * directions and geoJson from JSON strings back into rich objects/arrays.
 */
export function hydrateRouteFromFirestore(data: any): GPXRoute {
  if (!data) return data;
  let directions = data.directions;
  if (typeof directions === 'string') {
    try {
      directions = JSON.parse(directions);
    } catch (e) {
      console.warn('Failed to parse route directions JSON from Firestore:', e);
      directions = [];
    }
  }
  let geoJson = data.geoJson;
  if (typeof geoJson === 'string') {
    try {
      geoJson = JSON.parse(geoJson);
    } catch (e) {
      console.warn('Failed to parse route geoJson from Firestore:', e);
      geoJson = null;
    }
  }
  return {
    ...data,
    isLoop: data.isLoop !== undefined ? Boolean(data.isLoop) : (data.id === 'route-the-123' || (data.name && (data.name.includes('123') || data.name.includes('1, 2, 3')))),
    maxLoops: data.maxLoops || 4,
    directions: Array.isArray(directions) ? directions : [],
    geoJson: geoJson || null,
  } as GPXRoute;
}

const STORAGE_KEYS = {
  RUNS: 'woodchuckers_runs_v1',
  ROUTES: 'woodchuckers_routes_v1',
  MEMBERS: 'woodchuckers_members_v1',
  CURRENT_USER_ID: 'woodchuckers_current_user_id_v1',
  // Relational V2 keys
  USERS: 'woodchuckers_users_v2',
  MEETUP_EVENTS: 'woodchuckers_events_v2',
  CHECKINS: 'woodchuckers_checkins_v2',
  LEGACY_MEMBERS: 'woodchuckers_legacy_members_v2',
  CURRENT_USER_EMAIL: 'woodchuckers_current_user_email_v2',
  MILESTONE_ALERTS: 'woodchuckers_milestone_alerts_v2',
  BADGES: 'woodchuckers_badges_v2',
  SPECIAL_EVENTS: 'woodchuckers_special_events_v2',
};

// Safe localStorage getters
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error loading key ${key} from storage:`, e);
    return fallback;
  }
}

/**
 * Public leaderboard projection of a profile. Must contain no email / PII:
 * it is written to the publicly readable members/{memberKey} collection.
 */
export function toPublicMember(user: UserProfile, memberKey: string): Record<string, unknown> {
  return cleanFirestoreData({
    id: memberKey,
    name: user.displayName,
    totalRuns: user.totalRuns,
    totalMiles: user.totalMiles,
    runCount: user.runCount,
    walkCount: user.walkCount,
    petRunCount: user.petRunCount,
    streak: user.currentStreakWeeks || 0,
    favoritePace: user.preferredPace || '9:00 min/mi',
    unlockedBadgeIds: user.unlockedBadgeIds,
    badgeCounts: user.badgeCounts,
    joinedDate: user.firstRunDate || user.createdAt.split('T')[0],
  });
}

/** Local (in-app) Member record for a profile, keyed by memberKey. */
function memberFromUser(user: UserProfile, memberKey: string): Member {
  return {
    ...user,
    id: memberKey,
    name: user.displayName,
    streak: user.currentStreakWeeks || 0,
    favoritePace: user.preferredPace || '9:00 min/mi',
    joinedDate: user.firstRunDate || user.createdAt.split('T')[0],
  };
}

/** Hydrate a public members doc (which has no email) into a Member for display. */
function memberFromPublicDoc(data: any): Member {
  return {
    ...GUEST_USER,
    role: 'member',
    ...data,
    email: '',
    displayName: data.name,
    runCount: data.runCount || 0,
    walkCount: data.walkCount || 0,
    unlockedBadgeIds: data.unlockedBadgeIds || [],
  } as Member;
}

/** Parse "YYYY-MM-DD" + "06:00 PM" into a local Date. */

/** Strip Firestore-only fields from a public meetup doc. The code word is never public. */
function meetupFromPublicDoc(data: any): MeetupEvent {
  const { checkInOpensAt, checkInClosesAt, ...rest } = data || {};
  const iso = (t: any): string | undefined =>
    t && typeof t.toDate === 'function' ? t.toDate().toISOString() : typeof t === 'string' ? t : undefined;
  return { ...rest, codeWord: '', checkInOpensAt: iso(checkInOpensAt), checkInClosesAt: iso(checkInClosesAt) } as MeetupEvent;
}

const PRIVATE_STORAGE_KEYS = ['USERS', 'CHECKINS', 'MILESTONE_ALERTS'] as const;

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving key ${key} to storage:`, e);
  }
}

const REMOVED_TEST_EMAILS = new Set([
  'brittney.echols@example.com',
  'john.conway@example.com',
  'keith.misner@example.com',
  'brittney.ecols@example.com',
  'matt.settles@example.com',
]);

// One-time client-side purge for mattsettles@gmail.com to enable fresh onboarding test
const PURGE_KEY = 'woodland_woodchuckers_purged_mattsettles_v1';
if (typeof window !== 'undefined' && !localStorage.getItem(PURGE_KEY)) {
  try {
    const rawUsers = localStorage.getItem(STORAGE_KEYS.USERS);
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers);
      const cleaned = parsed.filter((u: any) => u.email?.toLowerCase() !== 'mattsettles@gmail.com');
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(cleaned));
    }
    const rawMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
    if (rawMembers) {
      const parsed = JSON.parse(rawMembers);
      const cleaned = parsed.filter((m: any) => m.email?.toLowerCase() !== 'mattsettles@gmail.com');
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(cleaned));
    }
    const currentEmail = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_EMAIL);
    if (currentEmail && currentEmail.toLowerCase() === 'mattsettles@gmail.com') {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_EMAIL);
    }
    const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (currentId && currentId.toLowerCase() === 'mattsettles@gmail.com') {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    }
    const rawLegacy = localStorage.getItem(STORAGE_KEYS.LEGACY_MEMBERS);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      const cleaned = parsed.map((m: any) => 
        m.claimedByEmail?.toLowerCase() === 'mattsettles@gmail.com'
          ? { ...m, claimedByEmail: null, claimedAt: null }
          : m
      );
      localStorage.setItem(STORAGE_KEYS.LEGACY_MEMBERS, JSON.stringify(cleaned));
    }
    const rawCheckins = localStorage.getItem(STORAGE_KEYS.CHECKINS);
    if (rawCheckins) {
      const parsed = JSON.parse(rawCheckins);
      const cleaned = parsed.filter((c: any) => c.userEmail?.toLowerCase() !== 'mattsettles@gmail.com');
      localStorage.setItem(STORAGE_KEYS.CHECKINS, JSON.stringify(cleaned));
    }
    localStorage.setItem(PURGE_KEY, 'true');
  } catch (e) {
    console.warn('One-time client purge error:', e);
  }
}

export function useClubStore() {
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
    const stored = loadFromStorage<Member[]>(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS)
      .filter((m) => !REMOVED_TEST_EMAILS.has(m.email.toLowerCase()));
    const existingEmails = new Set(stored.map((m) => m.email.toLowerCase()));
    const missing = INITIAL_MEMBERS.filter((m) => !existingEmails.has(m.email.toLowerCase()) && !REMOVED_TEST_EMAILS.has(m.email.toLowerCase()));
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
    if (stored && REMOVED_TEST_EMAILS.has(stored.toLowerCase())) {
      return '';
    }
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
  const [notifications, setNotifications] = useState<ClubNotification[]>(() => getStoredNotifications());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // New Relational Collections state (local testing / offline first)
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const stored = loadFromStorage<UserProfile[]>(STORAGE_KEYS.USERS, INITIAL_USERS)
      .filter((u) => !REMOVED_TEST_EMAILS.has(u.email.toLowerCase()));
    const existingEmails = new Set(stored.map((u) => u.email.toLowerCase()));
    const missing = INITIAL_USERS.filter((u) => !existingEmails.has(u.email.toLowerCase()) && !REMOVED_TEST_EMAILS.has(u.email.toLowerCase()));
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
    const stored = loadFromStorage<CheckInRecord[]>(STORAGE_KEYS.CHECKINS, INITIAL_CHECKINS)
      .filter((c) => !REMOVED_TEST_EMAILS.has(c.userEmail.toLowerCase()));
    const existingIds = new Set(stored.map((c) => c.id));
    const missing = INITIAL_CHECKINS.filter((c) => !existingIds.has(c.id) && !REMOVED_TEST_EMAILS.has(c.userEmail.toLowerCase()));
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
      const base = match ? { ...m, ...match } : m;
      if (base.claimedByEmail && REMOVED_TEST_EMAILS.has(base.claimedByEmail.toLowerCase())) {
        return { ...base, claimedByEmail: null, claimedAt: null };
      }
      return base;
    });
    return [...updated, ...missing].map((m) => {
      if (m.claimedByEmail && REMOVED_TEST_EMAILS.has(m.claimedByEmail.toLowerCase())) {
        return { ...m, claimedByEmail: null, claimedAt: null };
      }
      return m;
    });
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
    if (stored && REMOVED_TEST_EMAILS.has(stored.toLowerCase())) {
      return '';
    }
    return stored;
  });
  const [milestoneAlerts, setMilestoneAlerts] = useState<MilestoneAlert[]>(() => {
    const stored = loadFromStorage<MilestoneAlert[]>(STORAGE_KEYS.MILESTONE_ALERTS, INITIAL_MILESTONE_ALERTS);
    return stored.filter((a) => !REMOVED_TEST_EMAILS.has(a.userEmail.toLowerCase()));
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

        const routesSnap = await getDocs(collection(currentDb, 'routes'));
        if (!routesSnap.empty) {
          const remoteRoutes = routesSnap.docs.map((d) => hydrateRouteFromFirestore(d.data()));
          const remoteIds = new Set(remoteRoutes.map((r) => r.id));
          const missing = INITIAL_ROUTES.filter((r) => !remoteIds.has(r.id)).map(hydrateRouteFromFirestore);

          // Seed any missing official club routes to Firestore
          for (const m of missing) {
            setDoc(doc(currentDb, 'routes', m.id), formatRouteForFirestore(m)).catch(console.error);
          }

          setRoutes((prev) => {
            const localOnly = prev.filter((r) => !remoteIds.has(r.id));
            const existingIds = new Set([...remoteRoutes.map((r) => r.id), ...localOnly.map((r) => r.id)]);
            const missingClubRoutes = INITIAL_ROUTES.filter((r) => !existingIds.has(r.id));
            return [...remoteRoutes, ...localOnly, ...missingClubRoutes];
          });
        } else {
          // If Firestore is empty, preserve local routes and seed missing official routes
          setRoutes((prev) => {
            const existingIds = new Set(prev.map((r) => r.id));
            const missing = INITIAL_ROUTES.filter((r) => !existingIds.has(r.id));
            const merged = [...prev, ...missing];
            for (const r of merged) {
              setDoc(doc(currentDb, 'routes', r.id), formatRouteForFirestore(r)).catch(console.error);
            }
            return merged;
          });
        }

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

    // Listen for real-time club broadcasts from organizers / admins
    let unsubscribeAnnouncements: (() => void) | undefined;
    try {
      unsubscribeAnnouncements = onSnapshot(doc(db, 'settings', 'latest_announcement'), (snap) => {
        if (!snap.exists()) return;
        const announcement = snap.data() as ClubNotification;
        if (!announcement || !announcement.id) return;

        setNotifications((prev) => {
          if (prev.some((n) => n.id === announcement.id)) return prev;
          storeNotification(announcement);
          showLocalNotification(announcement.title, announcement.body);
          return [announcement, ...prev];
        });
      });
    } catch (e) {
      console.warn('Real-time announcement listener error:', e);
    }

    return () => {
      unsubscribeAnnouncements?.();
    };
  }, []);

  /**
   * Load private data for the signed-in viewer. Staff get the full roster,
   * check-in log, gear queue and code words; runners get only their own check-ins.
   */
  const syncPrivateData = async (email: string, isStaff: boolean, isAdmin = false) => {
    if (!isFirebaseConfigured || !db) return;
    const currentDb = db;
    const cleanEmail = email.trim().toLowerCase();

    try {
      // Own claimed legacy history feeds streaks and badges at check-in.
      const ownSnap = await getDoc(doc(currentDb, 'users', cleanEmail));
      const ownIds = (ownSnap.exists() && (ownSnap.data().linkedLegacyIds as string[])) || [];
      fetchLegacyEvents(ownIds).then(setOwnLegacyEvents).catch((err) => console.warn('Legacy history load failed:', err));
      if (isStaff) loadLegacyPool().catch((err) => console.warn('Legacy pool load failed:', err));

      if (!isStaff) {
        const own = await getDocs(query(collection(currentDb, 'checkins'), where('userEmail', '==', cleanEmail)));
        const ownCheckins = own.docs.map((d) => d.data() as CheckInRecord);
        setCheckins((prev) => {
          const ids = new Set(ownCheckins.map((c) => c.id));
          return [...ownCheckins, ...prev.filter((c) => !ids.has(c.id) && c.userEmail.toLowerCase() !== cleanEmail)];
        });
        return;
      }

      const usersSnap = await getDocs(collection(currentDb, 'users'));
      const remoteUsers = usersSnap.docs
        .map((d) => d.data() as UserProfile)
        .filter((u) => !REMOVED_TEST_EMAILS.has(u.email.toLowerCase()));
      if (remoteUsers.length > 0) {
        const remoteEmails = new Set(remoteUsers.map((u) => u.email.toLowerCase()));
        setUsers((prev) => [...remoteUsers, ...prev.filter((u) => !remoteEmails.has(u.email.toLowerCase()))]);
      }

      const checkinsSnap = await getDocs(collection(currentDb, 'checkins'));
      const remoteCheckins = checkinsSnap.docs
        .map((d) => d.data() as CheckInRecord)
        .filter((c) => !REMOVED_TEST_EMAILS.has(c.userEmail.toLowerCase()));
      if (remoteCheckins.length > 0) {
        const remoteIds = new Set(remoteCheckins.map((c) => c.id));
        setCheckins((prev) => [...remoteCheckins, ...prev.filter((c) => !remoteIds.has(c.id))]);
      }

      const alertsSnap = await getDocs(collection(currentDb, 'milestone_alerts'));
      const remoteAlerts = alertsSnap.docs
        .map((d) => d.data() as MilestoneAlert)
        .filter((a) => a.userEmail && !REMOVED_TEST_EMAILS.has(a.userEmail.toLowerCase()));
      if (remoteAlerts.length > 0) {
        const remoteIds = new Set(remoteAlerts.map((a) => a.id));
        setMilestoneAlerts((prev) => [...remoteAlerts, ...prev.filter((a) => !remoteIds.has(a.id))]);
      }

      // Code words (staff), keyed by run ID.
      const secretsSnap = await getDocs(collection(currentDb, 'meetup_secrets'));
      const codeWords: Record<string, string> = {};
      secretsSnap.docs.forEach((d) => {
        const cw = d.data().codeWord;
        if (typeof cw === 'string') codeWords[d.id] = cw;
      });

      // One-time migration (admins): check-in events and check-ins used to be keyed
      // by date. Re-key each to its run (one check-in per runner per run) and add
      // the code word lookup key. Dates with no run, or more than one, are skipped.
      let migrated = false;
      if (isAdmin) {
        const DATE_ID = /^\d{4}-\d{2}-\d{2}$/;
        const [evSnap, runsSnap] = await Promise.all([
          getDocs(collection(currentDb, 'meetup_events')),
          getDocs(collection(currentDb, 'runs')),
        ]);
        const allRuns = runsSnap.docs.map((d) => d.data() as RunEvent);
        for (const d of evSnap.docs) {
          if (!DATE_ID.test(d.id)) continue;
          const data = d.data();
          const date: string = data.date || d.id;
          const matches = allRuns.filter((r) => r.date === date);
          if (matches.length !== 1) {
            console.warn(`Not migrating check-in event ${d.id}: ${matches.length} runs on that date.`);
            continue;
          }
          const runId = matches[0].id;
          const word = (codeWords[d.id] || (typeof data.codeWord === 'string' ? data.codeWord : '')).trim().toUpperCase();
          const win = computeCheckInWindow(date, data.time);
          const { codeWord: _legacyWord, ...rest } = data;
          try {
            const batch = writeBatch(currentDb);
            batch.set(doc(currentDb, 'meetup_events', runId), {
              ...rest,
              id: runId,
              runId,
              date,
              checkInOpensAt: data.checkInOpensAt instanceof Timestamp ? data.checkInOpensAt : Timestamp.fromDate(win.opensAt),
              checkInClosesAt: data.checkInClosesAt instanceof Timestamp ? data.checkInClosesAt : Timestamp.fromDate(win.closesAt),
            });
            if (word) {
              batch.set(doc(currentDb, 'meetup_secrets', runId), { codeWord: word });
              batch.set(doc(currentDb, 'meetup_codes', await codeKeyFor(date, word)), { runId, date });
            }
            const ciSnap = await getDocs(query(collection(currentDb, 'checkins'), where('date', '==', date)));
            for (const c of ciSnap.docs) {
              const cd = c.data() as CheckInRecord;
              if (cd.runId) continue;
              const newId = `${runId}_${cd.userEmail}`;
              batch.set(doc(currentDb, 'checkins', newId), { ...cd, id: newId, runId });
              batch.delete(c.ref);
            }
            batch.delete(d.ref);
            if (codeWords[d.id] !== undefined) batch.delete(doc(currentDb, 'meetup_secrets', d.id));
            await batch.commit();
            if (word) codeWords[runId] = word;
            delete codeWords[d.id];
            migrated = true;
          } catch (err) {
            console.warn(`Migrating check-in event ${d.id} failed:`, err);
          }
        }
      }

      // Older migration: code word left on a public doc, or no check-in window yet.
      const publicSnap = await getDocs(collection(currentDb, 'meetup_events'));
      for (const d of publicSnap.docs) {
        const data = d.data();
        const legacyCodeWord = typeof data.codeWord === 'string' ? data.codeWord.trim().toUpperCase() : '';
        const needsWindow = !(data.checkInOpensAt instanceof Timestamp);
        if (!legacyCodeWord && !needsWindow) continue;
        if (legacyCodeWord && !codeWords[d.id]) {
          codeWords[d.id] = legacyCodeWord;
          await setDoc(doc(currentDb, 'meetup_secrets', d.id), { codeWord: legacyCodeWord });
        }
        const start = eventStart(data.date || d.id, data.time);
        await updateDoc(doc(currentDb, 'meetup_events', d.id), {
          codeWord: deleteField(),
          checkInOpensAt: Timestamp.fromDate(new Date(start.getTime() - 2 * 60 * 60 * 1000)),
          checkInClosesAt: Timestamp.fromDate(new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59)),
        });
      }
      const freshEvents = migrated
        ? (await getDocs(collection(currentDb, 'meetup_events'))).docs.map((d) => meetupFromPublicDoc(d.data()))
        : null;
      setMeetupEvents((prev) =>
        (freshEvents || prev).map((e) => (codeWords[e.id] ? { ...e, codeWord: codeWords[e.id] } : e))
      );
      if (migrated) {
        const ciSnap = await getDocs(collection(currentDb, 'checkins'));
        setCheckins(ciSnap.docs.map((d) => d.data() as CheckInRecord));
      }

      // Make sure every profile has an up-to-date hashed leaderboard row.
      // Only admins may write other people's rows.
      for (const u of isAdmin ? remoteUsers : []) {
        const key = await memberKeyFor(u.email);
        setDoc(doc(currentDb, 'members', key), toPublicMember(u, key)).catch(console.error);
      }
    } catch (err) {
      console.warn('Private Firestore sync failed:', err);
    }
  };

  /** Drop other people's data from memory and this device on sign-out. */
  const clearPrivateData = () => {
    // In local (no-Firebase) mode the browser IS the database, so keep it.
    if (!isFirebaseConfigured) return;
    setUsers([]);
    setCheckins([]);
    setMilestoneAlerts([]);
    setMeetupEvents((prev) => prev.map((e) => ({ ...e, codeWord: '' })));
    for (const k of PRIVATE_STORAGE_KEYS) {
      try {
        localStorage.removeItem(STORAGE_KEYS[k]);
      } catch {
        // ignore
      }
    }
  };

  /** Unclaimed legacy names that fuzzily match what the runner typed (e.g. MATT SETTLED). */
  const searchLegacyMatches = (nameQuery: string): LegacyMember[] =>
    matchLegacyNames(nameQuery, legacyMembers.filter((m) => !isLegacyClaimed(m)));

  /**
   * Load the legacy name pool: one index doc (names + counts) plus the claimed
   * profiles, so claim status is current. Signed-in users only.
   */
  const loadLegacyPool = async (): Promise<LegacyMember[]> => {
    if (!isFirebaseConfigured || !db) return legacyPool;
    const [indexSnap, claimedSnap] = await Promise.all([
      getDoc(doc(db, 'legacy_index', 'pool')),
      getDocs(query(collection(db, 'legacy_profiles'), where('claimedBy', '!=', null))),
    ]);
    const claimed = new Map(claimedSnap.docs.map((d) => [d.id, d.data()]));
    const entries: { id: string; name: string; oldCount: number; newCount: number }[] =
      (indexSnap.exists() && indexSnap.data().entries) || [];
    const pool: LegacyMember[] = entries.map((e) => ({
      id: e.id,
      name: e.name,
      oldCount: e.oldCount,
      newCount: e.newCount,
      totalRuns: e.oldCount + e.newCount,
      claimedBy: (claimed.get(e.id)?.claimedBy as string) || null,
      claimedByEmail: null,
      claimedAt: (claimed.get(e.id)?.claimedAt as string) || null,
    }));
    setLegacyMembers(pool);
    return pool;
  };

  /** Dated sign-ins for legacy names (readable by their claimer and staff). */
  const fetchLegacyEvents = async (ids: string[]): Promise<LegacyEvent[]> => {
    if (!ids.length || !isFirebaseConfigured || !db) return [];
    const currentDb = db;
    const snaps = await Promise.all(ids.map((id) => getDoc(doc(currentDb, 'legacy_history', id))));
    return snaps.flatMap((sn) => (sn.exists() ? ((sn.data().events as LegacyEvent[]) || []) : []));
  };

  /** Recalculate badges + streaks for a profile from all its dated history and save them. */
  const refreshDerivedStats = async (user: UserProfile, legacyEvents?: LegacyEvent[]): Promise<UserProfile> => {
    const events = legacyEvents ?? (await fetchLegacyEvents(user.linkedLegacyIds || []));
    const own = checkins.filter((c) => c.userEmail.toLowerCase() === user.email.toLowerCase());
    const derived = recomputeBadges(user, badges, datedEventsFrom(events, own, meetupEvents));
    const updated: UserProfile = { ...user, ...derived };
    const key = await memberKeyFor(user.email);
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.email), cleanFirestoreData({ ...derived }));
      batch.set(doc(db, 'members', key), toPublicMember(updated, key));
      await batch.commit();
    }
    setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === user.email.toLowerCase() ? updated : u)));
    setMembers((prev) => [memberFromUser(updated, key), ...prev.filter((m) => m.id !== key)]);
    if (user.email.toLowerCase() === currentUserEmail.toLowerCase()) setOwnLegacyEvents(events);
    return updated;
  };

  /**
   * Runner claims one legacy name. The rules only accept it if the name is
   * still unclaimed and the totals grow by exactly that name's counts.
   */
  const claimLegacyProfile = async (user: UserProfile, legacyId: string): Promise<UserProfile> => {
    const email = user.email.toLowerCase();
    const key = await memberKeyFor(email);
    if ((user.linkedLegacyIds || []).includes(legacyId)) return user;
    let lp = legacyPool.find((m) => m.id === legacyId);
    if (isFirebaseConfigured && db) {
      const snap = await getDoc(doc(db, 'legacy_profiles', legacyId));
      if (!snap.exists()) throw new Error('That old profile no longer exists.');
      lp = { ...(snap.data() as LegacyMember), claimedByEmail: null };
    }
    if (!lp) throw new Error('That old profile no longer exists.');
    if (isLegacyClaimed(lp)) throw new Error(`${lp.name} has already been claimed.`);

    const updated: UserProfile = {
      ...user,
      linkedLegacyIds: [...(user.linkedLegacyIds || []), legacyId],
      linkedLegacyNames: [...(user.linkedLegacyNames || []), lp.name],
      pre2021Runs: user.pre2021Runs + lp.oldCount,
      legacyEventRuns: (user.legacyEventRuns || 0) + lp.newCount,
      totalRuns: user.totalRuns + lp.oldCount + lp.newCount,
    };
    const claimedAt = new Date().toISOString();
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'legacy_profiles', legacyId), { claimedBy: key, claimedAt });
      batch.set(doc(db, 'users', email), cleanFirestoreData(updated));
      batch.set(doc(db, 'members', key), toPublicMember(updated, key));
      await batch.commit();
    }
    setLegacyMembers((prev) => prev.map((m) => (m.id === legacyId ? { ...m, claimedBy: key, claimedAt } : m)));
    setUsers((prev) => [updated, ...prev.filter((u) => u.email.toLowerCase() !== email)]);
    return updated;
  };

  /**
   * Admin: assign a legacy name to a runner (toEmail) or unclaim it (null).
   * Moves its counts off the previous claimer and onto the new one in one batch.
   */
  const adminSetLegacyClaim = async (legacyId: string, toEmail: string | null): Promise<void> => {
    const lp = legacyMembers.find((m) => m.id === legacyId);
    if (!lp) throw new Error('Unknown legacy profile.');
    const target = toEmail ? users.find((u) => u.email.toLowerCase() === toEmail.toLowerCase()) : undefined;
    if (toEmail && !target) throw new Error('Runner not found.');

    const previous = users.find(
      (u) =>
        (u.linkedLegacyIds || []).includes(legacyId) ||
        (u.linkedLegacyNames || []).some((n) => n.toUpperCase() === lp.name.toUpperCase())
    );
    if (previous && target && previous.email === target.email) return;

    const withoutClaim = (u: UserProfile): UserProfile => ({
      ...u,
      linkedLegacyIds: (u.linkedLegacyIds || []).filter((id) => id !== legacyId),
      linkedLegacyNames: (u.linkedLegacyNames || []).filter((n) => n.toUpperCase() !== lp.name.toUpperCase()),
      pre2021Runs: Math.max(0, u.pre2021Runs - lp.oldCount),
      legacyEventRuns: Math.max(0, (u.legacyEventRuns || 0) - lp.newCount),
      totalRuns: Math.max(0, u.totalRuns - lp.oldCount - lp.newCount),
    });
    const withClaim = (u: UserProfile): UserProfile => ({
      ...u,
      linkedLegacyIds: [...(u.linkedLegacyIds || []), legacyId],
      linkedLegacyNames: [...(u.linkedLegacyNames || []), lp.name],
      pre2021Runs: u.pre2021Runs + lp.oldCount,
      legacyEventRuns: (u.legacyEventRuns || 0) + lp.newCount,
      totalRuns: u.totalRuns + lp.oldCount + lp.newCount,
    });

    const changed: UserProfile[] = [];
    if (previous) changed.push(withoutClaim(previous));
    if (target) changed.push(withClaim(target));
    const toKey = target ? await memberKeyFor(target.email) : null;
    const claimedAt = target ? new Date().toISOString() : null;

    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.update(doc(db, 'legacy_profiles', legacyId), { claimedBy: toKey, claimedAt });
      for (const u of changed) {
        const key = await memberKeyFor(u.email);
        batch.set(doc(db, 'users', u.email), cleanFirestoreData(u));
        batch.set(doc(db, 'members', key), toPublicMember(u, key));
      }
      await batch.commit();
    }
    setLegacyMembers((prev) => prev.map((m) => (m.id === legacyId ? { ...m, claimedBy: toKey, claimedAt } : m)));
    setUsers((prev) => prev.map((u) => changed.find((c) => c.email === u.email) || u));
    for (const u of changed) await refreshDerivedStats(u);
  };

  /**
   * Admin: import (or re-import) the old app's two CSV exports. Existing claims
   * are kept, and claimers' totals are recalculated from the new counts.
   */
  const importLegacyData = async (totalsCsv: string, checkinsCsv: string, onProgress?: (msg: string) => void) => {
    const imp = buildLegacyImport(totalsCsv, checkinsCsv);
    if (!isFirebaseConfigured || !db) {
      setLegacyMembers(imp.profiles.map((p) => ({ ...p, claimedBy: null, claimedByEmail: null, claimedAt: null })));
      return imp.stats;
    }
    const currentDb = db;
    const existing = await getDocs(query(collection(currentDb, 'legacy_profiles'), where('claimedBy', '!=', null)));
    const claims = new Map(existing.docs.map((d) => [d.id, d.data()]));

    type Write = (b: ReturnType<typeof writeBatch>) => void;
    const writes: Write[] = [
      (b) =>
        b.set(doc(currentDb, 'legacy_index', 'pool'), {
          entries: imp.profiles.map(({ id, name, oldCount, newCount }) => ({ id, name, oldCount, newCount })),
          importedAt: new Date().toISOString(),
        }),
    ];
    for (const p of imp.profiles) {
      const c = claims.get(p.id);
      writes.push((b) =>
        b.set(doc(currentDb, 'legacy_profiles', p.id), {
          ...p,
          claimedBy: (c?.claimedBy as string) || null,
          claimedAt: (c?.claimedAt as string) || null,
        })
      );
      writes.push((b) => b.set(doc(currentDb, 'legacy_history', p.id), { id: p.id, events: imp.histories[p.id] || [] }));
    }

    // Re-total every claimer from the imported counts (ids that no longer exist are dropped).
    const byId = new Map(imp.profiles.map((p) => [p.id, p]));
    const retotaled: UserProfile[] = [];
    for (const u of users) {
      if (!(u.linkedLegacyIds || []).length) continue;
      const lps = (u.linkedLegacyIds || []).filter((id) => byId.has(id)).map((id) => byId.get(id)!);
      const pre = lps.reduce((sum, p) => sum + p.oldCount, 0);
      const ev = lps.reduce((sum, p) => sum + p.newCount, 0);
      retotaled.push({
        ...u,
        linkedLegacyIds: lps.map((p) => p.id),
        linkedLegacyNames: lps.map((p) => p.name),
        pre2021Runs: pre,
        legacyEventRuns: ev,
        totalRuns: pre + ev + u.loggedRuns,
      });
    }
    for (const u of retotaled) {
      const key = await memberKeyFor(u.email);
      writes.push((b) => b.set(doc(currentDb, 'users', u.email), cleanFirestoreData(u)));
      writes.push((b) => b.set(doc(currentDb, 'members', key), toPublicMember(u, key)));
    }

    const CHUNK = 400;
    for (let i = 0; i < writes.length; i += CHUNK) {
      const batch = writeBatch(currentDb);
      writes.slice(i, i + CHUNK).forEach((w) => w(batch));
      await batch.commit();
      onProgress?.(`Saved ${Math.min(i + CHUNK, writes.length)} of ${writes.length} records…`);
    }

    setUsers((prev) => prev.map((u) => retotaled.find((r) => r.email === u.email) || u));
    await loadLegacyPool();
    for (const u of retotaled) await refreshDerivedStats(u);
    return imp.stats;
  };

  /**
   * Register a new user profile with optional claimed legacy historical records
   */
  const registerUser = async (
    profileData: {
      email: string;
      firstName: string;
      lastName: string;
      shirtSize: string;
      birthday?: string;
      age?: number;
      city?: string;
      zipCode?: string;
      preferredPace?: string;
    },
    claimedLegacyIds: string[] = []
  ): Promise<UserProfile> => {
    const cleanEmail = profileData.email.trim().toLowerCase();
    const displayName = `${profileData.firstName.trim()} ${profileData.lastName.trim()}`;

    const effectiveAge = profileData.birthday
      ? calculateAge(profileData.birthday)
      : profileData.age;

    // Profiles start empty: legacy runs arrive one claim at a time (each checked
    // by the rules), and new runs through check-ins.
    const newUser: UserProfile = {
      email: cleanEmail,
      firstName: profileData.firstName.trim(),
      lastName: profileData.lastName.trim(),
      displayName,
      shirtSize: profileData.shirtSize,
      birthday: profileData.birthday,
      age: effectiveAge,
      city: profileData.city || 'Woodland',
      zipCode: profileData.zipCode || '95695',
      preferredPace: profileData.preferredPace,
      pre2021Runs: 0,
      legacyEventRuns: 0,
      loggedRuns: 0,
      totalRuns: 0,
      totalMiles: 0,
      runCount: 0,
      walkCount: 0,
      petRunCount: 0,
      firstRunDate: new Date().toISOString().split('T')[0],
      linkedLegacyIds: [],
      linkedLegacyNames: [],
      unlockedBadgeIds: [],
      badgeCounts: {},
      role: ADMIN_EMAILS.includes(cleanEmail) ? 'admin' : 'member',
      createdAt: new Date().toISOString(),
    };

    const memberKey = await memberKeyFor(cleanEmail);

    // Persist first so the UI never shows a profile the server rejected.
    // users + members go in one batch: the rules require the public row to mirror the profile.
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', cleanEmail), cleanFirestoreData(newUser));
      batch.set(doc(db, 'members', memberKey), toPublicMember(newUser, memberKey));
      await batch.commit();
    }

    setUsers((prev) => [newUser, ...prev.filter((u) => u.email.toLowerCase() !== cleanEmail)]);
    setMembers((prev) => [memberFromUser(newUser, memberKey), ...prev.filter((m) => m.id !== memberKey)]);

    setCurrentUserEmail(cleanEmail);
    setCurrentMemberId(memberKey);

    // Claim the selected old profiles one by one; a name someone else grabbed
    // in the meantime is reported but doesn't undo the rest.
    let finalUser = newUser;
    const failed: string[] = [];
    for (const id of claimedLegacyIds) {
      try {
        finalUser = await claimLegacyProfile(finalUser, id);
      } catch (err) {
        console.warn('Legacy claim failed:', id, err);
        failed.push(legacyPool.find((m) => m.id === id)?.name || id);
      }
    }
    if ((finalUser.linkedLegacyIds || []).length) {
      try {
        finalUser = await refreshDerivedStats(finalUser);
      } catch (err) {
        console.warn('Badge refresh failed:', err);
      }
    }

    // New profiles never go through the returning-user path in App, so load
    // private data (and run the staff code-word migration) here as well.
    if (isFirebaseConfigured && db) {
      syncPrivateData(cleanEmail, newUser.role === 'admin' || newUser.role === 'organizer', newUser.role === 'admin');
    }

    if (failed.length) {
      throw Object.assign(
        new Error(`Your profile was created, but these old profiles were already claimed: ${failed.join(', ')}. Ask an organizer if one of them is yours.`),
        { user: finalUser }
      );
    }
    return finalUser;
  };

  /**
   * Admin only: delete a runner so the email can sign up fresh. Removes their
   * profile, leaderboard row, check-ins, gear alerts and RSVPs, and unclaims
   * any old-app names they linked. Their sign-in account itself is untouched.
   */
  const adminDeleteRunner = async (email: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === currentUserEmail.toLowerCase()) throw new Error("You can't delete your own profile.");
    const key = await memberKeyFor(cleanEmail);
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
    const legacyIds = new Set([
      ...(user?.linkedLegacyIds || []),
      ...legacyPool.filter((m) => m.claimedBy === key).map((m) => m.id),
    ]);

    if (isFirebaseConfigured && db) {
      const currentDb = db;
      type Op = (b: ReturnType<typeof writeBatch>) => void;
      const ops: Op[] = [];
      // Query the server too, so nothing is missed if local state is partial.
      const [ciSnap, alertSnap, claimSnap] = await Promise.all([
        getDocs(query(collection(currentDb, 'checkins'), where('userEmail', '==', cleanEmail))),
        getDocs(query(collection(currentDb, 'milestone_alerts'), where('userEmail', '==', cleanEmail))),
        getDocs(query(collection(currentDb, 'legacy_profiles'), where('claimedBy', '==', key))),
      ]);
      ciSnap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      alertSnap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      claimSnap.docs.forEach((d) => legacyIds.add(d.id));
      legacyIds.forEach((id) =>
        ops.push((b) => b.update(doc(currentDb, 'legacy_profiles', id), { claimedBy: null, claimedAt: null }))
      );
      for (const run of runs) {
        if (run.attendees.some((a) => a.memberId === key)) {
          ops.push((b) =>
            b.update(doc(currentDb, 'runs', run.id), { attendees: run.attendees.filter((a) => a.memberId !== key) })
          );
        }
      }
      ops.push((b) => b.delete(doc(currentDb, 'members', key)));
      ops.push((b) => b.delete(doc(currentDb, 'users', cleanEmail)));
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(currentDb);
        ops.slice(i, i + 400).forEach((op) => op(batch));
        await batch.commit();
      }
    }

    setUsers((prev) => prev.filter((u) => u.email.toLowerCase() !== cleanEmail));
    setMembers((prev) => prev.filter((m) => m.id !== key));
    setCheckins((prev) => prev.filter((c) => c.userEmail.toLowerCase() !== cleanEmail));
    setMilestoneAlerts((prev) => prev.filter((a) => a.userEmail.toLowerCase() !== cleanEmail));
    setRuns((prev) => prev.map((r) => ({ ...r, attendees: r.attendees.filter((a) => a.memberId !== key) })));
    setLegacyMembers((prev) =>
      prev.map((m) => (legacyIds.has(m.id) ? { ...m, claimedBy: null, claimedByEmail: null, claimedAt: null } : m))
    );
  };

  /**
   * Admin only: change another runner's role (member / organizer / admin).
   * The rules reject role changes by non-admins and on your own profile.
   */
  const setUserRole = async (email: string, role: 'member' | 'organizer' | 'admin'): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (isFirebaseConfigured && db) {
      await updateDoc(doc(db, 'users', cleanEmail), { role });
    }
    setUsers((prev) => prev.map((u) => (u.email.toLowerCase() === cleanEmail ? { ...u, role } : u)));
  };

  /**
   * Check in a runner to a scheduled meetup event
   */
  const checkInRunner = async (params: {
    eventId: string; // the run's ID
    userEmail: string;
    codeWordEntered: string;
    activity: ActivityType;
    distanceChoice: DistanceChoice;
    loops?: number;
    withPet?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    route?: RouteOption;
    checkIn?: CheckInRecord;
    user?: UserProfile;
    newBadges?: Badge[];
    milestoneAlert?: MilestoneAlert;
  }> => {
    const { eventId, userEmail, codeWordEntered, activity, distanceChoice, loops, withPet } = params;
    const cleanEmail = userEmail.trim().toLowerCase();

    // 1. Locate exactly this run's check-in event (never fall back to another run)
    const event = meetupEvents.find((e) => e.id === eventId);
    if (!event) {
      return { success: false, message: "Check-in isn't set up for this run." };
    }
    const eventDate = event.date;

    // 2. Validate Code Word. With Firebase the code word is secret and the
    //    Firestore rules verify it; locally we compare against the stored one.
    if (!isFirebaseConfigured) {
      if (codeWordEntered.trim().toUpperCase() !== (event.codeWord || '').trim().toUpperCase()) {
        return {
          success: false,
          message: `Incorrect code word! Today's code word was announced by the organizer before the run.`,
        };
      }
    }

    // 3. Locate route option and actual measured miles
    let routeOption: RouteOption | undefined = event.routes[String(distanceChoice)];
    if (!routeOption) {
      const allRoutes = Object.values(event.routes || {});
      const numDist = typeof distanceChoice === 'number' ? distanceChoice : parseFloat(String(distanceChoice)) || 0;
      routeOption = allRoutes.find(
        (r) => r.routeId === String(distanceChoice) ||
               (numDist > 0 && Math.abs(r.actualMiles - numDist) < 0.25) ||
               r.name.toLowerCase() === String(distanceChoice).toLowerCase()
      );
    }
    if (!routeOption) {
      const numDist = typeof distanceChoice === 'number' ? distanceChoice : parseFloat(String(distanceChoice)) || 3.0;
      routeOption = {
        name: `${distanceChoice}-Mile Club Route`,
        actualMiles: numDist,
        baseMiles: numDist,
        directions: 'Follow group leader from Blue Note Brewing.',
      };
    }

    // 3b. Compute effective loops and actual credited mileage
    const effectiveLoops = (loops && loops > 0) ? loops : 1;
    const baseLoopMiles = routeOption.baseMiles || routeOption.actualMiles;
    const computedActualMiles = effectiveLoops > 1
      ? Math.round(baseLoopMiles * effectiveLoops * 100) / 100
      : routeOption.actualMiles;
    const computedRouteName = effectiveLoops > 1
      ? `${routeOption.name} (${effectiveLoops} Loops)`
      : routeOption.name;

    const creditedRoute: RouteOption = {
      ...routeOption,
      name: computedRouteName,
      actualMiles: computedActualMiles,
    };

    // 4. Find the runner. Never fall back to the signed-in user for someone else's email.
    const u = users.find((x) => x.email.toLowerCase() === cleanEmail)
      || (currentUser.email.toLowerCase() === cleanEmail ? currentUser : undefined);
    if (!u || u.role === 'guest') {
      return { success: false, message: 'No runner profile found for this email. Please join the club first.' };
    }

    // 5. Check if runner already has a check-in for this event date (allow updates!)
    // One check-in per runner per run
    const checkinId = `${eventId}_${cleanEmail}`;
    const existingCheckIn = checkins.find((c) => c.id === checkinId);
    const isUpdate = Boolean(existingCheckIn);

    const now = new Date();
    const nowIso = now.toISOString();
    const timeStr = now.toTimeString().split(' ')[0]; // "HH:MM:SS"

    const newCheckIn: CheckInRecord = {
      ...(existingCheckIn || {}),
      id: checkinId,
      runId: eventId,
      date: eventDate,
      time: timeStr,
      userEmail: cleanEmail,
      runnerName: u.displayName,
      activity,
      distanceChoice,
      actualMiles: computedActualMiles,
      routeName: computedRouteName,
      loops: effectiveLoops,
      withPet: Boolean(withPet),
      source: 'pwa',
      codeWord: codeWordEntered.trim().toUpperCase(),
      createdAt: existingCheckIn?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    // 6. Compute updated totals & badges (pure: no React state updaters involved)
    const earnedBadges: Badge[] = [];

    const newTotalRuns = isUpdate ? u.totalRuns : u.totalRuns + 1;
    const newLoggedRuns = isUpdate ? u.loggedRuns : u.loggedRuns + 1;
    const oldMiles = existingCheckIn ? existingCheckIn.actualMiles : 0;
    const newTotalMiles = Math.round((u.totalMiles - oldMiles + computedActualMiles) * 100) / 100;

    let newRunCount = u.runCount;
    let newWalkCount = u.walkCount;
    if (!isUpdate) {
      if (activity === 'running') newRunCount++;
      if (activity === 'walking') newWalkCount++;
    } else if (existingCheckIn && existingCheckIn.activity !== activity) {
      if (activity === 'running') {
        newRunCount++;
        newWalkCount = Math.max(0, newWalkCount - 1);
      } else {
        newWalkCount++;
        newRunCount = Math.max(0, newRunCount - 1);
      }
    }

    let newPetRunCount = u.petRunCount || 0;
    if (!isUpdate) {
      if (withPet) newPetRunCount++;
    } else if (existingCheckIn) {
      if (!existingCheckIn.withPet && withPet) newPetRunCount++;
      if (existingCheckIn.withPet && !withPet) newPetRunCount = Math.max(0, newPetRunCount - 1);
    }

    const newDistanceCounts: Record<string, number> = { ...(u.distanceCounts || {}) };
    if (isUpdate && existingCheckIn) {
      const oldM = existingCheckIn.actualMiles;
      const oldLegacyBucket = oldM <= 2.0 ? '1' : oldM <= 4.0 ? '3' : '5';
      const oldRoundedKey = (Math.round(oldM * 10) / 10).toFixed(1);
      if (newDistanceCounts[oldLegacyBucket]) newDistanceCounts[oldLegacyBucket] = Math.max(0, newDistanceCounts[oldLegacyBucket] - 1);
      if (newDistanceCounts[oldRoundedKey]) newDistanceCounts[oldRoundedKey] = Math.max(0, newDistanceCounts[oldRoundedKey] - 1);
      if (newDistanceCounts[`${oldRoundedKey} mi`]) newDistanceCounts[`${oldRoundedKey} mi`] = Math.max(0, newDistanceCounts[`${oldRoundedKey} mi`] - 1);
    }
    const roundedDistKey = (Math.round(computedActualMiles * 10) / 10).toFixed(1);
    const legacyBucket = computedActualMiles <= 2.0 ? '1' : computedActualMiles <= 4.0 ? '3' : '5';
    newDistanceCounts[legacyBucket] = (newDistanceCounts[legacyBucket] || 0) + 1;
    newDistanceCounts[roundedDistKey] = (newDistanceCounts[roundedDistKey] || 0) + 1;
    newDistanceCounts[`${roundedDistKey} mi`] = (newDistanceCounts[`${roundedDistKey} mi`] || 0) + 1;

    const unlocked = [...(u.unlockedBadgeIds || [])];
    const counts: Record<string, number> = { ...(u.badgeCounts || {}) };

    // Helper to award / increment an achievement badge
    const awardBadge = (badgeId: string, customMultiplier?: number) => {
      const isFirstTime = !unlocked.includes(badgeId);
      const b = badges.find((x) => x.id === badgeId);
      if (isFirstTime) {
        unlocked.push(badgeId);
        if (b) earnedBadges.push(b);
      }
      if (customMultiplier !== undefined) {
        const prevCount = counts[badgeId] || 0;
        if (customMultiplier > prevCount && !isFirstTime && b) earnedBadges.push(b);
        counts[badgeId] = customMultiplier;
      } else {
        counts[badgeId] = (counts[badgeId] || 0) + 1;
        if (!isFirstTime && b) earnedBadges.push(b);
      }
    };

    // Weekly streaks from every dated run: claimed old-app sign-ins + this app's check-ins
    const streaks = computeStreaks([
      ...(cleanEmail === currentUserEmail.toLowerCase() ? ownLegacyEvents.map((e) => e.d) : []),
      ...checkins.filter((c) => c.userEmail.toLowerCase() === cleanEmail).map((c) => c.date),
      eventDate,
    ]);

    // Unified badge evaluation (handles built-in and admin-created custom badges)
    for (const badge of badges) {
      const cfg = badge.triggerConfig;
      if (!cfg) {
        // Fallback for any badge without triggerConfig
        if (badge.id === 'first-chuck' && newTotalRuns >= 1) awardBadge(badge.id, 1);
        if (badge.id === 'milestone-5' && newTotalRuns >= 5) awardBadge(badge.id, Math.floor(newTotalRuns / 5));
        if (badge.id === 'milestone-50' && newTotalRuns >= 50) awardBadge(badge.id, Math.floor(newTotalRuns / 50));
        if (badge.id === 'milestone-100' && newTotalRuns >= 100) awardBadge(badge.id, Math.floor(newTotalRuns / 100));
        if (badge.id === 'milestone-200' && newTotalRuns >= 200) awardBadge(badge.id, Math.floor(newTotalRuns / 200));
        if (badge.id === 'power-walker' && newWalkCount >= 10) awardBadge(badge.id, Math.floor(newWalkCount / 10));
        if (badge.id === 'streak-4' && streaks.longest >= 4) awardBadge(badge.id, Math.floor(streaks.longest / 4));
        if (badge.id === 'streak-10' && streaks.longest >= 10) awardBadge(badge.id, Math.floor(streaks.longest / 10));
        if (badge.id === 'pet-runner' && newPetRunCount >= 1) awardBadge(badge.id, newPetRunCount);
        continue;
      }

      switch (cfg.type) {
        case 'milestone': {
          const threshold = cfg.minTotalRuns || 1;
          if (newTotalRuns >= threshold) {
            const mult = cfg.isIncremental ? Math.floor(newTotalRuns / (cfg.step || threshold)) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'activity': {
          const isWalk = cfg.activityType === 'walking';
          const count = isWalk ? newWalkCount : newRunCount;
          const threshold = cfg.activityCount || 10;
          if (count >= threshold) {
            const mult = cfg.isIncremental ? Math.floor(count / (cfg.step || threshold)) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'distance': {
          const distKey = (cfg.distanceChoice || cfg.distanceTier || '3.1').toString();
          const count = newDistanceCounts[distKey] || 0;
          const threshold = cfg.distanceCount || 1;
          if (count >= threshold) {
            const mult = cfg.isIncremental ? Math.floor(count / (cfg.step || threshold)) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'special_event': {
          // Only credit special-event badges once per night (not again on a same-night edit)
          if (isUpdate) break;
          const seId = cfg.specialEventId || badge.id.replace(/^special-/, '');
          const cw = (event.codeWord || codeWordEntered).toUpperCase();
          const isMatch = (event.specialEvent && event.specialEvent === seId) ||
            (seId === 'turkey_trot' && (cw.includes('TURKEY') || event.title.toLowerCase().includes('turkey'))) ||
            (seId === 'halloween' && (cw.includes('HALLOWEEN') || cw.includes('SPOOKY') || event.title.toLowerCase().includes('halloween'))) ||
            (seId === 'anniversary' && (cw.includes('ANNIVERSARY') || event.title.toLowerCase().includes('anniversary')));
          if (isMatch) {
            awardBadge(badge.id);
          }
          break;
        }
        case 'streak': {
          // Consecutive weeks with a run, across claimed legacy history and app check-ins
          const weeks = cfg.streakWeeks || 4;
          if (streaks.longest >= weeks) {
            const mult = cfg.isIncremental ? Math.floor(streaks.longest / weeks) : 1;
            awardBadge(badge.id, Math.max(1, mult));
          }
          break;
        }
        case 'pet': {
          if (newPetRunCount >= 1) {
            awardBadge(badge.id, newPetRunCount);
          }
          break;
        }
        case 'attendance': {
          if (newTotalRuns >= 1) {
            awardBadge(badge.id, 1);
          }
          break;
        }
      }
    }

    const updatedUser: UserProfile = {
      ...u,
      totalRuns: newTotalRuns,
      loggedRuns: newLoggedRuns,
      totalMiles: newTotalMiles,
      runCount: newRunCount,
      walkCount: newWalkCount,
      petRunCount: newPetRunCount,
      distanceCounts: newDistanceCounts,
      unlockedBadgeIds: unlocked,
      badgeCounts: counts,
      lastCheckInDate: eventDate,
      lastCheckInRunId: eventId,
      currentStreakWeeks: streaks.current,
      longestStreakWeeks: streaks.longest,
    };

    // 7. Milestone gear alert — only when this check-in is what crossed the milestone
    //    (never on a same-night edit), with a deterministic ID so it can't duplicate.
    let unlockedMilestone: MilestoneAlert | undefined;
    if (!isUpdate) {
      const milestoneBadge = badges.find(
        (b) => b.category === 'milestone' && Boolean(b.triggerConfig?.reward) && b.triggerConfig?.minTotalRuns === newTotalRuns
      );
      const mDef = milestoneBadge ? undefined : CLUB_MILESTONES.find((m) => m.runsRequired === newTotalRuns);
      if (milestoneBadge || mDef) {
        unlockedMilestone = {
          id: `m${newTotalRuns}_${cleanEmail}`,
          userEmail: cleanEmail,
          runnerName: updatedUser.displayName,
          shirtSize: updatedUser.shirtSize,
          milestoneRuns: newTotalRuns,
          milestoneName: milestoneBadge ? milestoneBadge.name : mDef!.name,
          reward: milestoneBadge ? milestoneBadge.triggerConfig!.reward! : mDef!.reward,
          perks: milestoneBadge ? (milestoneBadge.triggerConfig?.perks || '$1 off draft beers at Blue Note') : mDef!.perks,
          date: eventDate,
          time: timeStr,
          runId: eventId,
          fulfilled: false,
        };
      }
    }

    // 8. Persist atomically. The Firestore rules verify the code word, the check-in
    //    window, and that the stats/leaderboard changes match this check-in.
    const memberKey = await memberKeyFor(cleanEmail);
    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'checkins', checkinId), cleanFirestoreData(newCheckIn));
        batch.set(doc(db, 'users', cleanEmail), cleanFirestoreData(updatedUser));
        batch.set(doc(db, 'members', memberKey), toPublicMember(updatedUser, memberKey));
        if (unlockedMilestone && !milestoneAlerts.some((a) => a.id === unlockedMilestone!.id)) {
          batch.set(doc(db, 'milestone_alerts', unlockedMilestone.id), cleanFirestoreData(unlockedMilestone));
        }
        await batch.commit();
      } catch (err: any) {
        console.error('Check-in rejected by server:', err);
        return {
          success: false,
          message: err?.code === 'permission-denied'
            ? "Check-in wasn't accepted. Double-check this run's code word — check-in opens 2 hours before the run."
            : 'Could not reach the club server. Please check your connection and try again.',
        };
      }
    }

    // 9. Server accepted it (or local mode): update local state
    setCheckins((prev) => [
      newCheckIn,
      ...prev.filter((c) => c.id !== checkinId),
    ]);
    setUsers((prev) => {
      const exists = prev.some((x) => x.email.toLowerCase() === cleanEmail);
      return exists
        ? prev.map((x) => (x.email.toLowerCase() === cleanEmail ? updatedUser : x))
        : [updatedUser, ...prev];
    });
    setMembers((prev) => [memberFromUser(updatedUser, memberKey), ...prev.filter((m) => m.id !== memberKey)]);
    if (unlockedMilestone) {
      const alert = unlockedMilestone;
      setMilestoneAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
    }

    return {
      success: true,
      message: isUpdate
        ? `Check-in updated to ${computedRouteName} (${computedActualMiles} mi)!`
        : `Checked in successfully! That's Run #${updatedUser.totalRuns} for you!`,
      route: creditedRoute,
      checkIn: newCheckIn,
      user: updatedUser,
      newBadges: earnedBadges,
      milestoneAlert: unlockedMilestone,
    };
  };

  /**
   * Mark a milestone reward as fulfilled / handed out by an organizer
   */
  const markMilestoneFulfilled = (alertId: string, fulfilledBy: string) => {
    setMilestoneAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, fulfilled: true, fulfilledAt: new Date().toISOString(), fulfilledBy }
          : a
      )
    );
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'milestone_alerts', alertId), { fulfilled: true, fulfilledAt: new Date().toISOString(), fulfilledBy }, { merge: true }).catch(console.error);
    }
  };

  /**
   * Save / update a meetup event (Admin)
   */
  const saveMeetupEvent = async (event: MeetupEvent) => {
    const win = computeCheckInWindow(event.date, event.time);
    const runId = event.runId || event.id;
    event = { ...event, id: runId, runId, checkInOpensAt: win.opensAt.toISOString(), checkInClosesAt: win.closesAt.toISOString() };
    const previous = meetupEvents.find((e) => e.id === runId);
    const newWord = (event.codeWord || '').trim().toUpperCase();
    const oldWord = (previous?.codeWord || '').trim().toUpperCase();
    const wordOrDateChanged = Boolean(newWord) && (newWord !== oldWord || previous?.date !== event.date);

    // Code words must be unique within a day: they decide which run a runner checks into.
    // (The database enforces this too; this gives a clearer message first.)
    if (wordOrDateChanged && meetupEvents.some((e) => e.id !== runId && e.date === event.date && (e.codeWord || '').toUpperCase() === newWord)) {
      throw Object.assign(new Error(`The code word ${newWord} is already used by another run on ${event.date}. Pick a different word.`), {
        code: 'duplicate-code-word',
      });
    }

    if (isFirebaseConfigured && db) {
      // Public doc: everything except the code word, plus the check-in window the rules enforce
      // (opens 2 hours before the start, closes at midnight).
      const { codeWord: _cw, checkInOpensAt: _o, checkInClosesAt: _c, ...publicEvent } = event;
      await setDoc(
        doc(db, 'meetup_events', runId),
        {
          ...cleanFirestoreData(publicEvent),
          codeWord: deleteField(),
          checkInOpensAt: Timestamp.fromDate(win.opensAt),
          checkInClosesAt: Timestamp.fromDate(win.closesAt),
        },
        { merge: true }
      );
      if (wordOrDateChanged) {
        // New lookup key first: creating it fails if the word is taken that day.
        try {
          await setDoc(doc(db, 'meetup_codes', await codeKeyFor(event.date, newWord)), { runId, date: event.date });
        } catch (err: any) {
          if (err?.code === 'permission-denied' && !(previous && win.opensAt <= new Date())) {
            throw Object.assign(new Error(`The code word ${newWord} is already used by another run on ${event.date}. Pick a different word.`), {
              code: 'duplicate-code-word',
            });
          }
          throw err;
        }
        if (previous && oldWord) {
          await deleteDoc(doc(db, 'meetup_codes', await codeKeyFor(previous.date, oldWord))).catch((err) =>
            console.warn('Old code word key not removed:', err)
          );
        }
        await setDoc(doc(db, 'meetup_secrets', runId), { codeWord: newWord });
      }
    }

    setMeetupEvents((prev) => (prev.some((e) => e.id === runId) ? prev.map((e) => (e.id === runId ? event : e)) : [event, ...prev]));
  };

  /** Which run a code word belongs to on a date (signed-in lookup; never lists code words). */
  const resolveRunByCodeWord = async (date: string, codeWord: string): Promise<string | null> => {
    const word = codeWord.trim().toUpperCase();
    if (!word) return null;
    if (!isFirebaseConfigured || !db) {
      return meetupEvents.find((e) => e.date === date && (e.codeWord || '').toUpperCase() === word)?.id || null;
    }
    const snap = await getDoc(doc(db, 'meetup_codes', await codeKeyFor(date, word)));
    return snap.exists() ? ((snap.data().runId as string) || null) : null;
  };

  /**
   * Create a new badge (Admin) - supports Milestones, Activity (Walk/Run), Distance (1/3/5), Special Events, Streaks
   */
  const createBadge = async (badgeData: {
    name: string;
    emoji: string;
    description: string;
    requirement: string;
    category: BadgeCategory;
    isIncremental?: boolean;
    maxMultiplier?: number;
    triggerConfig: BadgeTriggerConfig;
    createSpecialEventOption?: boolean;
  }): Promise<Badge> => {
    const cleanName = badgeData.name.trim();
    const cleanEmoji = badgeData.emoji.trim() || '🏅';
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;
    
    let uniqueId = `badge_${baseSlug}`;
    let counter = 1;
    while (badges.some((b) => b.id === uniqueId)) {
      uniqueId = `badge_${baseSlug}_${counter++}`;
    }

    const newBadge: Badge = {
      id: uniqueId,
      name: cleanName,
      emoji: cleanEmoji,
      description: badgeData.description.trim(),
      requirement: badgeData.requirement.trim(),
      category: badgeData.category,
      isIncremental: badgeData.isIncremental ?? false,
      maxMultiplier: badgeData.maxMultiplier,
      triggerConfig: badgeData.triggerConfig,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    // If it's a special event badge, also add a SpecialEventDefinition so it shows in event creator dropdowns
    if (badgeData.category === 'special_event' || badgeData.createSpecialEventOption) {
      let seId = badgeData.triggerConfig.specialEventId || baseSlug;
      if (specialEvents.some((se) => se.id === seId)) {
        seId = `${baseSlug}_${counter}`;
      }
      const newSE: SpecialEventDefinition = {
        id: seId,
        name: cleanName,
        emoji: cleanEmoji,
        badgeId: uniqueId,
        badgeDescription: newBadge.description,
        badgeRequirement: newBadge.requirement,
        isDefault: false,
        createdAt: new Date().toISOString(),
      };
      if (newBadge.triggerConfig) {
        newBadge.triggerConfig.specialEventId = seId;
      }
      setSpecialEvents((prev) => [...prev, newSE]);
      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'special_events', seId), newSE);
        } catch (e) {
          console.warn('Firebase SE save error:', e);
        }
      }
    }

    setBadges((prev) => [...prev, newBadge]);

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'badges', uniqueId), newBadge);
      } catch (e) {
        console.warn('Firebase badge save error:', e);
      }
    }

    return newBadge;
  };

  /**
   * Delete a custom badge (Admin)
   */
  const deleteBadge = async (badgeId: string): Promise<void> => {
    const b = badges.find((x) => x.id === badgeId);
    if (!b) return;
    if (b.isDefault) {
      console.warn('Cannot delete default club badge');
      return;
    }
    setBadges((prev) => prev.filter((x) => x.id !== badgeId));
    if (b.triggerConfig?.specialEventId) {
      setSpecialEvents((prev) => prev.filter((se) => se.id !== b.triggerConfig?.specialEventId && se.badgeId !== badgeId));
    }
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'badges', badgeId));
        if (b.triggerConfig?.specialEventId) {
          await deleteDoc(doc(db, 'special_events', b.triggerConfig.specialEventId));
        }
      } catch (e) {
        console.warn('Firebase badge delete error:', e);
      }
    }
  };

  /**
   * Create a special event directly (Admin)
   */
  const createSpecialEvent = async (name: string, emoji: string, description?: string): Promise<SpecialEventDefinition> => {
    const cleanName = name.trim();
    const cleanEmoji = emoji.trim() || '🏅';
    const baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `custom_${Date.now()}`;
    let uniqueId = baseSlug;
    let counter = 1;
    while (specialEvents.some((se) => se.id === uniqueId)) {
      uniqueId = `${baseSlug}_${counter++}`;
    }

    const badgeId = `special-${uniqueId}`;
    const badge = await createBadge({
      name: `${cleanName} Veteran`,
      emoji: cleanEmoji,
      description: description?.trim() || `Ran the annual ${cleanName} with the Woodchuckers!`,
      requirement: `Attended ${cleanName}`,
      category: 'special_event',
      isIncremental: true,
      triggerConfig: {
        type: 'special_event',
        specialEventId: uniqueId,
        isIncremental: true,
        step: 1,
      },
      createSpecialEventOption: false,
    });

    const newSE: SpecialEventDefinition = {
      id: uniqueId,
      name: cleanName,
      emoji: cleanEmoji,
      badgeId,
      badgeDescription: badge.description,
      badgeRequirement: badge.requirement,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    setSpecialEvents((prev) => {
      if (prev.some((se) => se.id === uniqueId)) return prev;
      return [...prev, newSE];
    });

    return newSE;
  };

  /**
   * Delete a custom special event (Admin)
   */
  const deleteSpecialEvent = async (eventId: string): Promise<void> => {
    const se = specialEvents.find((x) => x.id === eventId);
    if (!se || se.isDefault) return;
    setSpecialEvents((prev) => prev.filter((x) => x.id !== eventId));
    setBadges((prev) => prev.filter((b) => b.id !== se.badgeId));
    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'special_events', eventId));
        await deleteDoc(doc(db, 'badges', se.badgeId));
      } catch (e) {
        console.warn('Firebase SE delete error:', e);
      }
    }
  };

  /**
   * Switch the current active testing user by email
   */
  const switchCurrentUser = (email: string) => {
    setCurrentUserEmail(email.toLowerCase());
    setCurrentMemberId(email.toLowerCase());
  };

  /**
   * Toggle RSVP for a run (legacy support)
   */
  const toggleRSVP = async (runId: string) => {
    if (!currentUserEmail || currentMember.id === 'guest') return;
    setRuns((prevRuns) =>
      prevRuns.map((run) => {
        if (run.id !== runId) return run;

        const isAttending = run.attendees.some((a) => a.memberId === currentMember.id);
        let updatedAttendees;

        if (isAttending) {
          updatedAttendees = run.attendees.filter((a) => a.memberId !== currentMember.id);
        } else {
          updatedAttendees = [
            ...run.attendees,
            {
              memberId: currentMember.id,
              name: currentMember.name,
              checkedIn: false,
              rsvpDate: new Date().toISOString(),
            },
          ];
        }

        const updatedRun = { ...run, attendees: updatedAttendees };
        if (isFirebaseConfigured && db) {
          // Only touch our own attendee entry (rules reject any other change by runners).
          const mine = isAttending
            ? run.attendees.find((a) => a.memberId === currentMember.id)
            : updatedAttendees[updatedAttendees.length - 1];
          updateDoc(doc(db, 'runs', run.id), {
            attendees: isAttending ? arrayRemove(mine) : arrayUnion(mine),
          }).catch(console.error);
        }
        return updatedRun;
      })
    );
  };

  /**
   * Add a new scheduled run
   */
  const addRun = async (newRun: Omit<RunEvent, 'id' | 'attendees'>) => {
    const id = `run-${Date.now()}`;
    const run: RunEvent = {
      ...newRun,
      id,
      attendees: [
        {
          memberId: currentMember.id,
          name: currentMember.name,
          checkedIn: false,
          rsvpDate: new Date().toISOString(),
        },
      ],
    };

    if (isFirebaseConfigured && db) {
      await setDoc(doc(db, 'runs', id), cleanFirestoreData(run));
    }
    setRuns((prev) => [run, ...prev]);
    return run;
  };

  /**
   * Add a newly parsed GPX route
   */
  const addRoute = async (routeData: Omit<GPXRoute, 'id'>): Promise<GPXRoute> => {
    const id = `route-${Date.now()}`;
    const newRoute: GPXRoute = {
      ...routeData,
      id,
    };

    setRoutes((prev) => [newRoute, ...prev]);
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'routes', id), formatRouteForFirestore(newRoute));
      } catch (err) {
        console.error('Firebase save route error:', err);
      }
    }
    return newRoute;
  };

  /**
   * Update an existing route (Organizer / Admin)
   */
  const updateRoute = async (routeId: string, updates: Partial<GPXRoute>): Promise<GPXRoute> => {
    const existing = routes.find((r) => r.id === routeId);
    const updatedObj: GPXRoute = {
      ...(existing || ({} as GPXRoute)),
      ...updates,
      id: routeId,
      updatedAt: new Date().toISOString(),
    };

    setRoutes((prev) => prev.map((r) => (r.id === routeId ? updatedObj : r)));

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'routes', routeId), formatRouteForFirestore(updatedObj), { merge: true });
      } catch (err) {
        console.error('Firebase update route error:', err);
      }
    }
    return updatedObj;
  };

  /**
   * Delete an existing route (Organizer / Admin)
   */
  const deleteRoute = async (routeId: string): Promise<void> => {
    setRoutes((prev) => prev.filter((r) => r.id !== routeId));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'routes', routeId)).catch(console.error);
    }
  };

  /**
   * Update an existing run (Admin)
   */
  const updateRun = async (updatedRun: RunEvent) => {
    setRuns((prev) => prev.map((r) => (r.id === updatedRun.id ? updatedRun : r)));
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'runs', updatedRun.id), cleanFirestoreData(updatedRun), { merge: true }).catch(console.error);
    }
  };

  /**
   * Delete a run (Admin)
   */
  const deleteRun = async (runId: string) => {
    const ev = meetupEvents.find((e) => e.id === runId);
    if (isFirebaseConfigured && db) {
      const currentDb = db;
      await deleteDoc(doc(currentDb, 'runs', runId));
      // Remove its check-in event so the QR code can't open a deleted run.
      await deleteDoc(doc(currentDb, 'meetup_events', runId)).catch((err) => console.warn('Check-in event not removed:', err));
      if (ev?.codeWord) {
        await deleteDoc(doc(currentDb, 'meetup_codes', await codeKeyFor(ev.date, ev.codeWord))).catch(() => {});
      }
    }
    setRuns((prev) => prev.filter((r) => r.id !== runId));
    setMeetupEvents((prev) => prev.filter((e) => e.id !== runId));
  };

  /**
   * Update member stats or profile (Admin / Member)
   */
  const updateMemberStats = async (memberId: string, updates: Partial<Member>) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const updated = { ...m, ...updates };
        if (isFirebaseConfigured && db) {
          setDoc(doc(db, 'members', memberId), updated, { merge: true }).catch(console.error);
        }
        return updated;
      })
    );
  };

  /**
   * Send a club-wide push announcement (Admin)
   */
  const sendPushAnnouncement = async (title: string, body: string, targetRunId?: string) => {
    const notif: ClubNotification = {
      id: `notif-${Date.now()}`,
      title,
      body,
      timestamp: new Date().toISOString(),
      targetRunId,
      sender: currentMember.name,
    };

    storeNotification(notif);
    setNotifications((prev) => [notif, ...prev]);
    showLocalNotification(title, body);

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'settings', 'latest_announcement'), notif).catch(console.error);
    }
  };

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
    addRun,
    updateRun,
    deleteRun,
    updateMemberStats,
    sendPushAnnouncement,
    addRoute,
    updateRoute,
    deleteRoute,
    resetToDefaults,
    isSyncing,
    scheduleLoaded,
    isFirebaseConfigured,
  };
}
