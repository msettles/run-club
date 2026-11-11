import { Member } from '../types';
import { liveStreak } from './legacy';

export type StandingMetric = 'miles' | 'runs' | 'streak';

export const streakOf = (m: Member): number => liveStreak(m.streak, m.lastCheckInDate, undefined, m.streakProofWeek);

export const metricValue = (m: Member, metric: StandingMetric): number =>
  metric === 'miles' ? m.totalMiles : metric === 'runs' ? m.totalRuns : streakOf(m);

export function sortByMetric(members: Member[], metric: StandingMetric): Member[] {
  return [...members].sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || a.name.localeCompare(b.name));
}

export interface Standing {
  rank: number;          // 1-based; ties share the better rank
  total: number;
  topPercent: number;    // 1-100, lower is better
  value: number;
  ahead?: Member;        // the runner just above you
  behind?: Member;       // the runner just below you
  gapToAhead: number;    // how much more you need to pass the runner above
}

/** Where `me` sits among `members` for one metric. `me` is counted even if missing from the list. */
export function standingFor(members: Member[], me: Member, metric: StandingMetric): Standing {
  const others = members.filter((m) => m.id !== me.id);
  const value = metricValue(me, metric);
  const sorted = sortByMetric([...others, me], metric);
  const rank = 1 + others.filter((m) => metricValue(m, metric) > value).length;
  const index = sorted.findIndex((m) => m.id === me.id);
  const above = sorted.slice(0, index).reverse().find((m) => metricValue(m, metric) > value);
  const below = sorted.slice(index + 1).find((m) => metricValue(m, metric) < value);
  return {
    rank,
    total: sorted.length,
    topPercent: Math.max(1, Math.ceil((rank / sorted.length) * 100)),
    value,
    ahead: above,
    behind: below,
    gapToAhead: above ? metricValue(above, metric) - value : 0,
  };
}
