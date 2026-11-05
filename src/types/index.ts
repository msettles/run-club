export type SurfaceType = 'Trail' | 'Pavement' | 'Mixed' | 'Track';
export type DifficultyType = 'Easy' | 'Moderate' | 'Challenging';

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
  time: string; // "07:30 AM"
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
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  requirement: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  totalRuns: number;
  totalMiles: number;
  streak: number;
  favoritePace: string;
  unlockedBadgeIds: string[];
  joinedDate: string;
}

export interface CheckInPayload {
  runId: string;
  memberId: string;
  memberName: string;
}
