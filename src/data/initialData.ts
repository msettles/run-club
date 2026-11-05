import { GPXRoute, RunEvent, Member, Badge } from '../types';

// Center anchor: Woodland area coordinates (e.g., Woodland, CA / scenic park coordinates approx 38.678, -121.773)
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
    // Add some organic wiggle to make it look like a real winding trail
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
    id: 'trail-hound',
    name: 'Muddy Paws',
    emoji: '🌲',
    description: 'Conquered a challenging woodland trail route.',
    requirement: 'Complete 1 trail run',
  },
  {
    id: 'dawn-patrol',
    name: 'Dawn Woodchuck',
    emoji: '🌅',
    description: 'Checked into a sunrise run before 7:30 AM.',
    requirement: 'Early morning run',
  },
  {
    id: 'mile-50',
    name: 'Half Centurion',
    emoji: '🪵',
    description: 'Logged 50+ total miles with the club.',
    requirement: '50 cumulative miles',
  },
  {
    id: 'pace-rabbit',
    name: 'Trail Rabbit',
    emoji: '🐇',
    description: 'Paced a club group run.',
    requirement: 'Pace group leader',
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
    points: generateLoopPoints(BASE_LAT + 0.015, BASE_LON - 0.01, 0.5, 32, 20, 10),
    createdAt: '2026-03-05T12:00:00Z',
  },
  {
    id: 'route-timberline',
    name: 'Timberline Ridge Challenge',
    description: 'A punchy trail endurance run with steep switchbacks, rock outcroppings, and panoramic valley views at the summit.',
    distanceMiles: 8.4,
    elevationGainFt: 780,
    surface: 'Trail',
    difficulty: 'Challenging',
    points: generateLoopPoints(BASE_LAT - 0.02, BASE_LON + 0.02, 1.35, 64, 25, 75),
    createdAt: '2026-03-10T12:00:00Z',
  },
];

export const INITIAL_MEMBERS: Member[] = [
  {
    id: 'mem-admin',
    name: 'Woodland Woodchuckers (Admin)',
    email: 'woodlandwoodchuckers@gmail.com',
    avatarUrl: '/Woodchucker2.jpg',
    totalRuns: 42,
    totalMiles: 238.5,
    streak: 12,
    favoritePace: '8:45 min/mi',
    unlockedBadgeIds: ['first-chuck', 'streak-3', 'trail-hound', 'mile-50', 'dawn-patrol', 'pace-rabbit'],
    joinedDate: '2025-06-01',
  },
  {
    id: 'mem-1',
    name: 'Morgan Settles',
    email: 'morgan@woodchuckers.club',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    totalRuns: 28,
    totalMiles: 156.4,
    streak: 6,
    favoritePace: '8:30 min/mi',
    unlockedBadgeIds: ['first-chuck', 'streak-3', 'trail-hound', 'mile-50', 'dawn-patrol'],
    joinedDate: '2025-08-15',
  },
  {
    id: 'mem-2',
    name: 'Chuck "Woody" Miller',
    email: 'woody@woodchuckers.club',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    totalRuns: 22,
    totalMiles: 114.0,
    streak: 4,
    favoritePace: '9:15 min/mi',
    unlockedBadgeIds: ['first-chuck', 'streak-3', 'trail-hound', 'mile-50'],
    joinedDate: '2025-09-01',
  },
  {
    id: 'mem-3',
    name: 'Sierra Brooks',
    email: 'sierra@woodchuckers.club',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    totalRuns: 19,
    totalMiles: 92.8,
    streak: 3,
    favoritePace: '8:00 min/mi',
    unlockedBadgeIds: ['first-chuck', 'streak-3', 'trail-hound'],
    joinedDate: '2025-10-12',
  },
  {
    id: 'mem-4',
    name: 'Alex Rivera',
    email: 'alex@woodchuckers.club',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    totalRuns: 15,
    totalMiles: 68.2,
    streak: 2,
    favoritePace: '10:00 min/mi',
    unlockedBadgeIds: ['first-chuck', 'trail-hound'],
    joinedDate: '2025-11-20',
  },
  {
    id: 'mem-5',
    name: 'Taylor Chen',
    email: 'taylor@woodchuckers.club',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
    totalRuns: 8,
    totalMiles: 32.5,
    streak: 1,
    favoritePace: '11:00 min/mi (Run/Walk)',
    unlockedBadgeIds: ['first-chuck'],
    joinedDate: '2026-01-05',
  },
];

// Calculate future dates dynamically relative to current date
function getFutureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

export const INITIAL_RUNS: RunEvent[] = [
  {
    id: 'run-upcoming-saturday',
    title: 'Saturday Morning Woodchuck Trail Loop',
    date: getFutureDate(2),
    time: '08:00 AM',
    locationName: 'Woodland Creek Park — East Pavilion',
    address: 'East Trailhead Parking, Woodland, CA',
    distanceMiles: 5.2,
    surface: 'Trail',
    elevationGainFt: 240,
    routeId: 'route-river-loop',
    description: 'Weekly club flagship run! All paces welcome. Coffee & woodchuck cider donuts at the finish line.',
    organizerName: 'Morgan Settles',
    paceGroups: [
      { label: 'Fast Chucks', targetPace: '7:45 - 8:15 /mi', leadRunner: 'Sierra' },
      { label: 'Steady Burrows', targetPace: '8:45 - 9:30 /mi', leadRunner: 'Morgan' },
      { label: 'Cruiser Paws', targetPace: '9:45 - 10:30 /mi', leadRunner: 'Chuck' },
      { label: 'Run / Walk Pack', targetPace: '11:00+ /mi', leadRunner: 'Taylor' },
    ],
    attendees: [
      { memberId: 'mem-1', name: 'Morgan Settles', checkedIn: false, rsvpDate: '2026-03-01' },
      { memberId: 'mem-2', name: 'Chuck "Woody" Miller', checkedIn: false, rsvpDate: '2026-03-01' },
      { memberId: 'mem-3', name: 'Sierra Brooks', checkedIn: false, rsvpDate: '2026-03-02' },
      { memberId: 'mem-4', name: 'Alex Rivera', checkedIn: false, rsvpDate: '2026-03-02' },
    ],
  },
  {
    id: 'run-tuesday-track',
    title: 'Tuesday Sunset 5K & Social Pace',
    date: getFutureDate(5),
    time: '06:15 PM',
    locationName: 'Community Sports Park & Pine Path',
    address: 'Community Park Dr, Woodland, CA',
    distanceMiles: 3.1,
    surface: 'Pavement',
    elevationGainFt: 85,
    routeId: 'route-5k-sprint',
    description: 'Quick evening 5K loop on smooth paths followed by post-run hydration and taco social!',
    organizerName: 'Chuck "Woody" Miller',
    paceGroups: [
      { label: 'Tempo Group', targetPace: '7:30 - 8:15 /mi' },
      { label: 'Social Stride', targetPace: '9:00 - 10:00 /mi' },
      { label: 'Walk & Jog', targetPace: '11:00+ /mi' },
    ],
    attendees: [
      { memberId: 'mem-1', name: 'Morgan Settles', checkedIn: false, rsvpDate: '2026-03-02' },
      { memberId: 'mem-2', name: 'Chuck "Woody" Miller', checkedIn: false, rsvpDate: '2026-03-02' },
      { memberId: 'mem-5', name: 'Taylor Chen', checkedIn: false, rsvpDate: '2026-03-03' },
    ],
  },
  {
    id: 'run-ridge-challenge',
    title: 'Sunday Timberline Ridge Elevation Run',
    date: getFutureDate(9),
    time: '07:30 AM',
    locationName: 'Ridge Trailhead Base',
    address: 'Overlook Way, Woodland Hills, CA',
    distanceMiles: 8.4,
    surface: 'Trail',
    elevationGainFt: 780,
    routeId: 'route-timberline',
    description: 'For those looking for hills and trail endurance! Spectacular view from the ridge. Bring at least 500ml water.',
    organizerName: 'Sierra Brooks',
    paceGroups: [
      { label: 'Mountain Goats', targetPace: '9:00 - 9:45 /mi' },
      { label: 'Trail Explorers', targetPace: '10:30 - 11:30 /mi' },
    ],
    attendees: [
      { memberId: 'mem-1', name: 'Morgan Settles', checkedIn: false, rsvpDate: '2026-03-02' },
      { memberId: 'mem-3', name: 'Sierra Brooks', checkedIn: false, rsvpDate: '2026-03-03' },
    ],
  },
];
