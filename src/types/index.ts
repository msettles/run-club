export type SurfaceType = 'Trail' | 'Pavement' | 'Mixed' | 'Track';
export type DifficultyType = 'Easy' | 'Moderate' | 'Challenging';
export type ActivityType = 'running' | 'walking';
export type DistanceTier = 1 | 3 | 5;

export interface PaceGroup {
  label: string;
  targetPace: string; // e.g. "8:00 - 8:30 /mi"
  leadRunner?: string;
  notes?: string;
}

export interface GPXPoint {
  lat: number;
  lon: number;
  ele?: number; // in meters
  time?: string;
}

export interface GPXRoute {
  id: string;
  name: string;
  description: string;
  distanceMiles: number;
  elevationGainFt: number;
  points: GPXPoint[];
  surface: SurfaceType;
  difficulty: DifficultyType;
  gpxXml?: string;
  createdAt: string;
  thumbnailUrl?: string;
}

export interface Attendee {
  memberId: string;
  name: string;
  checkedIn: boolean;
  checkedInAt?: string;
  rsvpDate: string;
}

export interface RunEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // "06:00 PM"
  locationName: string;
  meetingCoordinates?: { lat: number; lon: number };
  address: string;
  distanceMiles: number;
  surface: SurfaceType;
  elevationGainFt: number;
  description: string;
  routeId?: string;
  paceGroups: PaceGroup[];
  attendees: Attendee[];
  organizerName: string;
  completed?: boolean;
  specialEvent?: SpecialEventType;
}

export type SpecialEventType = string; // 'none' | 'turkey_trot' | 'halloween' | 'anniversary' | custom slug

export interface SpecialEventDefinition {
  id: string; // e.g. "turkey_trot", "halloween", "anniversary", "st_patricks"
  name: string; // e.g. "Turkey Trot", "St. Patrick's Day Run"
  emoji: string; // e.g. "🦃", "🍀"
  badgeId: string; // e.g. "special-turkey", "special-st_patricks"
  badgeDescription?: string;
  badgeRequirement?: string;
  isDefault?: boolean;
  createdAt?: string;
}

export type BadgeCategory = 
  | 'milestone' 
  | 'walking' 
  | 'streak' 
  | 'special_event' 
  | 'attendance'
  | 'activity'
  | 'distance';

export type BadgeTriggerType =
  | 'milestone'      // Total runs milestone (5, 25, 50, 100, etc.)
  | 'activity'       // Walk or Run count
  | 'distance'       // 1, 3, or 5 mile routes completed
  | 'special_event'  // Event marked as special event
  | 'streak'         // Consecutive attendance streak
  | 'attendance';    // General attendance (e.g. first run)

export interface BadgeTriggerConfig {
  type: BadgeTriggerType;
  // Milestone:
  minTotalRuns?: number;
  reward?: string;
  perks?: string;
  // Activity (walk/run):
  activityType?: ActivityType; // 'walking' | 'running'
  activityCount?: number;
  // Distance:
  distanceTier?: DistanceTier; // 1 | 3 | 5
  distanceCount?: number;
  // Special Event:
  specialEventId?: string;
  // Streak:
  streakWeeks?: number;
  // Incremental multiplier:
  isIncremental?: boolean;
  step?: number; // Level up every N (e.g. 10 walks)
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requirement: string;
  category?: BadgeCategory;
  isIncremental?: boolean; // Can be leveled up or earned multiple times (e.g. x2, x3)
  triggerConfig?: BadgeTriggerConfig;
  isDefault?: boolean;
  createdAt?: string;
}

// -------------------------------------------------------------
// NEW RELATIONAL RUN CLUB SCHEMA
// -------------------------------------------------------------

export interface RouteOption {
  name: string;
  actualMiles: number; // Measured GPS/map distance (e.g. 1.15, 3.22, 5.12)
  routeUrl?: string;   // Strava / Garmin / Apple Watch link
  imageUrl?: string;   // Route preview image / map screenshot
  directions?: string; // Step-by-step turn directions
}

export interface MeetupEvent {
  id: string;          // Usually date "YYYY-MM-DD"
  date: string;        // "2026-11-11"
  time?: string;       // "06:00 PM"
  title: string;       // e.g. "Thanksgiving Warmup Run"
  codeWord: string;    // Case-insensitive, e.g. "TURKEY"
  specialEvent?: SpecialEventType; // "IS Special Event" dropdown (Turkey Trot, Halloween, Anniversary)
  activeDistances: ('1' | '3' | '5')[]; // Which distances are active tonight
  routes: {
    '1'?: RouteOption;
    '3'?: RouteOption;
    '5'?: RouteOption;
  };
  notes?: string;
}

export interface CheckInRecord {
  id: string;                // e.g. "2026-11-11_matt.settles@example.com"
  date: string;              // YYYY-MM-DD
  time: string;              // HH:MM:SS
  userEmail: string;         // Foreign key to UserProfile.email
  runnerName?: string;       // Display cache
  activity: ActivityType;    // 'running' | 'walking'
  distanceChoice: DistanceTier; // 1 | 3 | 5
  actualMiles: number;       // Actual route distance (e.g. 3.22)
  routeName?: string;        // Name of route (e.g. "Heritage Park Loop")
  source: 'pwa' | 'admin' | 'legacy_import';
  createdAt: string;         // ISO timestamp
}

export interface UserProfile {
  email: string;             // Primary Key (lowercase)
  firstName: string;
  lastName: string;
  displayName: string;
  shirtSize: 'Youth' | 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | string;
  age?: number;
  city?: string;
  zipCode?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  preferredPace?: string;
  // Attendance & Miles
  pre2021Runs: number;       // From pre-2021 OldCounts
  loggedRuns: number;        // From individual checkin records
  totalRuns: number;         // pre2021Runs + loggedRuns
  totalMiles: number;        // Cumulative miles walked + run
  runCount: number;          // Total times ran
  walkCount: number;         // Total times walked
  distanceCounts?: { '1'?: number; '3'?: number; '5'?: number }; // Route choices count
  firstRunDate?: string;     // Earliest recorded check-in date
  // Legacy Link
  linkedLegacyNames: string[]; // Claimed historical names (e.g. ["MATT SETTLES"])
  unlockedBadgeIds: string[];
  badgeCounts?: Record<string, number>; // How many times each badge was achieved (e.g. { 'special-turkey': 2, 'power-walker': 3 })
  role: 'member' | 'organizer' | 'admin' | 'guest';
  createdAt: string;
}

export interface LegacyMember {
  id: string;                // Normalized name or unique ID
  name: string;              // Exact legacy roster name
  newCount: number;          // From 2021-2026 log (sum is 6,263)
  oldCount: number;          // Pre-2021 count (sum is 2,473)
  totalRuns: number;         // newCount + oldCount
  claimedByEmail: string | null; // Null until runner claims it
  claimedAt: string | null;
}

// Retain Member interface for backwards-compatibility with existing views
export type Member = UserProfile & {
  id: string;
  name: string;
  streak: number;
  favoritePace: string;
  joinedDate: string;
  avatarUrl?: string;
};

export interface MilestoneReward {
  runsRequired: number; // 5, 50, 100, 200
  name: string;
  reward: string;
  perks: string;
  icon: string;
  imagePlaceholder?: string;
  description: string;
}

export interface MilestoneAlert {
  id: string;
  userEmail: string;
  runnerName: string;
  shirtSize: string;
  milestoneRuns: number; // 5, 50, 100, 200
  milestoneName: string;
  reward: string;
  perks: string;
  date: string;
  time: string;
  fulfilled: boolean; // Has organizer handed them their shirt/hat/mug/bottle?
  fulfilledAt?: string;
  fulfilledBy?: string;
}

export interface CheckInPayload {
  runId: string;
  memberId: string;
  memberName: string;
}
