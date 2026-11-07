import React from 'react';
import { UserProfile } from '../types';
import { CLUB_MILESTONES } from '../data/initialData';
import { CheckCircle, Gift, Sparkles, Beer, ArrowRight } from 'lucide-react';

interface MilestonesPageProps {
  currentUser: UserProfile;
  onOpenCheckIn?: () => void;
}

export const MilestonesPage: React.FC<MilestonesPageProps> = ({
  currentUser,
  onOpenCheckIn,
}) => {
  // Determine next milestone
  const nextMilestone = CLUB_MILESTONES.find((m) => m.runsRequired > currentUser.totalRuns) || null;
  const runsRemaining = nextMilestone ? nextMilestone.runsRequired - currentUser.totalRuns : 0;
  const previousMilestoneRuns = nextMilestone 
    ? (CLUB_MILESTONES[CLUB_MILESTONES.indexOf(nextMilestone) - 1]?.runsRequired || 0)
    : 200;
  
  const span = nextMilestone ? nextMilestone.runsRequired - previousMilestoneRuns : 1;
  const currentInSpan = nextMilestone ? Math.max(0, currentUser.totalRuns - previousMilestoneRuns) : span;
  const progressPercent = Math.min(100, Math.round((currentInSpan / span) * 100));

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
    </div>
  );
};
