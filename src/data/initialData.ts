import { GPXRoute, RunEvent, Member, Badge, MeetupEvent, CheckInRecord, LegacyMember, UserProfile } from '../types';

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
    requirement: '1 run attendance',
  },
  {
    id: 'streak-3',
    name: 'Burrow Regular',
    emoji: '🔥',
    description: 'Maintained a 3-week active running streak.',
    requirement: '3-week streak',
  },
  {
    id: 'turkey-veteran',
    name: 'Turkey Trot Veteran',
    emoji: '🦃',
    description: 'Ran the Thanksgiving Eve Turkey Trot with the Woodchuckers.',
    requirement: 'TURKEY code word run',
  },
  {
    id: 'rain-or-shine',
    name: 'Rain or Shine',
    emoji: '🌧️',
    description: 'Tackled a wet winter run without skipping a beat.',
    requirement: 'Winter wet weather run',
  },
  {
    id: 'mile-50',
    name: '50-Run Club Shirt',
    emoji: '👕',
    description: 'Earned the official Woodland Woodchuckers 50-Run milestone shirt!',
    requirement: '50 cumulative group runs',
  },
  {
    id: 'mile-100',
    name: 'Century Woodchucker',
    emoji: '💯',
    description: 'Logged 100 group runs with the crew!',
    requirement: '100 cumulative group runs',
  },
  {
    id: 'century-walker',
    name: 'Power Walker',
    emoji: '🚶',
    description: 'Completed 10+ group walks with the walking pack.',
    requirement: '10 walking check-ins',
  },
];

export const INITIAL_ROUTES: GPXRoute[] = [
  {
    id: 'route-river-loop',
    name: 'Woodchuck Burrow River Loop',
    description: 'Our signature weekend club loop! Shaded singletrack along the creek with packed dirt trails and scenic river views.',
    distanceMiles: 5.2,
    elevationGainFt: 240,
    surface: 'Trail',
    difficulty: 'Moderate',
    points: generateLoopPoints(BASE_LAT, BASE_LON, 0.85, 48, 22, 28),
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
    createdAt: '2026-03-01T12:00:00Z',
  },
];

// -------------------------------------------------------------
// DUMMY TESTING DATA FOR RELATIONAL RUN CLUB
// -------------------------------------------------------------

// Dummy Legacy Members pool (unclaimed past names & counts for testing claim flow)
export const INITIAL_LEGACY_MEMBERS: LegacyMember[] = [
  {
    id: 'matt-settles',
    name: 'MATT SETTLES',
    newCount: 120,
    oldCount: 0,
    totalRuns: 120,
    claimedByEmail: 'matt.settles@example.com',
    claimedAt: '2026-11-06T18:00:00Z',
  },
  {
    id: 'matthew-settles',
    name: 'MATTHEW SETTLES',
    newCount: 3,
    oldCount: 0,
    totalRuns: 3,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'brittney-ecols',
    name: 'BRITTNEY ECOLS',
    newCount: 145,
    oldCount: 12,
    totalRuns: 157,
    claimedByEmail: 'brittney.ecols@example.com',
    claimedAt: '2026-11-06T18:00:00Z',
  },
  {
    id: 'sarah-connor',
    name: 'SARAH CONNOR',
    newCount: 42,
    oldCount: 5,
    totalRuns: 47,
    claimedByEmail: null,
    claimedAt: null,
  },
  {
    id: 'dave-grohl',
    name: 'DAVE GROHL',
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

// Dummy Users Table (Keyed on Email)
export const INITIAL_USERS: UserProfile[] = [
  {
    email: 'matt.settles@example.com',
    firstName: 'Matt',
    lastName: 'Settles',
    displayName: 'Matt Settles',
    shirtSize: 'L',
    age: 42,
    city: 'Woodland',
    zipCode: '95695',
    pre2021Runs: 0,
    loggedRuns: 120,
    totalRuns: 120,
    totalMiles: 386.4,
    runCount: 112,
    walkCount: 8,
    firstRunDate: '2021-02-10',
    linkedLegacyNames: ['MATT SETTLES'],
    unlockedBadgeIds: ['first-chuck', 'streak-3', 'turkey-veteran', 'mile-50', 'mile-100'],
    role: 'admin',
    createdAt: '2026-11-06T18:00:00Z',
  },
  {
    email: 'woodlandwoodchuckers@gmail.com',
    firstName: 'Woodchuck',
    lastName: 'Admin',
    displayName: 'Club Organizer',
    shirtSize: 'XL',
    city: 'Woodland',
    zipCode: '95695',
    pre2021Runs: 0,
    loggedRuns: 160,
    totalRuns: 160,
    totalMiles: 520.0,
    runCount: 155,
    walkCount: 5,
    firstRunDate: '2021-02-03',
    linkedLegacyNames: [],
    unlockedBadgeIds: ['first-chuck', 'streak-3', 'mile-50', 'mile-100'],
    role: 'admin',
    createdAt: '2026-11-06T18:00:00Z',
  },
  {
    email: 'brittney.ecols@example.com',
    firstName: 'Brittney',
    lastName: 'Ecols',
    displayName: 'Brittney Ecols',
    shirtSize: 'M',
    age: 36,
    city: 'Woodland',
    zipCode: '95695',
    pre2021Runs: 12,
    loggedRuns: 145,
    totalRuns: 157,
    totalMiles: 495.2,
    runCount: 130,
    walkCount: 27,
    firstRunDate: '2021-02-03',
    linkedLegacyNames: ['BRITTNEY ECOLS'],
    unlockedBadgeIds: ['first-chuck', 'streak-3', 'turkey-veteran', 'mile-50', 'mile-100', 'century-walker'],
    role: 'organizer',
    createdAt: '2026-11-06T18:00:00Z',
  },
  {
    email: 'sarah.runner@example.com',
    firstName: 'Sarah',
    lastName: 'Connor',
    displayName: 'Sarah Connor',
    shirtSize: 'S',
    age: 29,
    city: 'Woodland',
    zipCode: '95695',
    pre2021Runs: 5,
    loggedRuns: 42,
    totalRuns: 47,
    totalMiles: 152.0,
    runCount: 44,
    walkCount: 3,
    firstRunDate: '2022-04-06',
    linkedLegacyNames: [],
    unlockedBadgeIds: ['first-chuck', 'streak-3'],
    role: 'member',
    createdAt: '2026-11-06T18:00:00Z',
  },
  {
    email: 'leo.junior@example.com',
    firstName: 'Leo',
    lastName: 'Miller',
    displayName: 'Leo Miller',
    shirtSize: 'Youth',
    age: 11,
    city: 'Woodland',
    zipCode: '95695',
    pre2021Runs: 0,
    loggedRuns: 14,
    totalRuns: 14,
    totalMiles: 24.5,
    runCount: 12,
    walkCount: 2,
    firstRunDate: '2025-06-11',
    linkedLegacyNames: [],
    unlockedBadgeIds: ['first-chuck'],
    role: 'member',
    createdAt: '2026-11-06T18:00:00Z',
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
    activeDistances: ['1', '3', '5'],
    routes: {
      '1': {
        name: 'Downtown Blue Note Stroll',
        actualMiles: 1.15,
        routeUrl: 'https://www.strava.com/routes/31201',
        directions: 'Start at Blue Note Brewing heading East on Main St. Turn Right on 2nd St, loop down to Court St, and back to the brewery patio.',
      },
      '3': {
        name: 'Heritage Park Greenbelt Loop',
        actualMiles: 3.22,
        routeUrl: 'https://www.strava.com/routes/31203',
        directions: 'East on Main St, Left on 3rd St, cut through Heritage Park greenbelt trail, return West via Court St back to Blue Note.',
      },
      '5': {
        name: 'Spring Lake Trek',
        actualMiles: 5.12,
        routeUrl: 'https://www.strava.com/routes/31205',
        directions: 'South on East St to Farmers Central Rd, complete perimeter loop of Spring Lake Park, and return North via 6th St.',
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
    activeDistances: ['3', '5'],
    routes: {
      '3': {
        name: 'Historic Cemetery Perimeter',
        actualMiles: 3.08,
        routeUrl: 'https://www.strava.com/routes/31202',
        directions: 'West on Court St to historic Woodland Cemetery, perimeter trail loop, and return East along Main St.',
      },
      '5': {
        name: 'Woodland Sports Park Out & Back',
        actualMiles: 5.05,
        routeUrl: 'https://www.strava.com/routes/31204',
        directions: 'West on Main St to Sports Park Dr, loop softball complex trails, and return on Court St.',
      },
    },
  },
];

// Dummy Check-In Records (Event Log)
export const INITIAL_CHECKINS: CheckInRecord[] = [
  {
    id: '2026-11-04_matt.settles@example.com',
    date: '2026-11-04',
    time: '18:35:12',
    userEmail: 'matt.settles@example.com',
    runnerName: 'Matt Settles',
    activity: 'running',
    distanceChoice: 3,
    actualMiles: 3.08,
    routeName: 'Historic Cemetery Perimeter',
    source: 'pwa',
    createdAt: '2026-11-04T18:35:12Z',
  },
  {
    id: '2026-11-04_brittney.ecols@example.com',
    date: '2026-11-04',
    time: '18:36:44',
    userEmail: 'brittney.ecols@example.com',
    runnerName: 'Brittney Ecols',
    activity: 'walking',
    distanceChoice: 3,
    actualMiles: 3.08,
    routeName: 'Historic Cemetery Perimeter',
    source: 'pwa',
    createdAt: '2026-11-04T18:36:44Z',
  },
  {
    id: '2026-11-04_sarah.runner@example.com',
    date: '2026-11-04',
    time: '18:40:02',
    userEmail: 'sarah.runner@example.com',
    runnerName: 'Sarah Connor',
    activity: 'running',
    distanceChoice: 5,
    actualMiles: 5.05,
    routeName: 'Woodland Sports Park Out & Back',
    source: 'pwa',
    createdAt: '2026-11-04T18:40:02Z',
  },
];

// Helper to convert UserProfile to Member for backwards UI compatibility
export const INITIAL_MEMBERS: Member[] = INITIAL_USERS.map((u) => ({
  ...u,
  id: u.email,
  name: u.displayName,
  streak: 3,
  favoritePace: u.role === 'organizer' ? '10:00 min/mi' : '8:45 min/mi',
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
      { memberId: 'matt.settles@example.com', name: 'Matt Settles', checkedIn: false, rsvpDate: '2026-11-05' },
      { memberId: 'brittney.ecols@example.com', name: 'Brittney Ecols', checkedIn: false, rsvpDate: '2026-11-05' },
      { memberId: 'sarah.runner@example.com', name: 'Sarah Connor', checkedIn: false, rsvpDate: '2026-11-05' },
    ],
  },
];
