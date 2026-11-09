import React, { useState } from 'react';
import { Member, Badge } from '../types';
import { Trophy, Flame, Award } from 'lucide-react';
import { liveStreak } from '../utils/legacy';

interface LeaderboardProps {
  members: Member[];
  badges: Badge[];
  currentMember: Member;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  members,
  badges,
  currentMember,
}) => {
  const [activeTab, setActiveTab] = useState<'miles' | 'runs' | 'streak'>('miles');

  // Streaks as of today (a stored streak ends once the runner misses a week)
  const streakOf = (m: Member) => liveStreak(m.streak, m.lastCheckInDate);

  // Sort members based on selected tab
  const sortedMembers = [...members].sort((a, b) => {
    if (activeTab === 'miles') return b.totalMiles - a.totalMiles;
    if (activeTab === 'runs') return b.totalRuns - a.totalRuns;
    return streakOf(b) - streakOf(a);
  });

  return (
    <div className="space-y-6">
      {/* Current Member Spotlight */}
      <div className="bg-gradient-to-r from-woodland-900 via-woodland-950 to-[#103b4b] text-white rounded-2xl p-6 shadow-md border border-woodland-700/60">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full ring-4 ring-woodland-500/30 overflow-hidden bg-woodland-700 flex items-center justify-center text-xl font-black text-white shrink-0">
              {currentMember.avatarUrl ? (
                <img
                  src={currentMember.avatarUrl}
                  alt={currentMember.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                currentMember.name.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold">{currentMember.name}</h2>
                <span className="text-[11px] bg-woodland-600/60 px-2 py-0.5 rounded-full font-semibold border border-woodland-400/40">
                  Active Woodchucker
                </span>
              </div>
              <p className="text-xs text-woodland-200 mt-0.5">
                Preferred Pace: {currentMember.favoritePace}
              </p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-woodland-900/60 px-4 py-2.5 rounded-xl border border-woodland-700/50">
            <div className="text-center">
              <span className="text-[10px] text-woodland-300 uppercase tracking-wider block">
                Total Runs
              </span>
              <span className="text-lg font-black">{currentMember.totalRuns}</span>
            </div>
            <div className="w-px h-8 bg-woodland-700/60" />
            <div className="text-center">
              <span className="text-[10px] text-woodland-300 uppercase tracking-wider block">
                Miles
              </span>
              <span className="text-lg font-black">{currentMember.totalMiles}</span>
            </div>
            <div className="w-px h-8 bg-woodland-700/60" />
            <div className="text-center">
              <span className="text-[10px] text-woodland-300 uppercase tracking-wider block">
                Streak
              </span>
              <span className="text-lg font-black text-amber-300 flex items-center justify-center gap-0.5">
                <Flame className="w-4 h-4 fill-amber-400 text-amber-400 inline" />
                {streakOf(currentMember)}
              </span>
            </div>
          </div>
        </div>

        {/* Member unlocked badges */}
        <div className="mt-5 pt-4 border-t border-woodland-800/80">
          <span className="text-xs font-semibold text-woodland-200 uppercase tracking-wider flex items-center justify-between mb-2.5">
            <span className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Badges Earned ({currentMember.unlockedBadgeIds.length} / {badges.length})</span>
            </span>
            <span className="text-[11px] text-woodland-300">
              Woodchucker Club Badges
            </span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {badges.map((badge) => {
              const unlocked = currentMember.unlockedBadgeIds.includes(badge.id);
              const count = currentMember.badgeCounts?.[badge.id] || (unlocked ? 1 : 0);
              return (
                <div
                  key={badge.id}
                  className={`flex items-start gap-2.5 p-2 rounded-xl text-xs font-medium border transition ${
                    unlocked
                      ? 'bg-woodland-900/90 border-woodland-500/60 text-white shadow-xs'
                      : 'bg-woodland-950/40 border-woodland-900/70 text-woodland-400/40 opacity-40'
                  }`}
                  title={`${badge.name}: ${badge.description}`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{badge.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold leading-tight flex items-center gap-1.5">
                      <span className="truncate">{badge.name}</span>
                      {unlocked && badge.isIncremental && count > 1 && (
                        <span className="px-1.5 py-0.2 bg-amber-400 text-stone-950 font-black text-[10px] rounded-full shrink-0 shadow-xs">
                          x{badge.maxMultiplier && count >= badge.maxMultiplier ? `${badge.maxMultiplier}+` : count}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-woodland-300/80 leading-tight mt-0.5 truncate">
                      {badge.requirement}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="p-5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-stone-900">Woodchuckers Leaderboard</h3>
          </div>

          {/* Sort Tabs */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('miles')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'miles'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Miles Logged
            </button>
            <button
              onClick={() => setActiveTab('runs')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'runs'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Total Runs
            </button>
            <button
              onClick={() => setActiveTab('streak')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'streak'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Streaks
            </button>
          </div>
        </div>

        {/* Member Roster List */}
        <div className="divide-y divide-stone-100">
          {sortedMembers.map((member, index) => {
            const isMe = member.id === currentMember.id;
            return (
              <div
                key={member.id}
                className={`p-4 flex items-center justify-between gap-3 hover:bg-stone-50/80 transition ${
                  isMe ? 'bg-woodland-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <span
                    className={`w-6 text-center font-black text-sm ${
                      index === 0
                        ? 'text-amber-500 text-lg'
                        : index === 1
                        ? 'text-stone-400 text-base'
                        : index === 2
                        ? 'text-amber-700 text-base'
                        : 'text-stone-400'
                    }`}
                  >
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                  </span>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-stone-200 border border-stone-200 shrink-0">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-stone-600">
                        {member.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Name and Pace */}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-stone-900">{member.name}</span>
                      {isMe && (
                        <span className="text-[10px] bg-woodland-100 text-woodland-900 px-1.5 py-0.2 rounded font-semibold border border-woodland-200">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <span>Pace: {member.favoritePace}</span>
                    </div>

                    {/* Quick Badge Chips */}
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {member.unlockedBadgeIds.slice(0, 4).map((badgeId) => {
                        const b = badges.find((x) => x.id === badgeId);
                        if (!b) return null;
                        const count = member.badgeCounts?.[badgeId] || 1;
                        return (
                          <span
                            key={badgeId}
                            className="inline-flex items-center gap-0.5 text-xs bg-stone-100 hover:bg-stone-200 px-1.5 py-0.5 rounded-md border border-stone-200 text-stone-800 transition"
                            title={`${b.name}${count > 1 ? ` (x${count})` : ''}`}
                          >
                            <span>{b.emoji}</span>
                            {b.isIncremental && count > 1 && (
                              <span className="text-[9px] font-black text-amber-700">
                                x{b.maxMultiplier && count >= b.maxMultiplier ? `${b.maxMultiplier}+` : count}
                              </span>
                            )}
                          </span>
                        );
                      })}
                      {member.unlockedBadgeIds.length > 4 && (
                        <span className="text-[10px] text-stone-400 font-bold px-1 py-0.5 bg-stone-50 rounded">
                          +{member.unlockedBadgeIds.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score / Metrics */}
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-sm font-extrabold text-stone-900 block">
                      {activeTab === 'miles'
                        ? `${member.totalMiles} mi`
                        : activeTab === 'runs'
                        ? `${member.totalRuns} runs`
                        : `${streakOf(member)} run streak`}
                    </span>
                    <span className="text-[11px] text-stone-400 block">
                      {member.unlockedBadgeIds.length} badges
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
