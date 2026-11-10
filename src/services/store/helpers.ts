/** Plain helpers for the club store: Firestore mapping and browser storage. */
import { 
  GPXRoute, 
  Member, 
  UserProfile,
  MeetupEvent,
} from '../../types';
import { 
  GUEST_USER
} from '../../data/catalog';
import { localYmd } from '../../utils/dateUtils';

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
  // The raw GPX file isn't stored: it can be bigger than Firestore's 1 MiB document
  // limit, and downloads rebuild it from the points (see downloadGPXFile).
  const { gpxXml: _gpx, detailsLoaded: _loaded, ...rest } = route;
  const cleaned = cleanFirestoreData(rest);
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

/** Firestore's document limit is 1 MiB; leave room for field overhead. */
const MAX_ROUTE_DOC_BYTES = 900 * 1024;

/** Throw a readable error if a formatted route is too big to save as one document. */
export function assertRouteFitsFirestore(formatted: unknown): void {
  const bytes = new TextEncoder().encode(JSON.stringify(formatted)).length;
  if (bytes > MAX_ROUTE_DOC_BYTES) {
    throw Object.assign(
      new Error(`This route is too detailed to save (${Math.round(bytes / 1024)} KB; the limit is about 900 KB). Try a GPX file with fewer track points.`),
      { code: 'route-too-large' }
    );
  }
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
    isLoop: data.isLoop === true,
    maxLoops: data.maxLoops || 4,
    directions: Array.isArray(directions) ? directions : [],
    geoJson: geoJson || null,
  } as GPXRoute;
}

export const STORAGE_KEYS = {
  RUNS: 'woodchuckers_runs_v1',
  ROUTES: 'woodchuckers_routes_v1',
  MEMBERS: 'woodchuckers_members_v1',
  CURRENT_USER_ID: 'woodchuckers_current_user_id_v1', // no longer used; listed so old copies get cleared
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
export function loadFromStorage<T>(key: string, fallback: T): T {
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
    streakProofWeek: user.streakProofWeek,
    favoritePace: user.preferredPace || '9:00 min/mi',
    unlockedBadgeIds: user.unlockedBadgeIds,
    badgeCounts: user.badgeCounts,
    joinedDate: user.firstRunDate || user.createdAt.split('T')[0],
    // Lets the leaderboard drop a streak that has lapsed since the last check-in.
    lastCheckInDate: user.lastCheckInDate,
  });
}

/** Staff load this many days of check-ins for the Check-In Log. */
export const RECENT_CHECKIN_DAYS = 60;
export function recentCheckinCutoff(): string {
  return localYmd(new Date(Date.now() - RECENT_CHECKIN_DAYS * 86400e3));
}

/** Local (in-app) Member record for a profile, keyed by memberKey. */
export function memberFromUser(user: UserProfile, memberKey: string, publicOnly = false): Member {
  if (publicOnly) return memberFromPublicDoc(toPublicMember(user, memberKey));
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
export function memberFromPublicDoc(data: any): Member {
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

/** Strip Firestore-only fields from a public meetup doc. The code word is never public. */
export function meetupFromPublicDoc(data: any): MeetupEvent {
  const { checkInOpensAt, checkInClosesAt, ...rest } = data || {};
  const iso = (t: any): string | undefined =>
    t && typeof t.toDate === 'function' ? t.toDate().toISOString() : typeof t === 'string' ? t : undefined;
  return { ...rest, codeWord: '', checkInOpensAt: iso(checkInOpensAt), checkInClosesAt: iso(checkInClosesAt) } as MeetupEvent;
}

export function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving key ${key} to storage:`, e);
  }
}

/** Leave room for Firestore field overhead before starting a multi-document save. */
export function assertDocumentFitsFirestore(value: unknown, label: string): void {
  if (new TextEncoder().encode(JSON.stringify(cleanFirestoreData(value))).length > 900 * 1024) {
    throw new Error(`${label} is too large to save. Reduce the amount of data before trying again.`);
  }
}
