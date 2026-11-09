import { useState, useEffect } from 'react';
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
import { memberKeyFor } from '../utils/memberKey';
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
    streak: 1,
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
    streak: 1,
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
function eventStart(date: string, time?: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  let hour = 18;
  let minute = 0;
  const match = (time || '').match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (match) {
    hour = parseInt(match[1], 10);
    minute = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
  }
  return new Date(y, m - 1, d, hour, minute);
}

/** Strip Firestore-only fields from a public meetup doc. The code word is never public. */
function meetupFromPublicDoc(data: any): MeetupEvent {
  const { checkInOpensAt: _o, checkInClosesAt: _c, ...rest } = data || {};
  return { ...rest, codeWord: '' } as MeetupEvent;
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
  const [runs, setRuns] = useState<RunEvent[]>(() => loadFromStorage(STORAGE_KEYS.RUNS, INITIAL_RUNS));
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
  const [meetupEvents, setMeetupEvents] = useState<MeetupEvent[]>(() => loadFromStorage(STORAGE_KEYS.MEETUP_EVENTS, INITIAL_MEETUP_EVENTS));
  const [checkins, setCheckins] = useState<CheckInRecord[]>(() => {
    const stored = loadFromStorage<CheckInRecord[]>(STORAGE_KEYS.CHECKINS, INITIAL_CHECKINS)
      .filter((c) => !REMOVED_TEST_EMAILS.has(c.userEmail.toLowerCase()));
    const existingIds = new Set(stored.map((c) => c.id));
    const missing = INITIAL_CHECKINS.filter((c) => !existingIds.has(c.id) && !REMOVED_TEST_EMAILS.has(c.userEmail.toLowerCase()));
    return [...stored, ...missing];
  });
  const [legacyMembers, setLegacyMembers] = useState<LegacyMember[]>(() => {
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
    saveToStorage(STORAGE_KEYS.LEGACY_MEMBERS, legacyMembers);
  }, [legacyMembers]);

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
        if (!runsSnap.empty) {
          const remoteRuns = runsSnap.docs.map((d) => d.data() as RunEvent);
          setRuns(remoteRuns);
        }

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
        if (!meetupsSnap.empty) {
          const remoteMeetups = meetupsSnap.docs.map((d) => meetupFromPublicDoc(d.data()));
          const remoteDates = new Set(remoteMeetups.map((m) => m.date));
          setMeetupEvents((prev) => {
            const localOnly = prev.filter((m) => !remoteDates.has(m.date));
            return [...remoteMeetups, ...localOnly];
          });
        }
      } catch (err) {
        console.warn('Firestore initial fetch skipped or failed:', err);
      } finally {
        setIsSyncing(false);
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
  const syncPrivateData = async (email: string, isStaff: boolean) => {
    if (!isFirebaseConfigured || !db) return;
    const currentDb = db;
    const cleanEmail = email.trim().toLowerCase();

    try {
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

      // Code words: read secrets, and migrate any code word still stored on the public doc.
      const secretsSnap = await getDocs(collection(currentDb, 'meetup_secrets'));
      const codeWords: Record<string, string> = {};
      secretsSnap.docs.forEach((d) => {
        const cw = d.data().codeWord;
        if (typeof cw === 'string') codeWords[d.id] = cw;
      });
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
      setMeetupEvents((prev) => prev.map((e) => (codeWords[e.date] ? { ...e, codeWord: codeWords[e.date] } : e)));

      // Make sure every profile has an up-to-date hashed leaderboard row.
      for (const u of remoteUsers) {
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

  /**
   * Search unclaimed legacy members by first and/or last name (flexible multi-word tokens)
   */
  const searchLegacyMatches = (nameQuery: string): LegacyMember[] => {
    if (!nameQuery || nameQuery.trim().length < 2) return [];
    const q = nameQuery.trim().toUpperCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    return legacyMembers.filter((m) => {
      if (m.claimedByEmail !== null) return false;
      const memName = m.name.toUpperCase();
      // Substring match
      if (memName.includes(q)) return true;
      // All tokens present in the name
      if (tokens.length > 1 && tokens.every((t) => memName.includes(t))) return true;
      // Any token with >= 3 chars present in the name
      if (tokens.some((t) => t.length >= 3 && memName.includes(t))) return true;
      return false;
    });
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
    claimedLegacyNames: string[] = []
  ): Promise<UserProfile> => {
    const cleanEmail = profileData.email.trim().toLowerCase();
    const displayName = `${profileData.firstName.trim()} ${profileData.lastName.trim()}`;

    // Find claimed legacy items
    const claimedRecords = legacyMembers.filter((m) =>
      claimedLegacyNames.some((cName) => cName.toUpperCase() === m.name.toUpperCase())
    );

    const legacyNewCount = claimedRecords.reduce((sum, r) => sum + r.newCount, 0);
    const legacyOldCount = claimedRecords.reduce((sum, r) => sum + r.oldCount, 0);
    const totalLegacyRuns = legacyNewCount + legacyOldCount;

    // Estimate initial legacy miles (~3.1 miles per legacy run)
    const initialMiles = Math.round(totalLegacyRuns * 3.1 * 10) / 10;

    const initialBadgeIds: string[] = [];
    const initialBadgeCounts: Record<string, number> = {};
    for (const b of badges) {
      const cfg = b.triggerConfig;
      if (cfg?.type === 'attendance' || b.id === 'first-chuck') {
        if (totalLegacyRuns >= 1) {
          initialBadgeIds.push(b.id);
          initialBadgeCounts[b.id] = 1;
        }
      } else if (cfg?.type === 'milestone' || b.category === 'milestone') {
        const req = cfg?.minTotalRuns || (b.id === 'milestone-5' ? 5 : b.id === 'milestone-50' ? 50 : b.id === 'milestone-100' ? 100 : b.id === 'milestone-200' ? 200 : 0);
        if (req > 0 && totalLegacyRuns >= req) {
          initialBadgeIds.push(b.id);
          const step = cfg?.step || req;
          initialBadgeCounts[b.id] = b.isIncremental ? Math.max(1, Math.floor(totalLegacyRuns / step)) : 1;
        }
      }
    }

    const effectiveAge = profileData.birthday
      ? calculateAge(profileData.birthday)
      : profileData.age;

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
      pre2021Runs: legacyOldCount,
      loggedRuns: legacyNewCount,
      totalRuns: totalLegacyRuns,
      totalMiles: initialMiles,
      runCount: totalLegacyRuns,
      walkCount: 0,
      petRunCount: 0,
      firstRunDate: totalLegacyRuns > 0 ? '2021-02-10' : new Date().toISOString().split('T')[0],
      linkedLegacyNames: claimedRecords.map((r) => r.name),
      unlockedBadgeIds: initialBadgeIds,
      badgeCounts: initialBadgeCounts,
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

    // Update legacy records to mark claimed
    const nowIso = new Date().toISOString();
    setLegacyMembers((prev) =>
      prev.map((m) =>
        claimedRecords.some((c) => c.name.toUpperCase() === m.name.toUpperCase())
          ? { ...m, claimedByEmail: cleanEmail, claimedAt: nowIso }
          : m
      )
    );

    setUsers((prev) => [newUser, ...prev.filter((u) => u.email.toLowerCase() !== cleanEmail)]);
    setMembers((prev) => [memberFromUser(newUser, memberKey), ...prev.filter((m) => m.id !== memberKey)]);

    setCurrentUserEmail(cleanEmail);
    setCurrentMemberId(memberKey);

    // New profiles never go through the returning-user path in App, so load
    // private data (and run the staff code-word migration) here as well.
    if (isFirebaseConfigured && db) {
      syncPrivateData(cleanEmail, newUser.role === 'admin' || newUser.role === 'organizer');
    }

    return newUser;
  };

  /**
   * Check in a runner to a scheduled meetup event
   */
  const checkInRunner = async (params: {
    eventDate: string;
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
    const { eventDate, userEmail, codeWordEntered, activity, distanceChoice, loops, withPet } = params;
    const cleanEmail = userEmail.trim().toLowerCase();

    // 1. Locate the event for exactly this date (never fall back to another night's event)
    const event = meetupEvents.find((e) => e.date === eventDate);
    if (!event) {
      return { success: false, message: 'No check-in event is scheduled for this date.' };
    }

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
    const checkinId = `${eventDate}_${cleanEmail}`;
    const existingCheckIn = checkins.find((c) => c.date === eventDate && c.userEmail.toLowerCase() === cleanEmail);
    const isUpdate = Boolean(existingCheckIn);

    const now = new Date();
    const nowIso = now.toISOString();
    const timeStr = now.toTimeString().split(' ')[0]; // "HH:MM:SS"

    const newCheckIn: CheckInRecord = {
      ...(existingCheckIn || {}),
      id: checkinId,
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
        if (badge.id === 'streak-4' && newTotalRuns >= 4) awardBadge(badge.id, Math.max(1, Math.floor(newTotalRuns / 4)));
        if (badge.id === 'streak-10' && newTotalRuns >= 10) awardBadge(badge.id, Math.max(1, Math.floor(newTotalRuns / 10)));
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
          const weeks = cfg.streakWeeks || 4;
          if (newTotalRuns >= weeks) {
            const mult = cfg.isIncremental ? Math.floor(newTotalRuns / weeks) : 1;
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
            ? "Check-in wasn't accepted. Double-check tonight's code word — check-in opens 2 hours before the run."
            : 'Could not reach the club server. Please check your connection and try again.',
        };
      }
    }

    // 9. Server accepted it (or local mode): update local state
    setCheckins((prev) => [
      newCheckIn,
      ...prev.filter((c) => !(c.date === eventDate && c.userEmail.toLowerCase() === cleanEmail)),
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
    setMeetupEvents((prev) => {
      const exists = prev.some((e) => e.date === event.date);
      if (exists) {
        return prev.map((e) => (e.date === event.date ? event : e));
      }
      return [event, ...prev];
    });
    if (isFirebaseConfigured && db) {
      // Public doc: everything except the code word, plus the check-in window the rules enforce
      // (opens 2 hours before the start, closes at midnight).
      const { codeWord, ...publicEvent } = event;
      const start = eventStart(event.date, event.time);
      const opensAt = new Date(start.getTime() - 2 * 60 * 60 * 1000);
      const closesAt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59);
      try {
        await setDoc(
          doc(db, 'meetup_events', event.date),
          {
            ...cleanFirestoreData(publicEvent),
            codeWord: deleteField(),
            checkInOpensAt: Timestamp.fromDate(opensAt),
            checkInClosesAt: Timestamp.fromDate(closesAt),
          },
          { merge: true }
        );
        const cleanCodeWord = (codeWord || '').trim().toUpperCase();
        if (cleanCodeWord) {
          await setDoc(doc(db, 'meetup_secrets', event.date), { codeWord: cleanCodeWord });
        }
      } catch (err) {
        console.error('Failed to save meetup event:', err);
      }
    }
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

    setRuns((prev) => [run, ...prev]);
    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'runs', id), cleanFirestoreData(run)).catch(console.error);
    }
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
    setRuns((prev) => prev.filter((r) => r.id !== runId));
    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'runs', runId)).catch(console.error);
    }
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
    isFirebaseConfigured,
  };
}
