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
  MilestoneAlert
} from '../types';

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
  },
  {
    id: 'milestone-5',
    name: '5-Run Member Shirt',
    emoji: '👕',
    description: 'Earned your official Woodchucker club shirt & $1 off draft beers at Blue Note Brewing on run nights!',
    requirement: '5 group runs (Official Shirt + $1 Off Beers)',
    category: 'milestone',
    isIncremental: true,
  },
  {
    id: 'milestone-50',
    name: '50-Run Hat Club',
    emoji: '🧢',
    description: 'Hit 50 group runs with the crew and earned the official Woodchucker running cap or beanie!',
    requirement: '50 group runs (Running Hat)',
    category: 'milestone',
    isIncremental: true,
  },
  {
    id: 'milestone-100',
    name: 'Century Woodchucker',
    emoji: '🍺',
    description: '100 group runs! Earned the coveted Century Woodchucker glass beer mug at Blue Note!',
    requirement: '100 group runs (Glass Beer Mug)',
    category: 'milestone',
    isIncremental: true,
  },
  {
    id: 'milestone-200',
    name: 'Double Century Legend',
    emoji: '🍶',
    description: '200 group runs! Earned the custom runner name engraved insulated Woodchucker water bottle.',
    requirement: '200 group runs (Custom Water Bottle)',
    category: 'milestone',
    isIncremental: true,
  },
  {
    id: 'power-walker',
    name: 'Power Walker',
    emoji: '🚶',
    description: 'Completed group walks with the walking pack! Incremental badge that levels up every 10 walks.',
    requirement: 'Every 10 walking check-ins',
    category: 'walking',
    isIncremental: true,
  },
  {
    id: 'streak-4',
    name: 'Burrow Regular',
    emoji: '🔥',
    description: 'Maintained a 4-week active streak — a full month of Wednesday runs in the Burrow!',
    requirement: '4-week streak (1 Month)',
    category: 'streak',
    isIncremental: true,
  },
  {
    id: 'streak-10',
    name: 'Burrow Extreme',
    emoji: '⚡',
    description: 'Legendary dedication! Maintained a 10-week consecutive attendance streak with the club!',
    requirement: '10-week consecutive streak',
    category: 'streak',
    isIncremental: true,
  },
  {
    id: 'special-turkey',
    name: 'Turkey Trot Veteran',
    emoji: '🦃',
    description: 'Ran the annual Thanksgiving Eve Turkey Trot with the Woodchuckers!',
    requirement: 'Annual Thanksgiving Eve run',
    category: 'special_event',
    isIncremental: true,
  },
  {
    id: 'special-halloween',
    name: 'Halloween Costume Run',
    emoji: '🎃',
    description: 'Joined the annual spooky Halloween night costume run at Blue Note!',
    requirement: 'Annual Halloween costume run',
    category: 'special_event',
    isIncremental: true,
  },
  {
    id: 'special-anniversary',
    name: 'Anniversary Chucker',
    emoji: '🎂',
    description: 'Celebrated the Woodland Woodchuckers annual Club Anniversary run at Blue Note!',
    requirement: 'Annual Club Anniversary run',
    category: 'special_event',
    isIncremental: true,
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
  {
    id: 'alert-matt-100',
    userEmail: 'matt.settles@example.com',
    runnerName: 'Matt Settles',
    shirtSize: 'L',
    milestoneRuns: 100,
    milestoneName: '100 Runs Milestone',
    reward: 'Woodchucker Glass Beer Mug',
    perks: 'Century Club Honor Roll',
    date: '2026-10-21',
    time: '18:35:12',
    fulfilled: true,
    fulfilledAt: '2026-10-21T18:45:00Z',
    fulfilledBy: 'woodlandwoodchuckers@gmail.com',
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
    unlockedBadgeIds: ['first-chuck', 'milestone-5', 'milestone-50', 'milestone-100', 'streak-4', 'special-turkey'],
    badgeCounts: { 'first-chuck': 1, 'milestone-5': 1, 'milestone-50': 1, 'milestone-100': 1, 'streak-4': 2, 'special-turkey': 3 },
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
    unlockedBadgeIds: ['first-chuck', 'milestone-5', 'milestone-50', 'milestone-100', 'streak-4', 'streak-10', 'special-anniversary'],
    badgeCounts: { 'first-chuck': 1, 'milestone-5': 1, 'milestone-50': 1, 'milestone-100': 1, 'streak-4': 3, 'streak-10': 1, 'special-anniversary': 2 },
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
    unlockedBadgeIds: ['first-chuck', 'milestone-5', 'milestone-50', 'milestone-100', 'power-walker', 'streak-4', 'special-turkey', 'special-halloween'],
    badgeCounts: { 'first-chuck': 1, 'milestone-5': 1, 'milestone-50': 1, 'milestone-100': 1, 'power-walker': 2, 'streak-4': 2, 'special-turkey': 2, 'special-halloween': 1 },
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
    unlockedBadgeIds: ['first-chuck', 'milestone-5', 'streak-4'],
    badgeCounts: { 'first-chuck': 1, 'milestone-5': 1, 'streak-4': 1 },
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
    unlockedBadgeIds: ['first-chuck', 'milestone-5'],
    badgeCounts: { 'first-chuck': 1, 'milestone-5': 1 },
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
    specialEvent: 'turkey_trot',
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
      { memberId: 'matt.settles@example.com', name: 'Matt Settles', checkedIn: false, rsvpDate: '2026-11-05' },
      { memberId: 'brittney.ecols@example.com', name: 'Brittney Ecols', checkedIn: false, rsvpDate: '2026-11-05' },
      { memberId: 'sarah.runner@example.com', name: 'Sarah Connor', checkedIn: false, rsvpDate: '2026-11-05' },
    ],
  },
];
