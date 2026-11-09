import { 
  GPXRoute, 
  RunEvent, 
  Member, 
  Badge, 
  MeetupEvent, 
  CheckInRecord, 
  LegacyMember, 
  UserProfile,
  MilestoneReward,
  MilestoneAlert,
  SpecialEventDefinition
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

export const INITIAL_BADGES: Badge[] = [
  {
    id: 'first-chuck',
    name: 'First Chuck',
    emoji: '🦫',
    description: 'Checked into your very first Woodland Woodchuckers group run!',
    requirement: '1st group run attendance',
    category: 'attendance',
    isIncremental: false,
    isDefault: true,
    triggerConfig: {
      type: 'attendance',
    },
  },
  {
    id: 'milestone-5',
    name: '5-Run Member Shirt',
    emoji: '👕',
    description: 'Earned your official Woodchucker club shirt & $1 off draft beers at Blue Note Brewing on run nights!',
    requirement: '5 group runs (Official Shirt + $1 Off Beers)',
    category: 'milestone',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'milestone',
      minTotalRuns: 5,
      reward: 'Official Woodchucker Member Shirt',
      perks: '$1 off draft beers at Blue Note Brewing on run nights',
      isIncremental: true,
      step: 5,
    },
  },
  {
    id: 'milestone-50',
    name: '50-Run Hat Club',
    emoji: '🧢',
    description: 'Hit 50 group runs with the crew and earned the official Woodchucker running cap or beanie!',
    requirement: '50 group runs (Running Hat)',
    category: 'milestone',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'milestone',
      minTotalRuns: 50,
      reward: 'Woodchucker Running Hat',
      perks: 'Official Club Headwear',
      isIncremental: true,
      step: 50,
    },
  },
  {
    id: 'milestone-100',
    name: 'Century Woodchucker',
    emoji: '🍺',
    description: '100 group runs! Earned the coveted Century Woodchucker glass beer mug at Blue Note!',
    requirement: '100 group runs (Glass Beer Mug)',
    category: 'milestone',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'milestone',
      minTotalRuns: 100,
      reward: 'Century Woodchucker Glass Beer Mug',
      perks: 'Custom Glass Beer Mug at Blue Note',
      isIncremental: true,
      step: 100,
    },
  },
  {
    id: 'milestone-200',
    name: 'Double Century Legend',
    emoji: '🍶',
    description: '200 group runs! Earned the custom runner name engraved insulated Woodchucker water bottle.',
    requirement: '200 group runs (Custom Water Bottle)',
    category: 'milestone',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'milestone',
      minTotalRuns: 200,
      reward: 'Double Century Legend Custom Water Bottle',
      perks: 'Custom Runner Name Engraved Water Bottle',
      isIncremental: true,
      step: 200,
    },
  },
  {
    id: 'power-walker',
    name: 'Power Walker',
    emoji: '🚶',
    description: 'Completed group walks with the walking pack! Incremental badge that levels up every 10 walks.',
    requirement: 'Every 10 walking check-ins',
    category: 'walking',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'activity',
      activityType: 'walking',
      activityCount: 10,
      isIncremental: true,
      step: 10,
    },
  },
  {
    id: 'pet-runner',
    name: 'Woodchuck Hound',
    emoji: '🐕',
    description: 'Ran or walked the club route with your four-legged running buddy!',
    requirement: 'Running or walking with a pet (multiplier up to 10+)',
    category: 'pet',
    isIncremental: true,
    maxMultiplier: 10,
    isDefault: true,
    triggerConfig: {
      type: 'pet',
      isIncremental: true,
      step: 1,
    },
  },
  {
    id: 'streak-4',
    name: 'Burrow Regular',
    emoji: '🔥',
    description: 'Maintained a 4-week active streak — a full month of Wednesday runs in the Burrow!',
    requirement: '4-week streak (1 Month)',
    category: 'streak',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'streak',
      streakWeeks: 4,
      isIncremental: true,
      step: 4,
    },
  },
  {
    id: 'streak-10',
    name: 'Burrow Extreme',
    emoji: '⚡',
    description: 'Legendary dedication! Maintained a 10-week consecutive attendance streak with the club!',
    requirement: '10-week consecutive streak',
    category: 'streak',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'streak',
      streakWeeks: 10,
      isIncremental: true,
      step: 10,
    },
  },
  {
    id: 'special-turkey',
    name: 'Turkey Trot Veteran',
    emoji: '🦃',
    description: 'Ran the annual Thanksgiving Eve Turkey Trot with the Woodchuckers!',
    requirement: 'Annual Thanksgiving Eve run',
    category: 'special_event',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'special_event',
      specialEventId: 'turkey_trot',
      isIncremental: true,
      step: 1,
    },
  },
  {
    id: 'special-halloween',
    name: 'Halloween Costume Run',
    emoji: '🎃',
    description: 'Joined the annual spooky Halloween night costume run at Blue Note!',
    requirement: 'Annual Halloween costume run',
    category: 'special_event',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'special_event',
      specialEventId: 'halloween',
      isIncremental: true,
      step: 1,
    },
  },
  {
    id: 'special-anniversary',
    name: 'Anniversary Chucker',
    emoji: '🎂',
    description: 'Celebrated the Woodland Woodchuckers annual Club Anniversary run at Blue Note!',
    requirement: 'Annual Club Anniversary run',
    category: 'special_event',
    isIncremental: true,
    isDefault: true,
    triggerConfig: {
      type: 'special_event',
      specialEventId: 'anniversary',
      isIncremental: true,
      step: 1,
    },
  },
];

export const INITIAL_SPECIAL_EVENTS: SpecialEventDefinition[] = [
  {
    id: 'turkey_trot',
    name: 'Turkey Trot',
    emoji: '🦃',
    badgeId: 'special-turkey',
    badgeDescription: 'Ran the annual Thanksgiving Eve Turkey Trot with the Woodchuckers!',
    badgeRequirement: 'Annual Thanksgiving Eve run',
    isDefault: true,
  },
  {
    id: 'halloween',
    name: 'Halloween Costume Run',
    emoji: '🎃',
    badgeId: 'special-halloween',
    badgeDescription: 'Joined the annual spooky Halloween night costume run at Blue Note!',
    badgeRequirement: 'Annual Halloween costume run',
    isDefault: true,
  },
  {
    id: 'anniversary',
    name: 'Anniversary Run',
    emoji: '🎂',
    badgeId: 'special-anniversary',
    badgeDescription: 'Celebrated the Woodland Woodchuckers annual Club Anniversary run at Blue Note!',
    badgeRequirement: 'Annual Club Anniversary run',
    isDefault: true,
  },
];

export const CLUB_MILESTONES: MilestoneReward[] = [
  {
    runsRequired: 5,
    name: '5 Runs Milestone',
    reward: 'Official Woodchucker Member Shirt',
    perks: '$1 off all draft beers at Blue Note Brewing on run nights',
    icon: '👕',
    description: 'Complete 5 group runs to earn your official Woodchucker club shirt and unlock $1 off draft beers at Blue Note Brewing on run nights!',
  },
  {
    runsRequired: 50,
    name: '50 Runs Milestone',
    reward: 'Woodchucker Running Hat',
    perks: 'Official Club Headwear & Honor Roll',
    icon: '🧢',
    description: 'Hit 50 group runs with the crew and rock the official Woodchucker running cap or beanie on the trails and streets.',
  },
  {
    runsRequired: 100,
    name: '100 Runs Milestone',
    reward: 'Woodchucker Glass Beer Mug',
    perks: 'Century Club Honor Roll',
    icon: '🍺',
    description: '100 group runs! Receive an engraved Woodchucker glass beer mug to celebrate triple-digit dedication at Blue Note Brewing Co.',
  },
  {
    runsRequired: 200,
    name: '200 Runs Milestone',
    reward: 'Custom Runner Name Water Bottle',
    perks: 'Double Century Legend Status',
    icon: '🍶',
    description: 'The ultimate endurance award. A custom-engraved premium insulated water bottle personalized with your runner name.',
  },
];

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

// Historical Legacy Members pool (claimed and unclaimed variants from historical database)
export const INITIAL_LEGACY_MEMBERS: LegacyMember[] = [
  // Matt Settles variants
  {
    id: 'matt-settles',
    name: 'MATT SETTLES',
    newCount: 129,
    oldCount: 124,
    totalRuns: 253,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'matt-l-settles',
    name: 'MATT L SETTLES',
    newCount: 5,
    oldCount: 0,
    totalRuns: 5,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'matt-settlea',
    name: 'MATT SETTLEA',
    newCount: 1,
    oldCount: 0,
    totalRuns: 1,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'matt-settled',
    name: 'MATT SETTLED',
    newCount: 1,
    oldCount: 0,
    totalRuns: 1,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'matt',
    name: 'MATT',
    newCount: 1,
    oldCount: 0,
    totalRuns: 1,
    claimedByEmail: null,
    claimedAt: null,
  },
  // Keith Misner variants
  {
    id: 'keith-misner',
    name: 'KEITH MISNER',
    newCount: 252,
    oldCount: 65,
    totalRuns: 317,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'keith',
    name: 'KEITH',
    newCount: 0,
    oldCount: 0,
    totalRuns: 0,
    claimedByEmail: null,
    claimedAt: null,
  },
  // John Conway / Conroy variants
  {
    id: 'john-conroy',
    name: 'JOHN CONROY',
    newCount: 203,
    oldCount: 76,
    totalRuns: 279,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'john-conway',
    name: 'JOHN CONWAY',
    newCount: 0,
    oldCount: 0,
    totalRuns: 0,
    claimedByEmail: null,
    claimedAt: null,
  },
  // Brittney Echols variants
  {
    id: 'brittney-echols',
    name: 'BRITTNEY ECHOLS',
    newCount: 166,
    oldCount: 2,
    totalRuns: 168,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'brittney',
    name: 'BRITTNEY',
    newCount: 2,
    oldCount: 0,
    totalRuns: 2,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'brittney-ecols',
    name: 'BRITTNEY ECOLS',
    newCount: 1,
    oldCount: 0,
    totalRuns: 1,
    claimedByEmail: null,
    claimedAt: null,
  },
  // Additional family / unclaimed test records
  {
    id: 'caprice-settles',
    name: 'CAPRICE SETTLES',
    newCount: 8,
    oldCount: 0,
    totalRuns: 8,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'dean-echols',
    name: 'DEAN ECHOLS',
    newCount: 16,
    oldCount: 0,
    totalRuns: 16,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'zahra-echols',
    name: 'ZAHRA ECHOLS',
    newCount: 18,
    oldCount: 0,
    totalRuns: 18,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'abby-miksits',
    name: 'ABBY MIKSITS',
    newCount: 3,
    oldCount: 0,
    totalRuns: 3,
    claimedByEmail: null,
    claimedAt: null,
  },
];

// Default Unauthenticated / Guest User Profile
export const GUEST_USER: UserProfile = {
  email: '',
  firstName: 'Guest',
  lastName: 'Runner',
  displayName: 'Guest Runner',
  shirtSize: 'M',
  pre2021Runs: 0,
  loggedRuns: 0,
  totalRuns: 0,
  totalMiles: 0,
  runCount: 0,
  walkCount: 0,
  linkedLegacyNames: [],
  unlockedBadgeIds: [],
  role: 'guest',
  createdAt: '2026-11-06T18:00:00Z',
};

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
    unlockedBadgeIds: ['first-chuck'],
    badgeCounts: { 'first-chuck': 1 },
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
