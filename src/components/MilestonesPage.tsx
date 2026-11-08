import React, { useState } from 'react';
import { UserProfile, Badge } from '../types';
import { CLUB_MILESTONES, INITIAL_BADGES } from '../data/initialData';
import { CheckCircle, Gift, Sparkles, Beer, ArrowRight, Award, Lock } from 'lucide-react';

interface MilestonesPageProps {
  currentUser: UserProfile;
  badges?: Badge[];
  onOpenCheckIn?: () => void;
}

export const MilestonesPage: React.FC<MilestonesPageProps> = ({
  currentUser,
  badges = INITIAL_BADGES,
  onOpenCheckIn,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Determine next milestone
  const nextMilestone = CLUB_MILESTONES.find((m) => m.runsRequired > currentUser.totalRuns) || null;
  const runsRemaining = nextMilestone ? nextMilestone.runsRequired - currentUser.totalRuns : 0;
  const previousMilestoneRuns = nextMilestone 
    ? (CLUB_MILESTONES[CLUB_MILESTONES.indexOf(nextMilestone) - 1]?.runsRequired || 0)
    : 200;
  
  const span = nextMilestone ? nextMilestone.runsRequired - previousMilestoneRuns : 1;
  const currentInSpan = nextMilestone ? Math.max(0, currentUser.totalRuns - previousMilestoneRuns) : span;
  const progressPercent = Math.min(100, Math.round((currentInSpan / span) * 100));

  const allBadges = badges && badges.length > 0 ? badges : INITIAL_BADGES;

  // Compute category options with dynamic counts
  const categoryCounts = allBadges.reduce((acc, b) => {
    const cat = b.category || 'other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filterOptions = [
    { id: 'all', label: 'All Badges', emoji: '🌟', count: allBadges.length },
    { id: 'special_event', label: 'Special Events', emoji: '🦃', count: categoryCounts['special_event'] || 0 },
    { id: 'streak', label: 'Streaks', emoji: '🔥', count: categoryCounts['streak'] || 0 },
    { id: 'walking', label: 'Walking Pack', emoji: '🚶', count: categoryCounts['walking'] || 0 },
    { id: 'pet', label: 'Pet Runners', emoji: '🐕', count: categoryCounts['pet'] || 0 },
    { id: 'attendance', label: 'Attendance', emoji: '🦫', count: categoryCounts['attendance'] || 0 },
    { id: 'milestone', label: 'Gear Milestones', emoji: '👕', count: categoryCounts['milestone'] || 0 },
    { id: 'distance', label: 'Distance', emoji: '🗺️', count: categoryCounts['distance'] || 0 },
  ].filter((f) => f.id === 'all' || f.count > 0);

  const filteredBadges = allBadges.filter((b) => {
    if (selectedCategory === 'all') return true;
    return (b.category || 'other') === selectedCategory;
  });

  const unlockedBadgeIds = new Set(currentUser.unlockedBadgeIds || []);
  const unlockedCount = allBadges.filter((b) => unlockedBadgeIds.has(b.id)).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200 pb-8">
      {/* Mobile-First Header */}
      <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-woodland-800 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-16 h-16 rounded-2xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-3xl shadow-md mx-auto mb-3">
          🏆
        </div>
        
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          Woodchucker Club Milestones
        </span>
        
        <h2 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight uppercase">
          Run Gear &amp; Brewery Rewards
        </h2>
        
        <p className="text-xs sm:text-sm text-woodland-100 max-w-lg mx-auto mt-2 leading-relaxed font-sans">
          Every group run you check into brings you closer to exclusive Woodchucker gear and draft beer discounts at Blue Note Brewing Co.!
        </p>

        {/* Runner's Live Milestone Progress Card */}
        <div className="mt-6 bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/20 text-left max-w-md mx-auto space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-woodland-200 flex items-center gap-1.5">
              <span>👋</span>
              <span>{currentUser.displayName}</span>
            </span>
            <span className="font-mono font-black text-amber-300 text-sm">
              {currentUser.totalRuns} Total Runs
            </span>
          </div>

          {nextMilestone ? (
            <>
              <div className="w-full bg-black/30 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/10">
                <div
                  className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-1000 shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-300 text-[11px]">
                  Next: <strong className="text-white font-bold">{nextMilestone.reward}</strong>
                </span>
                <span className="text-amber-300 font-extrabold text-xs">
                  {runsRemaining} run{runsRemaining > 1 ? 's' : ''} to go!
                </span>
              </div>
            </>
          ) : (
            <div className="text-center py-1">
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <span>🌟</span> Double Century Legend (200+ Runs)!
              </span>
            </div>
          )}
        </div>

        {onOpenCheckIn && (
          <div className="mt-4">
            <button
              onClick={onOpenCheckIn}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs sm:text-sm rounded-xl transition shadow-md font-display uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Check In Tonight at Blue Note</span>
              <ArrowRight className="w-4 h-4 text-stone-950" />
            </button>
          </div>
        )}
      </div>

      {/* The 4 Milestones Cards (Mobile Friendly Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {CLUB_MILESTONES.map((milestone) => {
          const isUnlocked = currentUser.totalRuns >= milestone.runsRequired;
          const isNext = nextMilestone?.runsRequired === milestone.runsRequired;

          return (
            <div
              key={milestone.runsRequired}
              className={`rounded-3xl border transition flex flex-col justify-between overflow-hidden relative shadow-sm ${
                isUnlocked
                  ? 'bg-white border-emerald-300 ring-2 ring-emerald-500/20'
                  : isNext
                  ? 'bg-white border-amber-400 ring-2 ring-amber-400/30'
                  : 'bg-white/90 border-stone-200'
              }`}
            >
              {/* Card Top Pill Badge */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-2xl shadow-inner shrink-0 border border-stone-200">
                    {milestone.icon}
                  </div>

                  {isUnlocked ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-full flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>UNLOCKED</span>
                    </span>
                  ) : isNext ? (
                    <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-full flex items-center gap-1.5 animate-pulse">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>NEXT UP ({runsRemaining} to go)</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-stone-100 text-stone-500 font-mono font-bold text-xs rounded-full">
                      {milestone.runsRequired} Runs
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                    Milestone {milestone.runsRequired}
                  </span>
                  <h3 className="text-lg font-black text-stone-900 font-display leading-tight">
                    {milestone.reward}
                  </h3>
                  <p className="text-xs text-stone-600 leading-relaxed pt-1">
                    {milestone.description}
                  </p>
                </div>

                {/* Brewery Perk Callout */}
                {milestone.perks && (
                  <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200/80 flex items-center gap-2 text-xs">
                    <Beer className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-bold text-amber-950 text-[11px]">
                      {milestone.perks}
                    </span>
                  </div>
                )}
              </div>

              {/* Picture Placeholder Stub (Ready for future image upload) */}
              <div className="px-5 pb-5 pt-2">
                <div className="w-full h-36 bg-gradient-to-br from-stone-50 to-stone-100 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-center p-3 text-stone-400 group hover:border-woodland-300 transition">
                  <div className="text-3xl mb-1 filter drop-shadow-xs">{milestone.icon}</div>
                  <span className="text-xs font-bold text-stone-600">
                    {milestone.reward}
                  </span>
                  <span className="text-[10px] text-stone-400 mt-0.5">
                    Official Photo Preview Coming Soon
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* How Rewards Work FAQ Card */}
      <div className="bg-stone-50 border border-stone-200 rounded-3xl p-5 sm:p-6 space-y-3">
        <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
          <Gift className="w-4 h-4 text-woodland-600" />
          <span>How Do I Claim My Milestone Gear?</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600 font-sans">
          <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1">
            <strong className="text-stone-900 block font-bold">1. Check In at Blue Note</strong>
            <p>Check into the Wednesday run using today's code word at the brewery.</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1">
            <strong className="text-stone-900 block font-bold">2. Instant Organizer Alert</strong>
            <p>The app instantly alerts tonight's run organizer with your name and shirt size.</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-1">
            <strong className="text-stone-900 block font-bold">3. Celebrate with a Beer!</strong>
            <p>Pick up your gear at the organizer table and enjoy $1 off draft beers!</p>
          </div>
        </div>
      </div>

      {/* Club Badges & Special Achievements Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-stone-200 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl shadow-inner shrink-0 border border-amber-200/80">
              <Award className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg sm:text-2xl text-stone-900 font-display">
                  Club Badges &amp; Achievements
                </h3>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-xs font-bold rounded-full border border-amber-200">
                  {allBadges.length} Total
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Earn badges for attendance, holiday traditions, walking pack, streaks, and pets!
              </p>
            </div>
          </div>

          {/* User's unlocked summary pill */}
          <div className="px-3.5 py-2 bg-gradient-to-r from-woodland-50 to-amber-50 border border-woodland-200 rounded-2xl text-xs font-bold text-stone-800 flex items-center gap-2 shadow-2xs">
            <span className="text-base">🎖️</span>
            <div>
              <span className="text-stone-500 text-[10px] block font-semibold uppercase tracking-wider">Your Collection</span>
              <span><strong>{unlockedCount} / {allBadges.length}</strong> Badges Unlocked</span>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedCategory(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer select-none ${
                selectedCategory === f.id
                  ? 'bg-woodland-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <span>{f.emoji}</span>
              <span>{f.label}</span>
              {f.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedCategory === f.id
                      ? 'bg-woodland-900 text-woodland-100'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredBadges.map((badge) => {
            const isUnlocked = unlockedBadgeIds.has(badge.id);
            const multiplier = currentUser.badgeCounts?.[badge.id] || (isUnlocked ? 1 : 0);

            return (
              <div
                key={badge.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between space-y-3 ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-white via-emerald-50/20 to-emerald-50/50 border-emerald-300 ring-2 ring-emerald-400/20 shadow-xs'
                    : 'bg-stone-50/70 border-stone-200/90 hover:bg-stone-50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-2xl bg-white border border-stone-200 shadow-2xs flex items-center justify-center text-2xl shrink-0">
                        {badge.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-sm text-stone-900 leading-snug">
                            {badge.name}
                          </h4>
                          {isUnlocked && badge.isIncremental && multiplier > 1 && (
                            <span className="px-1.5 py-0.2 bg-amber-400 text-stone-950 font-black text-[10px] rounded-full shrink-0 shadow-2xs font-mono">
                              x{badge.maxMultiplier && multiplier >= badge.maxMultiplier ? `${badge.maxMultiplier}+` : multiplier}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200/80 inline-block mt-0.5">
                          {badge.requirement}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">
                    {badge.description}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
                  <span className="capitalize font-bold text-stone-400 text-[10px]">
                    {badge.category ? badge.category.replace('_', ' ') : 'Club Badge'}
                  </span>

                  {isUnlocked ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-100/90 px-2.5 py-0.5 rounded-full border border-emerald-300 shadow-2xs text-[10px]">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>UNLOCKED</span>
                    </span>
                  ) : (
                    <span className="text-stone-400 font-medium flex items-center gap-1 bg-stone-100 px-2.5 py-0.5 rounded-full text-[10px] border border-stone-200/80">
                      <Lock className="w-3 h-3 text-stone-400" />
                      <span>LOCKED</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
