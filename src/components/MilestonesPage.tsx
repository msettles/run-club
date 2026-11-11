import React, { useState } from 'react';
import { UserProfile, Badge, MilestoneReward } from '../types';
import { isBadge } from '../services/store/helpers';
import { CLUB_MILESTONES, INITIAL_BADGES } from '../data/catalog';
import { milestoneProgress } from '../utils/milestones';
import { badgeProgress, levelTag } from '../utils/badgeProgress';
import { CheckCircle, Gift, Sparkles, Beer, Award, Lock, UserPlus, ChevronDown } from 'lucide-react';

interface MilestonesPageProps {
  currentUser: UserProfile;
  badges?: Badge[];
  /** The club's milestones (gear tiers), including any an admin added. */
  milestones?: MilestoneReward[];
  /** Signed-in runners see their own progress; everyone else sees the catalog with a join prompt. */
  isSignedIn?: boolean;
  onJoin?: () => void;
}

const FILTERS = [
  { id: 'all', label: 'All', emoji: '🌟' },
  { id: 'special_event', label: 'Special Events', emoji: '🦃' },
  { id: 'streak', label: 'Streaks', emoji: '🔥' },
  { id: 'incremental', label: 'Level-ups', emoji: '🔼' },
  { id: 'walking', label: 'Walking Pack', emoji: '🚶' },
  { id: 'pet', label: 'Pet Runners', emoji: '🐕' },
  { id: 'attendance', label: 'Attendance', emoji: '🦫' },
  { id: 'distance', label: 'Distance', emoji: '🗺️' },
];

const Multiplier: React.FC<{ badge: Badge; count: number }> = ({ badge, count }) =>
  badge.isIncremental && count > 1 ? (
    <span className="px-1.5 bg-amber-400 text-stone-950 font-black text-[10px] rounded-full shrink-0 font-mono">
      {levelTag(badge, count)}
    </span>
  ) : null;

export const MilestonesPage: React.FC<MilestonesPageProps> = ({
  currentUser,
  badges = INITIAL_BADGES,
  milestones = CLUB_MILESTONES,
  isSignedIn = true,
  onJoin,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  // Milestones are shown in their own section; they are never also badges.
  const allBadges = (badges && badges.length > 0 ? badges : INITIAL_BADGES).filter(isBadge);
  const totalRuns = isSignedIn ? currentUser.totalRuns : 0;
  const { nextMilestone, runsRemaining, progressPercent } = milestoneProgress(totalRuns, milestones);

  const unlockedIds = new Set(isSignedIn ? currentUser.unlockedBadgeIds || [] : []);
  const earned = allBadges.filter((b) => unlockedIds.has(b.id));
  const countOf = (b: Badge) => currentUser.badgeCounts?.[b.id] || 1;

  // Locked badges we can measure, closest to unlocking first.
  const almostThere = isSignedIn
    ? allBadges
        .filter((b) => !unlockedIds.has(b.id))
        .map((b) => ({ badge: b, progress: badgeProgress(b, currentUser) }))
        .filter((x): x is { badge: Badge; progress: NonNullable<typeof x.progress> } => !!x.progress && x.progress.current > 0)
        .sort((a, b) => b.progress.current / b.progress.target - a.progress.current / a.progress.target)
        .slice(0, 6)
    : [];

  const categoryCounts = allBadges.reduce((acc, b) => {
    const cat = b.category || 'other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const filterOptions = FILTERS.filter((f) => f.id === 'all' || categoryCounts[f.id]);
  const catalog = allBadges.filter((b) => selectedCategory === 'all' || (b.category || 'other') === selectedCategory);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200 pb-8">
      {/* Hero: your progress, or a join prompt */}
      <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-woodland-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Milestones &amp; Badges
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight uppercase">
              {isSignedIn ? 'Your Milestones' : 'Run Gear & Brewery Rewards'}
            </h2>
          </div>

          {isSignedIn ? (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 space-y-3 max-w-xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-woodland-200">{currentUser.displayName}</span>
                <span className="font-mono font-black text-amber-300 text-sm">{totalRuns} total runs</span>
              </div>
              {nextMilestone ? (
                <>
                  <div className="w-full bg-black/30 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/10">
                    <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs gap-3">
                    <span className="text-stone-300 text-[11px]">
                      Next: <strong className="text-white">{nextMilestone.icon} {nextMilestone.reward}</strong>
                    </span>
                    <span className="text-amber-300 font-extrabold shrink-0">{runsRemaining} run{runsRemaining > 1 ? 's' : ''} to go</span>
                  </div>
                </>
              ) : (
                <div className="text-xs font-black text-amber-300 uppercase tracking-wider">🌟 Every milestone unlocked — legend status!</div>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-w-xl">
              <p className="text-sm text-woodland-100 leading-relaxed">
                Every Wednesday run you check into brings you closer to club gear and $1 off draft beers at Blue Note Brewing Co. Join to track your own progress.
              </p>
              {onJoin && (
                <button onClick={onJoin} className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs sm:text-sm rounded-xl transition shadow-md font-display uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer">
                  <UserPlus className="w-4 h-4" /> Join to track
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Milestone path */}
      <section className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-6 space-y-4">
        <h3 className="font-extrabold text-lg text-stone-900 font-display flex items-center gap-2">
          <Gift className="w-5 h-5 text-amber-500" /> Club Milestones
        </h3>
        <ol className="space-y-3">
          {milestones.map((m) => {
            const unlocked = isSignedIn && totalRuns >= m.runsRequired;
            const isNext = isSignedIn && nextMilestone?.runsRequired === m.runsRequired;
            return (
              <li
                key={m.runsRequired}
                className={`flex items-start gap-4 p-4 rounded-2xl border ${
                  unlocked ? 'bg-emerald-50/60 border-emerald-300' : isNext ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-300/30' : 'bg-stone-50 border-stone-200'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-2xl shrink-0">{m.icon}</div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="font-black text-stone-900 font-display leading-tight">{m.reward}</h4>
                    {unlocked ? (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> EARNED
                      </span>
                    ) : isNext ? (
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] rounded-full">NEXT · {runsRemaining} to go</span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-stone-100 text-stone-500 font-mono font-bold text-[11px] rounded-full">{m.runsRequired} runs</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">{m.description}</p>
                  {m.perks && (
                    <p className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                      <Beer className="w-3.5 h-3.5 text-amber-600 shrink-0" /> {m.perks}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <details className="group text-xs text-stone-600">
          <summary className="cursor-pointer font-bold text-stone-800 flex items-center gap-1.5 list-none">
            <ChevronDown className="w-4 h-4 transition group-open:rotate-180" /> How do I claim my gear?
          </summary>
          <p className="mt-2 leading-relaxed">
            Check in at the Wednesday run with the code word. The organizer is alerted with your name and shirt size — pick up your gear at the organizer table and enjoy $1 off draft beers.
          </p>
        </details>
      </section>

      {/* Your badges */}
      <section className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-stone-200 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-extrabold text-lg sm:text-xl text-stone-900 font-display flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" /> {isSignedIn ? 'Your Badges' : 'Club Badges'}
          </h3>
          <span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-stone-800">
            {isSignedIn ? `${earned.length} / ${allBadges.length} earned` : `${allBadges.length} badges to earn`}
          </span>
        </div>

        {isSignedIn && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-stone-500">Earned</h4>
            {earned.length === 0 ? (
              <p className="text-xs text-stone-500">No badges yet — check in to a run to earn your first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {earned.map((b) => (
                  <span key={b.id} title={`${b.name}: ${b.description}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-stone-900">
                    <span className="text-base">{b.emoji}</span>
                    {b.name}
                    <Multiplier badge={b} count={countOf(b)} />
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {almostThere.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-stone-500">Almost there</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {almostThere.map(({ badge, progress }) => (
                <div key={badge.id} className="p-3 rounded-2xl border border-stone-200 bg-stone-50 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{badge.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-stone-900 leading-snug">{badge.name}</div>
                      <div className="text-[11px] text-stone-500 truncate">{badge.requirement}</div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-500" style={{ width: `${Math.round((progress.current / progress.target) * 100)}%` }} />
                  </div>
                  <div className="text-[11px] font-bold text-stone-600">{progress.current} / {progress.target} {progress.unit}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <details className="group" open={!isSignedIn}>
          <summary className="cursor-pointer font-bold text-sm text-stone-800 flex items-center gap-1.5 list-none">
            <ChevronDown className="w-4 h-4 transition group-open:rotate-180" /> All badges
          </summary>
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterOptions.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedCategory(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    selectedCategory === f.id ? 'bg-woodland-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <span>{f.emoji}</span> {f.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalog.map((b) => {
                const unlocked = unlockedIds.has(b.id);
                return (
                  <div key={b.id} className={`p-4 rounded-2xl border space-y-2 ${unlocked ? 'bg-emerald-50/50 border-emerald-300' : 'bg-stone-50/70 border-stone-200'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-2xl bg-white border border-stone-200 flex items-center justify-center text-2xl shrink-0">{b.emoji}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-sm text-stone-900 leading-snug">{b.name}</h4>
                          {unlocked && <Multiplier badge={b} count={countOf(b)} />}
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200/80 inline-block mt-0.5">{b.requirement}</span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">{b.description}</p>
                    {isSignedIn && (
                      <div className="pt-2 border-t border-stone-200/60 flex justify-end text-[10px] font-bold">
                        {unlocked ? (
                          <span className="text-emerald-700 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> EARNED</span>
                        ) : (
                          <span className="text-stone-400 flex items-center gap-1"><Lock className="w-3 h-3" /> LOCKED</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
};
