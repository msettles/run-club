import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import type { createRouteLoadingOps } from './routeLoading';
import type { PersonalHistoryRow } from '../../utils/personalHistory';
import { personalHistoryRows } from '../../utils/personalHistory';
export function createSelfServiceOps(ctx: StoreState & ReturnType<typeof createLegacyOps> & ReturnType<typeof createRouteLoadingOps>) {
  const loadPersonalHistory = async () => {
    const email = ctx.currentUser.email.toLowerCase();
    const epoch = ctx.privateSessionEpoch.current;
    if (!email || ctx.currentUser.role === 'guest') throw new Error('Sign in to view your runs.');
    const [checkins, legacy] = await Promise.all([ctx.fetchRunnerCheckins(email), ctx.fetchLegacyEvents(ctx.currentUser.linkedLegacyIds || [])]);
    if (epoch !== ctx.privateSessionEpoch.current) throw new Error('Your account changed. Open My Runs again.');
    return personalHistoryRows(checkins, legacy, ctx.runs, ctx.meetupEvents);
  };
  const claimOwnHistory = async (id: string) => {
    if (!ctx.currentUser.email || ctx.currentUser.role === 'guest') throw new Error('Sign in to claim your history.');
    const epoch = ctx.privateSessionEpoch.current;
    const claimed = await ctx.claimLegacyProfile(ctx.currentUser, id);
    try {
      const user = await ctx.refreshDerivedStats(claimed);
      if (epoch !== ctx.privateSessionEpoch.current) throw new Error('Your account changed.');
      return { user, rewardsPending: false };
    } catch {
      if (epoch !== ctx.privateSessionEpoch.current) throw new Error('Your account changed.');
      return { user: claimed, rewardsPending: true };
    }
  };
  const loadPersonalHistoryRoute = async (row: PersonalHistoryRow) => {
    const epoch = ctx.privateSessionEpoch.current;
    if (!ctx.currentUser.email || ctx.currentUser.role === 'guest') throw new Error('Sign in to view your recorded route.');
    let id = row.routeId;
    if (!id && row.runId && row.routeChoice !== undefined) {
      const event = isFirebaseConfigured && db ? (await getDoc(doc(db, 'meetup_events', row.runId))).data() : ctx.meetupEvents.find((e) => e.id === row.runId);
      id = event?.routes?.[row.routeChoice]?.routeId;
    }
    if (!id) throw new Error('This attendance record has no saved route link.');
    const route = await ctx.loadRoute(id);
    if (epoch !== ctx.privateSessionEpoch.current) throw new Error('Your account changed.');
    return route;
  };
  return { loadPersonalHistory, claimOwnHistory, loadPersonalHistoryRoute };
}
