import { 
  GPXRoute, 
  RunEvent, 
  Member, 
  MeetupEvent, 
  CheckInRecord, 
  LegacyMember, 
  UserProfile,
  MilestoneAlert,
} from '../types';
import { THE_123_ROUTE } from './the123Route';
import { WOODCHUCKER_OPERA_1_MILE, WOODCHUCKER_OPERA_3_MILE, ROAD_TO_EL_DORADO_1_MILE } from './operaRoutes';

// Center anchor: Woodland area coordinates (Woodland, CA approx 38.678, -121.773)
const BASE_LAT = 38.6780;
const BASE_LON = -121.7733;

function generateLoopPoints(
  centerLat: number,
  centerLon: number,
  radiusMiles: number,
  steps: number,
  baseEleMeters: number,
  eleVariationMeters: number
) {
  const points = [];
  const latScale = radiusMiles / 69.0;
  const lonScale = radiusMiles / (69.0 * Math.cos((centerLat * Math.PI) / 180));

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const wiggle = Math.sin(angle * 4) * 0.15 + Math.cos(angle * 2) * 0.1;
    const r = 1 + wiggle;

    const lat = centerLat + Math.sin(angle) * latScale * r;
    const lon = centerLon + Math.cos(angle) * lonScale * r;
    const ele = Math.round(baseEleMeters + (Math.sin(angle * 2) + 1) * 0.5 * eleVariationMeters);

    points.push({
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      ele,
    });
  }
  return points;
}

export { INITIAL_BADGES, INITIAL_SPECIAL_EVENTS, CLUB_MILESTONES, GUEST_USER } from './catalog';

export const INITIAL_MILESTONE_ALERTS: MilestoneAlert[] = [
  {
    id: 'alert-sarah-5',
    userEmail: 'sarah.runner@example.com',
    runnerName: 'Sarah Connor',
    shirtSize: 'S',
    milestoneRuns: 5,
    milestoneName: '5 Runs Milestone',
    reward: 'Official Woodchucker Member Shirt',
    perks: '$1 off beers at Blue Note on run nights',
    date: '2026-11-04',
    time: '18:40:02',
    fulfilled: false,
  },
];

export const INITIAL_ROUTES: GPXRoute[] = [
  THE_123_ROUTE,
  WOODCHUCKER_OPERA_1_MILE,
  WOODCHUCKER_OPERA_3_MILE,
  ROAD_TO_EL_DORADO_1_MILE,
  {
    id: 'route-river-loop',
    name: 'Woodchuck Burrow River Loop',
    description: 'Our signature weekend club loop! Shaded singletrack along the creek with packed dirt trails and scenic river views.',
    distanceMiles: 5.2,
    elevationGainFt: 240,
    surface: 'Trail',
    difficulty: 'Moderate',
    points: generateLoopPoints(BASE_LAT, BASE_LON, 0.85, 48, 22, 28),
    externalLinks: {
      stravaUrl: 'https://www.strava.com/routes/3081829424823901',
      garminUrl: 'https://connect.garmin.com/modern/course/12345678',
      rungoUrl: 'https://routes.rungoapp.com/route/woodland-river',
    },
    createdAt: '2026-03-01T12:00:00Z',
  },
  {
    id: 'route-5k-sprint',
    name: 'Pine Ridge & Acorn 5K Dash',
    description: 'Fast, flat, and beginner-friendly! Paved park pathways with a wide lane, perfect for Tuesday speed workouts and social recovery runs.',
    distanceMiles: 3.1,
    elevationGainFt: 85,
    surface: 'Pavement',
    difficulty: 'Easy',
    points: generateLoopPoints(BASE_LAT, BASE_LON, 0.5, 36, 18, 12),
    externalLinks: {
      stravaUrl: 'https://www.strava.com/routes/31203',
      garminUrl: 'https://connect.garmin.com/modern/course/12345679',
      rungoUrl: 'https://routes.rungoapp.com/route/woodland-5k',
    },
    createdAt: '2026-03-01T12:00:00Z',
  },
  {
    id: 'route-timberline',
    name: 'Timberline Elevation Challenge',
    description: 'Hill repeats and elevation training. Rewarding summit views of the entire valley with a steady climb.',
    distanceMiles: 8.4,
    elevationGainFt: 780,
    surface: 'Mixed',
    difficulty: 'Challenging',
    points: generateLoopPoints(BASE_LAT, BASE_LON, 1.35, 64, 25, 85),
    externalLinks: {
      stravaUrl: 'https://www.strava.com/routes/31205',
      garminUrl: 'https://connect.garmin.com/modern/course/12345680',
      rungoUrl: 'https://routes.rungoapp.com/route/woodland-timberline',
    },
    createdAt: '2026-03-01T12:00:00Z',
  },
];

// -------------------------------------------------------------
// DUMMY TESTING DATA FOR RELATIONAL RUN CLUB
// -------------------------------------------------------------

// Sample legacy (old app) names for offline/local mode only.
// Real legacy data is imported by an admin from the old app's CSV exports
// (Admin → Runners & Claims) and lives in Firestore, never in this repo.
export const INITIAL_LEGACY_MEMBERS: LegacyMember[] = [
  {
    id: 'sample-runner',
    name: 'SAMPLE RUNNER',
    newCount: 30,
    oldCount: 12,
    totalRuns: 42,
    claimedBy: null,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'sample-runer',
    name: 'SAMPLE RUNER',
    newCount: 2,
    oldCount: 0,
    totalRuns: 2,
    claimedBy: null,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'sample-r-runner',
    name: 'SAMPLE R RUNNER',
    newCount: 0,
    oldCount: 3,
    totalRuns: 3,
    claimedBy: null,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'jordan-example',
    name: 'JORDAN EXAMPLE',
    newCount: 55,
    oldCount: 40,
    totalRuns: 95,
    claimedBy: null,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'jordan-exampel',
    name: 'JORDAN EXAMPEL',
    newCount: 1,
    oldCount: 0,
    totalRuns: 1,
    claimedBy: null,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'casey-placeholder',
    name: 'CASEY PLACEHOLDER',
    newCount: 8,
    oldCount: 0,
    totalRuns: 8,
    claimedBy: null,
    claimedByEmail: null,
    claimedAt: null,
  },
];

// Default Unauthenticated / Guest User Profile
// Official Member Profiles (Keyed on Email)
export const INITIAL_USERS: UserProfile[] = [
  {
    email: 'woodlandwoodchuckers@gmail.com',
    firstName: 'Woodchuck',
    lastName: 'Admin',
    displayName: 'Woodchuck Admin',
    shirtSize: 'M',
    city: 'Woodland',
    zipCode: '95695',
    preferredPace: '8:30 - 9:45 /mi',
    pre2021Runs: 0,
    loggedRuns: 0,
    totalRuns: 0,
    totalMiles: 0,
    runCount: 0,
    walkCount: 0,
    firstRunDate: '2021-02-03',
    linkedLegacyNames: [],
    unlockedBadgeIds: [],
    badgeCounts: {},
    role: 'admin',
    createdAt: '2021-02-03T18:00:00Z',
  },
];

// Dummy Scheduled Meetup Events
export const INITIAL_MEETUP_EVENTS: MeetupEvent[] = [
  {
    id: '2026-11-11',
    date: '2026-11-11',
    time: '06:00 PM',
    title: 'Wednesday Turkey Warmup & Social Stride',
    codeWord: 'TURKEY',
    specialEvent: 'turkey_trot',
    activeDistances: ['1.2', '3.2', '5.1'],
    routes: {
      '1.2': {
        name: 'Downtown Blue Note Stroll',
        actualMiles: 1.15,
        routeUrl: 'https://www.strava.com/routes/31201',
        externalLinks: {
          stravaUrl: 'https://www.strava.com/routes/31201',
          garminUrl: 'https://connect.garmin.com/modern/course/12345678',
          rungoUrl: 'https://routes.rungoapp.com/route/woodland-123',
        },
        directions: 'Start at Blue Note Brewing heading East on Main St. Turn Right on 2nd St, loop down to Court St, and back to the brewery patio.',
      },
      '3.2': {
        name: 'Heritage Park Greenbelt Loop',
        actualMiles: 3.22,
        routeUrl: 'https://www.strava.com/routes/31203',
        externalLinks: {
          stravaUrl: 'https://www.strava.com/routes/31203',
          garminUrl: 'https://connect.garmin.com/modern/course/12345679',
          rungoUrl: 'https://routes.rungoapp.com/route/woodland-heritage',
        },
        directions: 'East on Main St, Left on 3rd St, cut through Heritage Park greenbelt trail, return West via Court St back to Blue Note.',
      },
      '5.1': {
        name: 'Spring Lake Trek',
        actualMiles: 5.12,
        routeUrl: 'https://www.strava.com/routes/31205',
        externalLinks: {
          stravaUrl: 'https://www.strava.com/routes/31205',
          garminUrl: 'https://connect.garmin.com/modern/course/12345680',
          rungoUrl: 'https://routes.rungoapp.com/route/woodland-springlake',
        },
        directions: 'South on East St to Farmers Central Rd, complete perimeter loop of Spring Lake Park, and return North via 6th St.',
      },
      '1': {
        name: 'Downtown Blue Note Stroll',
        actualMiles: 1.15,
        routeUrl: 'https://www.strava.com/routes/31201',
        externalLinks: {
          stravaUrl: 'https://www.strava.com/routes/31201',
          garminUrl: 'https://connect.garmin.com/modern/course/12345678',
          rungoUrl: 'https://routes.rungoapp.com/route/woodland-123',
        },
      },
      '3': {
        name: 'Heritage Park Greenbelt Loop',
        actualMiles: 3.22,
        routeUrl: 'https://www.strava.com/routes/31203',
        externalLinks: {
          stravaUrl: 'https://www.strava.com/routes/31203',
          garminUrl: 'https://connect.garmin.com/modern/course/12345679',
          rungoUrl: 'https://routes.rungoapp.com/route/woodland-heritage',
        },
      },
      '5': {
        name: 'Spring Lake Trek',
        actualMiles: 5.12,
        routeUrl: 'https://www.strava.com/routes/31205',
        externalLinks: {
          stravaUrl: 'https://www.strava.com/routes/31205',
          garminUrl: 'https://connect.garmin.com/modern/course/12345680',
          rungoUrl: 'https://routes.rungoapp.com/route/woodland-springlake',
        },
      },
    },
    notes: 'Thanksgiving warm-up run! Wear orange or brown for extra festive cheer.',
  },
  {
    id: '2026-11-04',
    date: '2026-11-04',
    time: '06:00 PM',
    title: 'Wednesday Autumn Leaves Run',
    codeWord: 'FALLFOLIAGE',
    activeDistances: ['3.1', '5.1'],
    routes: {
      '3.1': {
        name: 'Historic Cemetery Perimeter',
        actualMiles: 3.08,
        routeUrl: 'https://www.strava.com/routes/31202',
        directions: 'West on Court St to historic Woodland Cemetery, perimeter trail loop, and return East along Main St.',
      },
      '5.1': {
        name: 'Woodland Sports Park Out & Back',
        actualMiles: 5.05,
        routeUrl: 'https://www.strava.com/routes/31204',
        directions: 'West on Main St to Sports Park Dr, loop softball complex trails, and return on Court St.',
      },
      '3': {
        name: 'Historic Cemetery Perimeter',
        actualMiles: 3.08,
        routeUrl: 'https://www.strava.com/routes/31202',
      },
      '5': {
        name: 'Woodland Sports Park Out & Back',
        actualMiles: 5.05,
        routeUrl: 'https://www.strava.com/routes/31204',
      },
    },
  },
];

// Verified Historical Check-In Records (Event Log)
export const INITIAL_CHECKINS: CheckInRecord[] = [];

// Helper to convert UserProfile to Member for backwards UI compatibility
export const INITIAL_MEMBERS: Member[] = INITIAL_USERS.map((u) => ({
  ...u,
  id: u.email,
  name: u.displayName,
  streak: 0,
  favoritePace: u.preferredPace || '8:45 min/mi',
  joinedDate: u.firstRunDate || '2021-02-10',
  avatarUrl: undefined,
}));

// Classic Schedule Runs for the Schedule Tab
export const INITIAL_RUNS: RunEvent[] = [
  {
    id: 'run-upcoming-wednesday',
    title: 'Wednesday Turkey Warmup & Social Stride',
    date: '2026-11-11',
    time: '06:00 PM',
    specialEvent: 'turkey_trot',
    locationName: 'Blue Note Brewing Company',
    address: '750 Dead Cat Alley, Woodland, CA 95695',
    distanceMiles: 3.22,
    surface: 'Pavement',
    elevationGainFt: 25,
    routeId: 'route-5k-sprint',
    description: 'Weekly club flagship Wednesday night run! 1-mile, 3-mile, and 5-mile options. Meet on the brewery patio.',
    organizerName: 'Woodland Woodchuckers',
    paceGroups: [
      { label: 'Fast Chucks', targetPace: '7:30 - 8:15 /mi' },
      { label: 'Steady Burrows', targetPace: '8:45 - 9:30 /mi' },
      { label: 'Cruiser Paws', targetPace: '9:45 - 10:30 /mi' },
      { label: 'Walking Pack', targetPace: 'Social Walking Pace' },
    ],
    attendees: [
      { memberId: 'sarah.runner@example.com', name: 'Sarah Connor', checkedIn: false, rsvpDate: '2026-11-05' },
    ],
  },
];
