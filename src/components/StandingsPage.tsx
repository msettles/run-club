import { runningSince } from '../utils/firstRun';
import React, { useState } from 'react';
import { Member, Badge, MilestoneReward } from '../types';
import { milestoneMeasure, milestoneTarget, sortMilestones } from '../utils/milestones';
import { levelTag } from '../utils/badgeProgress';
import { isBadge } from '../services/store/helpers';
import { Trophy, Flame, Footprints, MapPin, Timer, TrendingUp } from 'lucide-react';
import { StandingMetric, metricValue, sortByMetric, standingFor, streakOf } from '../utils/standings';

interface StandingsPageProps {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  members: Member[];
  badges: Badge[];
  milestones?: MilestoneReward[];
  currentMember: Member;
}

const METRICS: { id: StandingMetric; label: string; unit: (n: number) => string; icon: React.ReactNode; noun: string }[] = [
  { id: 'miles', label: 'Miles', unit: (n) => `${n} mi`, icon: <MapPin className="w-4 h-4" />, noun: 'mi' },
  { id: 'runs', label: 'Runs', unit: (n) => `${n} runs`, icon: <Footprints className="w-4 h-4" />, noun: 'runs' },
  { id: 'streak', label: 'Streak', unit: (n) => `${n} wk`, icon: <Flame className="w-4 h-4" />, noun: 'wk' },
];

const rankIcon = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);

export const StandingsPage: React.FC<StandingsPageProps> = ({ members, badges, milestones = [], currentMember, loading, error, onRetry }) => {
  const [visibleCount, setVisibleCount] = useState(25);
  const [metric, setMetric] = useState<StandingMetric>('miles');

  if (error) return <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">{error} <button type="button" onClick={onRetry} className="font-bold underline">Retry standings</button></div>;
  if (loading) return <div role="status" className="rounded-xl bg-white p-6 text-sm text-stone-600">Loading the club standings…</div>;

  // Use your own live profile numbers rather than the (possibly slightly older) public row.
  const roster = members.filter((m) => m.id !== currentMember.id);
  const me = currentMember;
  const sorted = sortByMetric([...roster, me], metric);
  const myIndex = sorted.findIndex((m) => m.id === me.id);
  const meta = METRICS.find((m) => m.id === metric)!;
  const visible = sorted.slice(0, visibleCount);
  const meVisible = myIndex < visibleCount;
  const bestStreak = Math.max(me.longestStreakWeeks || 0, streakOf(me));

  // Milestones reached (by runs or miles) and badges earned, shown on the hero.
  const earnedMilestones = sortMilestones(milestones).filter((m) => (milestoneMeasure(m) === 'miles' ? me.totalMiles : me.totalRuns) >= milestoneTarget(m));
  const earnedBadges = badges.filter(isBadge).filter((b) => me.unlockedBadgeIds.includes(b.id));

  const stats = [
    { label: 'Runs', value: me.totalRuns },
    { label: 'Miles', value: me.totalMiles },
    { label: 'Streak', value: `${streakOf(me)} wk`, flame: true },
    { label: 'Best streak', value: `${bestStreak} wk` },
  ];

  // Only count badges that still exist (removed or retired ones don't show or count).
  const knownBadges = (m: Member) => m.unlockedBadgeIds.filter((id) => badges.some((b) => b.id === id));
  const row = (m: Member, index: number) => (
    <div key={m.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${m.id === me.id ? 'bg-woodland-50/70' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-7 text-center font-black text-sm ${index < 3 ? 'text-lg' : 'text-stone-400'}`}>{rankIcon(index)}</span>
        <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-200 border border-stone-200 shrink-0 flex items-center justify-center font-bold text-stone-600 text-sm">
          {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" /> : m.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-stone-900 truncate">{m.name}</span>
            {m.id === me.id && <span className="text-[10px] bg-woodland-100 text-woodland-900 px-1.5 rounded font-semibold border border-woodland-200">You</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {knownBadges(m).slice(0, 3).map((id) => {
              const b = badges.find((x) => x.id === id);
              return b ? <span key={id} title={b.name} className="text-sm">{b.emoji}</span> : null;
            })}
            {knownBadges(m).length > 3 && <span className="text-[10px] text-stone-400 font-bold">+{knownBadges(m).length - 3}</span>}
          </div>
        </div>
      </div>
      <span className="text-sm font-extrabold text-stone-900 shrink-0">{meta.unit(metricValue(m, metric))}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Your stats */}
      <div className="bg-gradient-to-r from-woodland-900 via-woodland-950 to-[#103b4b] text-white rounded-2xl p-6 shadow-md border border-woodland-700/60 space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full ring-4 ring-woodland-500/30 overflow-hidden bg-woodland-700 flex items-center justify-center text-xl font-black shrink-0">
            {me.avatarUrl ? <img src={me.avatarUrl} alt={me.name} className="w-full h-full object-cover" /> : me.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold truncate">{me.name}</h2>
            <p className="text-xs text-woodland-200 flex items-center gap-1.5 mt-0.5">
              <Timer className="w-3.5 h-3.5" /> Pace {me.favoritePace}
              {runningSince(me.joinedDate || '') && <span>· Running since {runningSince(me.joinedDate || '')}</span>}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="bg-woodland-900/60 rounded-xl border border-woodland-700/50 px-3 py-2.5 text-center">
              <span className="text-[10px] text-woodland-300 uppercase tracking-wider block">{s.label}</span>
              <span className="text-xl font-black inline-flex items-center gap-1">
                {s.flame && <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />}
                {s.value}
              </span>
            </div>
          ))}
        </div>

        {/* Everything earned: milestones, then badges with their level */}
        <div className="space-y-2 border-t border-woodland-800/80 pt-4">
          <span className="text-xs font-semibold text-woodland-200 uppercase tracking-wider">
            Earned ({earnedMilestones.length + earnedBadges.length})
          </span>
          {earnedMilestones.length + earnedBadges.length === 0 ? (
            <p className="text-xs text-woodland-300">Nothing yet. Check in to a run to earn your first milestone.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {earnedMilestones.map((m) => (
                <span key={m.id} title={m.description} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/50 bg-amber-400/15 px-2.5 py-1.5 text-xs font-bold text-amber-100">
                  <span className="text-base">{m.icon}</span>
                  {m.hasGear === false ? m.name : m.reward}
                </span>
              ))}
              {earnedBadges.map((b) => {
                const count = me.badgeCounts?.[b.id] || 1;
                return (
                  <span key={b.id} title={`${b.name}: ${b.description}`} className="inline-flex items-center gap-1.5 rounded-xl border border-woodland-500/60 bg-woodland-900/90 px-2.5 py-1.5 text-xs font-bold text-white">
                    <span className="text-base">{b.emoji}</span>
                    {b.name}
                    {b.isIncremental && count > 1 && <span className="rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-stone-950">{levelTag(b, count)}</span>}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Where you stand */}
      <section className="space-y-3">
        <h3 className="font-extrabold text-lg text-stone-900 font-display flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-woodland-600" /> Where You Stand
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {METRICS.map((mt) => {
            const s = standingFor(roster, me, mt.id);
            return (
              <button
                key={mt.id}
                type="button"
                onClick={() => { setMetric(mt.id); setVisibleCount(25); }}
                className={`text-left bg-white rounded-2xl border p-4 space-y-1 transition cursor-pointer hover:border-woodland-300 ${metric === mt.id ? 'border-woodland-500 ring-2 ring-woodland-200' : 'border-stone-200'}`}
              >
                <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 flex items-center gap-1.5">{mt.icon}{mt.label}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-stone-900">#{s.rank}</span>
                  <span className="text-xs text-stone-500">of {s.total}</span>
                  <span className="ml-auto text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 rounded-full px-2 py-0.5">Top {s.topPercent}%</span>
                </div>
                <p className="text-[11px] text-stone-600 leading-snug">
                  {s.ahead
                    ? <>{s.gapToAhead} {mt.noun} behind <strong>{s.ahead.name}</strong></>
                    : s.value > 0 ? 'You lead the club! 🎉' : 'Check in to get on the board.'}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Leaderboard */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-stone-900">Club Leaderboard</h3>
          </div>
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-semibold">
            {METRICS.map((mt) => (
              <button
                key={mt.id}
                onClick={() => { setMetric(mt.id); setVisibleCount(25); }}
                className={`px-3 py-1.5 rounded-lg transition ${metric === mt.id ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
              >
                {mt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-stone-100">
          {visible.map((m, i) => row(m, i))}
          {!meVisible && (
            <>
              <div className="px-4 py-1 text-center text-stone-300 text-xs">⋮</div>
              {row(me, myIndex)}
            </>
          )}
          {visibleCount < sorted.length && (
            <button type="button" className="w-full p-4 text-sm font-bold text-woodland-800" onClick={() => setVisibleCount((c) => c + 25)}>
              Show more ({Math.min(visibleCount, sorted.length)} of {sorted.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
