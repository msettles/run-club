import type { RunEvent } from '../types';
import { runShareUrl } from './runLinks';

export type SocialPlatform = 'facebook' | 'instagram';
export interface SocialPostResult {
  state: 'published' | 'failed' | 'uncertain' | 'publishing';
  message: string;
  postId?: string;
  url?: string;
}
export interface SocialPostStatus {
  accounts: Partial<Record<SocialPlatform, string>>;
  results: Partial<Record<SocialPlatform, SocialPostResult>>;
}
export const CLUB_SITE = 'https://woodland-woodchuckers.web.app';

/** Read only public scheduling fields; never spread a run, profile or meetup secret into a post. */
export function socialRunDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles',
  }).format(new Date(`${date}T12:00:00-08:00`));
}
export function runPostCaption(run: Pick<RunEvent, 'id' | 'title' | 'date' | 'time' | 'locationName' | 'address' | 'description'>): string {
  const link = runShareUrl(run.id, CLUB_SITE);
  const header = `${run.title}\n${socialRunDate(run.date)} at ${run.time} (Woodland time)\n${run.locationName}${run.address ? ` · ${run.address}` : ''}`;
  const footer = `Everyone welcome!\nRun details & RSVP: ${link}\n\n#WoodlandWoodchuckers #WoodlandCA #RunClub`;
  // Keep room for Instagram's 2,200-character caption limit without truncating the link.
  return `${header.slice(0, 1000)}\n\n${run.description.slice(0, Math.max(0, 2196 - Math.min(header.length, 1000) - footer.length))}\n\n${footer}`;
}

export const MAX_SOCIAL_ROUTES = 10;
export interface SocialPostImage { routeId: string; name: string; image: string }
/** Keep the saved run's route order; repeated loop choices do not create duplicate photos. */
export function socialRouteIds(run: Pick<RunEvent, 'routeChoices' | 'routeId'>): string[] {
  return [...new Set(run.routeChoices?.length ? run.routeChoices.map((choice) => choice.routeId) : run.routeId ? [run.routeId] : [])];
}
