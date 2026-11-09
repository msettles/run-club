export type SurfaceType = 'Trail' | 'Pavement' | 'Mixed' | 'Track';
export type DifficultyType = 'Easy' | 'Moderate' | 'Challenging';
export type ActivityType = 'running' | 'walking';
export type DistanceChoice = number | string; // Chosen run distance (rounded to 1 decimal point e.g. 1.2, 3.1, 5.2)
export type DistanceTier = DistanceChoice; // Backwards-compatible alias

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

export interface RouteTurnStep {
  step: number;
  cue: string;                // "START", "L", "R", "Slight R", "Sharp L", "CONT", "U-turn", "FINISH"
  instruction: string;        // Narrative: "Turn left onto 3rd Street, heading north"
  instruction_concise: string;// Mobile cue: "L on 3rd St"
  street: string;
  street_concise?: string;
  distance_m: number;
  distance: string;           // "0.45 mi" or "164 ft"
  heading_cardinal?: string;  // "N", "E", "S", "W", "NE", etc.
  turn_degrees?: number | null;
  at_km: number;
  point: [number, number];    // [lon, lat] for map pins
  coordinates?: [number, number][]; // Line segment coordinates
  crosses?: string[];
  crosses_concise?: string[];
  customNotes?: string;       // Custom organizer note for this turn
}

export interface RouteExternalLinks {
  stravaUrl?: string;         // e.g. "https://www.strava.com/routes/..."
  garminUrl?: string;         // e.g. "https://connect.garmin.com/modern/course/..."
  rungoUrl?: string;          // e.g. "https://routes.rungoapp.com/route/..."
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
  customDistanceLabel?: string; // Optional label (e.g. "10K", "6-Mile Run")
  isLoop?: boolean;           // Whether route can be repeated for multiple laps/loops (e.g. The 1, 2, 3)
  maxLoops?: number;          // Default max loop options to offer at check-in (e.g. 4)
  directions?: RouteTurnStep[];
  geoJson?: any;              // GeoJSON FeatureCollection with line track and turn points
  externalLinks?: RouteExternalLinks;
  notes?: string;             // Safety / hazards / parking notes
  gpxXml?: string;
  createdAt: string;
  updatedAt?: string;
  thumbnailUrl?: string;
}

export interface Attendee {
  memberId: string;
  name: string;
  checkedIn: boolean;
  checkedInAt?: string;
  rsvpDate: string;
}

/** One distance option on a scheduled run, pointing at a route in the library. */
export interface RunRouteChoice {
  routeId: string;
  customLabel?: string;
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
  routeId?: string;              // Legacy single route (first choice is mirrored here)
  routeChoices?: RunRouteChoice[]; // Distance options runners pick from at check-in
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
  | 'distance'
  | 'pet';

export type BadgeTriggerType =
  | 'milestone'      // Total runs milestone (5, 25, 50, 100, etc.)
  | 'activity'       // Walk or Run count
  | 'distance'       // 1, 3, or 5 mile routes completed
  | 'special_event'  // Event marked as special event
  | 'streak'         // Consecutive attendance streak
  | 'pet'            // Running or walking with a pet
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
  distanceChoice?: DistanceChoice;
  distanceTier?: DistanceTier; // Deprecated alias
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
  maxMultiplier?: number; // e.g. 10 (renders as 10+)
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
  baseMiles?: number;  // Base single-loop distance if isLoop is true
  isLoop?: boolean;    // Whether this option supports multi-lap / loop multiplier
  maxLoops?: number;   // Preset loop count options to render (default: 4)
  routeUrl?: string;   // Strava / Garmin / Apple Watch link
  imageUrl?: string;   // Route preview image / map screenshot
  directions?: string; // Legacy string / summary
  routeId?: string;    // Reference to GPXRoute in library
  externalLinks?: RouteExternalLinks;
  directionsList?: RouteTurnStep[];
  geoJson?: any;
}

export interface MeetupEvent {
  id: string;          // The run's ID (one check-in event per run)
  runId?: string;      // Same as id; stored explicitly on Firestore docs
  date: string;        // "2026-11-11"
  time?: string;       // "06:00 PM"
  title: string;       // e.g. "Thanksgiving Warmup Run"
  codeWord: string;    // Case-insensitive, e.g. "TURKEY"
  specialEvent?: SpecialEventType; // "IS Special Event" dropdown (Turkey Trot, Halloween, Anniversary)
  activeDistances: string[]; // Which distances / route choice keys are active tonight
  routes: Record<string, RouteOption>;
  notes?: string;
  codeWordSet?: boolean;    // false while the run has no code word yet (not live: hidden from runners and the QR code)
  checkInOpensAt?: string;  // ISO; 2 hours before start (enforced by the rules)
  checkInClosesAt?: string; // ISO; 11:59:59 PM on the event date
}

export interface CheckInRecord {
  id: string;                // `${runId}_${email}`: one check-in per runner per run
  runId?: string;            // The run checked into (missing only on old local sample data)
  date: string;              // YYYY-MM-DD
  time: string;              // HH:MM:SS
  userEmail: string;         // Foreign key to UserProfile.email
  runnerName?: string;       // Display cache
  activity: ActivityType;    // 'running' | 'walking'
  distanceChoice: DistanceTier; // 1 | 3 | 5 or route key
  actualMiles: number;       // Actual route distance credited (e.g. 3.22, or 1.22 * 4 loops)
  routeName?: string;        // Name of route (e.g. "The 123 (4 Loops)")
  loops?: number;            // Number of loops chosen if loop route (e.g. 1, 2, 3, 4+)
  withPet?: boolean;         // Checked if runner/walker brought a pet
  source: 'pwa' | 'admin' | 'legacy_import';
  createdAt: string;         // ISO timestamp
  updatedAt?: string;        // ISO timestamp of the last edit (required by Firestore rules)
  codeWord?: string;         // Code word the runner entered (verified by Firestore rules)
}

export interface UserProfile {
  email: string;             // Primary Key (lowercase)
  firstName: string;
  lastName: string;
  displayName: string;
  shirtSize: 'Youth' | 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | string;
  birthday?: string;         // YYYY-MM-DD birthdate
  age?: number;              // Computed from birthday
  city?: string;
  zipCode?: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  preferredPace?: string;
  // Attendance & Miles
  pre2021Runs: number;       // Sum of claimed legacy names' pre-2021 OldCounts
  legacyEventRuns?: number;  // Sum of claimed legacy names' sign-ins since 2021
  loggedRuns: number;        // Check-ins in this app
  totalRuns: number;         // pre2021Runs + legacyEventRuns + loggedRuns
  totalMiles: number;        // Cumulative miles walked + run
  runCount: number;          // Total times ran
  walkCount: number;         // Total times walked
  petRunCount?: number;      // Total runs/walks with a pet
  distanceCounts?: Record<string, number>; // Route choices count (e.g. { '1': 4, '3': 10, '5': 2 })
  firstRunDate?: string;     // Earliest recorded check-in date
  lastCheckInDate?: string;  // Date of the check-in that last changed these stats
  lastCheckInRunId?: string; // Run of that check-in (the rules use it to verify the stats change)
  currentStreakWeeks?: number; // Consecutive weeks with a run, ending this or last week
  longestStreakWeeks?: number; // Longest run of consecutive weeks (legacy + app)
  // Legacy Link
  linkedLegacyNames: string[]; // Claimed historical names (e.g. ["MATT SETTLES"])
  linkedLegacyIds?: string[];  // IDs of claimed legacy_profiles docs
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
  claimedBy?: string | null;     // memberKey of the claimer (Firestore). Null until claimed
  claimedByEmail: string | null; // Derived for display from loaded profiles
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
  runId?: string;     // The run whose check-in reached the milestone
  fulfilled: boolean; // Has organizer handed them their shirt/hat/mug/bottle?
  fulfilledAt?: string;
  fulfilledBy?: string;
}
