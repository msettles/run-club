import React, { useState } from 'react';
import { 
  BadgeCategory,
  BadgeTriggerConfig,
  ActivityType,
  DistanceChoice
} from '../../types';
import { INITIAL_BADGES, INITIAL_SPECIAL_EVENTS } from '../../data/initialData';
import { 
  Sparkles,
  Plus,
  Trash2,
  CheckCheck
} from 'lucide-react';
import type { AdminDashboardProps } from '../AdminDashboard';

export const BadgesTab: React.FC<AdminDashboardProps> = (props) => {
  const {
    routes = [],
    badges = INITIAL_BADGES,
    specialEvents = INITIAL_SPECIAL_EVENTS,
    onCreateBadge,
    onDeleteBadge,
  } = props;
  // Badge & Special Event Creator State
  const [newBadgeName, setNewBadgeName] = useState<string>('');
  const [newBadgeEmoji, setNewBadgeEmoji] = useState<string>('🏅');
  const [newBadgeCategory, setNewBadgeCategory] = useState<BadgeCategory>('special_event');
  const [newBadgeDesc, setNewBadgeDesc] = useState<string>('');
  const [newBadgeReq, setNewBadgeReq] = useState<string>('');
  const [newBadgeIncremental, setNewBadgeIncremental] = useState<boolean>(true);
  
  // Specific trigger parameters
  const [triggerSpecialSlug, setTriggerSpecialSlug] = useState<string>('');
  const [triggerMilestoneRuns, setTriggerMilestoneRuns] = useState<number>(25);
  const [triggerMilestoneReward, setTriggerMilestoneReward] = useState<string>('Woodchucker Club Pin');
  const [triggerMilestonePerks, setTriggerMilestonePerks] = useState<string>('$1 off draft beers at Blue Note');
  const [triggerActivityType, setTriggerActivityType] = useState<ActivityType>('walking');
  const [triggerActivityThreshold, setTriggerActivityThreshold] = useState<number>(10);
  const [triggerDistanceChoice, setTriggerDistanceChoice] = useState<DistanceChoice>('3.1');
  const [triggerDistanceThreshold, setTriggerDistanceThreshold] = useState<number>(10);
  const [triggerStreakWeeks, setTriggerStreakWeeks] = useState<number>(4);
  const [triggerMaxMultiplier, setTriggerMaxMultiplier] = useState<number>(10);
  const [badgeSavedToast, setBadgeSavedToast] = useState<string | null>(null);
  const [badgeFilterCategory, setBadgeFilterCategory] = useState<string>('all');
  const [isSubmittingBadge, setIsSubmittingBadge] = useState<boolean>(false);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-woodland-950 text-white rounded-2xl p-6 shadow-sm border border-stone-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold text-2xl shadow-md shrink-0">
            🏅
          </div>
          <div>
            <h3 className="font-extrabold text-lg font-display text-white">
              Woodchucker Badges &amp; Special Events Studio
            </h3>
            <p className="text-xs text-stone-300 mt-0.5">
              Create new "Is Special Event?" options, Milestone gear, walking/running achievements, and route distance mastery badges.
            </p>
          </div>
        </div>

        {badgeSavedToast && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-xl animate-in fade-in shadow-md">
            <CheckCheck className="w-4 h-4" />
            <span>{badgeSavedToast}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Badge Creator Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-5">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-sm text-stone-900 font-display uppercase tracking-wide">
                Create New Club Badge or Special Event
              </h4>
              <p className="text-xs text-stone-500">
                Define the emoji, achievement rule, and automatic reward triggers.
              </p>
            </div>
            <span className="text-xs font-black px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full border border-amber-300">
              New Badge
            </span>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newBadgeName.trim() || isSubmittingBadge) return;
              setIsSubmittingBadge(true);
              try {
                const triggerConfig: BadgeTriggerConfig = {
                  type: newBadgeCategory === 'walking' ? 'activity' : (newBadgeCategory as any),
                  isIncremental: newBadgeIncremental,
                };

                let categoryToSave: BadgeCategory = newBadgeCategory;

                if (newBadgeCategory === 'special_event') {
                  const slug = triggerSpecialSlug.trim() || newBadgeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                  triggerConfig.specialEventId = slug;
                  triggerConfig.step = 1;
                } else if (newBadgeCategory === 'milestone') {
                  triggerConfig.minTotalRuns = Number(triggerMilestoneRuns);
                  triggerConfig.reward = triggerMilestoneReward;
                  triggerConfig.perks = triggerMilestonePerks;
                  triggerConfig.step = Number(triggerMilestoneRuns);
                } else if (newBadgeCategory === 'activity' || newBadgeCategory === 'walking') {
                  categoryToSave = 'activity';
                  triggerConfig.activityType = triggerActivityType;
                  triggerConfig.activityCount = Number(triggerActivityThreshold);
                  triggerConfig.step = Number(triggerActivityThreshold);
                } else if (newBadgeCategory === 'distance') {
                  triggerConfig.distanceTier = triggerDistanceChoice;
                  triggerConfig.distanceCount = Number(triggerDistanceThreshold);
                  triggerConfig.step = Number(triggerDistanceThreshold);
                } else if (newBadgeCategory === 'streak') {
                  triggerConfig.streakWeeks = Number(triggerStreakWeeks);
                  triggerConfig.step = Number(triggerStreakWeeks);
                } else if (newBadgeCategory === 'pet') {
                  categoryToSave = 'pet';
                  triggerConfig.type = 'pet';
                  triggerConfig.step = 1;
                }

                if (onCreateBadge) {
                  await onCreateBadge({
                    name: newBadgeName.trim(),
                    emoji: newBadgeEmoji.trim() || '🏅',
                    description: newBadgeDesc.trim() || `Achievement badge for ${newBadgeName.trim()}`,
                    requirement: newBadgeReq.trim() || newBadgeName.trim(),
                    category: categoryToSave,
                    isIncremental: newBadgeIncremental,
                    maxMultiplier: triggerMaxMultiplier,
                    triggerConfig,
                    createSpecialEventOption: newBadgeCategory === 'special_event',
                  });
                }

                setBadgeSavedToast(`Created "${newBadgeName.trim()}" badge!`);
                setTimeout(() => setBadgeSavedToast(null), 4000);

                // Reset form
                setNewBadgeName('');
                setNewBadgeDesc('');
                setNewBadgeReq('');
              } catch (err: any) {
                alert(err.message || 'Error creating badge');
              } finally {
                setIsSubmittingBadge(false);
              }
            }}
            className="space-y-4"
          >
            {/* 1. Emoji Selection Section */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🎨</span>
                  <span>Badge Emoji &amp; Visual Symbol</span>
                </label>
                <span className="text-[11px] text-stone-500">
                  Tap any emoji below or type custom
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-amber-400 flex items-center justify-center text-3xl shadow-sm shrink-0">
                  {newBadgeEmoji || '🏅'}
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-stone-600 mb-0.5">
                    Selected Emoji (or paste from phone)
                  </label>
                  <input
                    type="text"
                    required
                    value={newBadgeEmoji}
                    onChange={(e) => setNewBadgeEmoji(e.target.value)}
                    placeholder="e.g. 🍀, 🎽, 🎄"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-xl font-bold bg-white outline-none focus:border-amber-500"
                    maxLength={6}
                  />
                </div>
              </div>

              {/* Curated Suggested Emojis by Categories */}
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider block">
                  Quick Picks for Run Club &amp; Special Events:
                </span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-stone-500 w-16 shrink-0">Mascot/Run:</span>
                    {['🦫', '🐕', '🐶', '🐾', '🏃', '🚶', '👟', '🎽', '⏱️', '🏅', '🏆', '🥇', '🥈', '🥉'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewBadgeEmoji(emoji)}
                        className={`w-7 h-7 text-base rounded-lg border flex items-center justify-center transition cursor-pointer ${
                          newBadgeEmoji === emoji ? 'bg-amber-300 border-amber-500 scale-110 shadow-xs' : 'bg-white border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-stone-500 w-16 shrink-0">Themes:</span>
                    {['🦃', '🎃', '🎂', '🍀', '🎄', '🎅', '🎆', '🐰', '🇺🇸', '💘', '🤠', '🕶️'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewBadgeEmoji(emoji)}
                        className={`w-7 h-7 text-base rounded-lg border flex items-center justify-center transition cursor-pointer ${
                          newBadgeEmoji === emoji ? 'bg-amber-300 border-amber-500 scale-110 shadow-xs' : 'bg-white border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-stone-500 w-16 shrink-0">Routes:</span>
                    {['1️⃣', '3️⃣', '5️⃣', '🗺️', '🧭', '🌲', '🏔️', '🛣️', '🏙️', '🌉', '🌊', '☀️'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewBadgeEmoji(emoji)}
                        className={`w-7 h-7 text-base rounded-lg border flex items-center justify-center transition cursor-pointer ${
                          newBadgeEmoji === emoji ? 'bg-amber-300 border-amber-500 scale-110 shadow-xs' : 'bg-white border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-stone-500 w-16 shrink-0">Brewery:</span>
                    {['🍺', '🍻', '🥂', '🍷', '🍕', '🌮', '🥨', '🍩', '☕', '🍔', '🌭'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewBadgeEmoji(emoji)}
                        className={`w-7 h-7 text-base rounded-lg border flex items-center justify-center transition cursor-pointer ${
                          newBadgeEmoji === emoji ? 'bg-amber-300 border-amber-500 scale-110 shadow-xs' : 'bg-white border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-stone-500 w-16 shrink-0">Streaks:</span>
                    {['🔥', '⚡', '🌟', '⭐', '💥', '🚀', '🦾', '👑', '🐾', '🎉'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewBadgeEmoji(emoji)}
                        className={`w-7 h-7 text-base rounded-lg border flex items-center justify-center transition cursor-pointer ${
                          newBadgeEmoji === emoji ? 'bg-amber-300 border-amber-500 scale-110 shadow-xs' : 'bg-white border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Badge Name */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1">
                Badge &amp; Event Name *
              </label>
              <input
                type="text"
                required
                value={newBadgeName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewBadgeName(val);
                  if (newBadgeCategory === 'special_event') {
                    setTriggerSpecialSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
                    setNewBadgeDesc(`Ran the annual ${val} with the Woodchuckers at Blue Note Brewing!`);
                    setNewBadgeReq(`Attended the ${val}`);
                  } else if (newBadgeCategory === 'milestone') {
                    setNewBadgeDesc(`Hit ${triggerMilestoneRuns} group runs with the Woodchuckers and earned the ${triggerMilestoneReward}!`);
                    setNewBadgeReq(`${triggerMilestoneRuns} group runs`);
                  } else if (newBadgeCategory === 'activity' || newBadgeCategory === 'walking') {
                    setNewBadgeDesc(`Completed ${triggerActivityThreshold} group ${triggerActivityType === 'walking' ? 'walks' : 'runs'} with the crew!`);
                    setNewBadgeReq(`Every ${triggerActivityThreshold} ${triggerActivityType === 'walking' ? 'walking' : 'running'} check-ins`);
                  } else if (newBadgeCategory === 'distance') {
                    const distStr = typeof triggerDistanceChoice === 'number' ? `${triggerDistanceChoice.toFixed(1)} mi` : `${triggerDistanceChoice}`;
                    setNewBadgeDesc(`Completed ${triggerDistanceThreshold} ${distStr} routes with the club!`);
                    setNewBadgeReq(`${triggerDistanceThreshold} times completing ${distStr} route`);
                  } else if (newBadgeCategory === 'streak') {
                    setNewBadgeDesc(`Maintained an active ${triggerStreakWeeks}-week consecutive attendance streak!`);
                    setNewBadgeReq(`${triggerStreakWeeks}-week consecutive streak`);
                  }
                }}
                placeholder="e.g. St. Patrick's Day Run, 5-Mile Beast, 25-Run Club"
                className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* 3. Badge Category Selection */}
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">
                Achievement Category / Trigger Rule
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'special_event', label: '🌟 Special Event', desc: 'Adds to "Is Special Event?" dropdown' },
                  { id: 'milestone', label: '🏆 Runs Milestone', desc: 'Total runs reached (5, 25, 50...)' },
                  { id: 'activity', label: '🚶 Walk / 🏃 Run Pack', desc: 'Walk or run input count' },
                  { id: 'distance', label: '📍 Route Distance', desc: 'Route choices completed (e.g. 1.2 mi, 3.1 mi, 5.2 mi)' },
                  { id: 'pet', label: '🐕 Pet Run', desc: 'Running or walking with a pet (up to 10+)' },
                  { id: 'streak', label: '🔥 Streak', desc: 'Consecutive weekly runs' },
                  { id: 'attendance', label: '🦫 Attendance', desc: 'General attendance milestone' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      const catId = cat.id as BadgeCategory;
                      setNewBadgeCategory(catId);
                      if (newBadgeName) {
                        if (catId === 'special_event') {
                          setNewBadgeDesc(`Ran the annual ${newBadgeName} with the Woodchuckers at Blue Note!`);
                          setNewBadgeReq(`Attended the ${newBadgeName}`);
                        } else if (catId === 'milestone') {
                          setNewBadgeDesc(`Hit ${triggerMilestoneRuns} group runs with the Woodchuckers!`);
                          setNewBadgeReq(`${triggerMilestoneRuns} group runs`);
                        } else if (catId === 'activity') {
                          setNewBadgeDesc(`Completed ${triggerActivityThreshold} group walks/runs with the crew!`);
                          setNewBadgeReq(`Every ${triggerActivityThreshold} check-ins`);
                        } else if (catId === 'distance') {
                          const distStr = typeof triggerDistanceChoice === 'number' ? `${triggerDistanceChoice.toFixed(1)} mi` : `${triggerDistanceChoice}`;
                          setNewBadgeDesc(`Completed ${triggerDistanceThreshold} ${distStr} routes!`);
                          setNewBadgeReq(`${triggerDistanceThreshold} times completing ${distStr} route`);
                        } else if (catId === 'pet') {
                          setNewBadgeDesc(`Ran or walked the club route with your four-legged running buddy!`);
                          setNewBadgeReq(`Running or walking with a pet (multiplier up to ${triggerMaxMultiplier}+)`);
                        }
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      newBadgeCategory === cat.id
                        ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-xs'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight">{cat.label}</div>
                    <div className="text-[10px] text-stone-400 leading-tight mt-0.5">{cat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Category-Specific Fields */}
            <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl space-y-3">
              <span className="text-[11px] font-black uppercase text-amber-900 tracking-wider block">
                Trigger Criteria Configuration
              </span>

              {newBadgeCategory === 'special_event' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Special Event Identifier (Slug)
                    </label>
                    <input
                      type="text"
                      value={triggerSpecialSlug}
                      onChange={(e) => setTriggerSpecialSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. st_patricks"
                      className="w-full px-3 py-1.5 text-xs border rounded-lg font-mono bg-white outline-none"
                    />
                    <p className="text-[10px] text-stone-500 mt-0.5">
                      This will automatically appear as an option in the "Is Special Event?" dropdown when scheduling runs!
                    </p>
                  </div>
                </div>
              )}

              {newBadgeCategory === 'milestone' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Total Runs Required *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={triggerMilestoneRuns}
                      onChange={(e) => setTriggerMilestoneRuns(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Reward / Gear *
                    </label>
                    <input
                      type="text"
                      required
                      value={triggerMilestoneReward}
                      onChange={(e) => setTriggerMilestoneReward(e.target.value)}
                      placeholder="e.g. Club Pin / Pint Glass"
                      className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Perks / Brewery Benefit
                    </label>
                    <input
                      type="text"
                      value={triggerMilestonePerks}
                      onChange={(e) => setTriggerMilestonePerks(e.target.value)}
                      placeholder="e.g. $1 off beers at Blue Note"
                      className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {newBadgeCategory === 'activity' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Activity Input
                    </label>
                    <select
                      value={triggerActivityType}
                      onChange={(e) => setTriggerActivityType(e.target.value as ActivityType)}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                    >
                      <option value="walking">🚶 Walking Pack (Walks)</option>
                      <option value="running">🏃 Running Pack (Runs)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Check-Ins Count Threshold *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={triggerActivityThreshold}
                      onChange={(e) => setTriggerActivityThreshold(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                    />
                  </div>
                </div>
              )}

              {newBadgeCategory === 'distance' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Which Route Distance?
                    </label>
                    <select
                      value={triggerDistanceChoice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTriggerDistanceChoice(val);
                        setNewBadgeDesc(`Completed ${triggerDistanceThreshold} ${val} routes!`);
                        setNewBadgeReq(`${triggerDistanceThreshold} times completing ${val} route`);
                      }}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                    >
                      {routes && routes.length > 0 ? (
                        routes.map((r) => {
                          const mi = (Math.round(r.distanceMiles * 10) / 10).toFixed(1);
                          return (
                            <option key={r.id} value={`${mi} mi`}>
                              {mi} mi ({r.name})
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="1.2 mi">1.2 mi (The 123)</option>
                          <option value="3.1 mi">3.1 mi (Pine Ridge 5K)</option>
                          <option value="5.2 mi">5.2 mi (River Loop)</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Times Completed Required *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={triggerDistanceThreshold}
                      onChange={(e) => setTriggerDistanceThreshold(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                    />
                  </div>
                </div>
              )}

              {newBadgeCategory === 'streak' && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Consecutive Weekly Runs Required *
                  </label>
                  <input
                    type="number"
                    required
                    min={2}
                    value={triggerStreakWeeks}
                    onChange={(e) => setTriggerStreakWeeks(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                  />
                </div>
              )}

              {newBadgeCategory === 'pet' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">
                    Max Multiplier Cap (levels up each run with a pet)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={triggerMaxMultiplier}
                    onChange={(e) => setTriggerMaxMultiplier(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                  />
                  <p className="text-[10px] text-stone-500">
                    Runners level up this badge each time they check in with a pet, capped visually at {triggerMaxMultiplier}+ (e.g. x{triggerMaxMultiplier}+).
                  </p>
                </div>
              )}

              {/* Incremental Multiplier Toggle */}
              <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-stone-800 block">
                    Allow Incremental Level-Up Multiplier (x1, x2, x3...)
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Badges earn count tags when runners achieve/repeat this milestone (e.g. multiple Turkey Trots or every 10 walks).
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={newBadgeIncremental}
                  onChange={(e) => setNewBadgeIncremental(e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 5. Requirement and Description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Short Requirement Text *
                </label>
                <input
                  type="text"
                  required
                  value={newBadgeReq}
                  onChange={(e) => setNewBadgeReq(e.target.value)}
                  placeholder="e.g. 10 walking check-ins"
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Full Badge Description *
                </label>
                <input
                  type="text"
                  required
                  value={newBadgeDesc}
                  onChange={(e) => setNewBadgeDesc(e.target.value)}
                  placeholder="e.g. Completed 10 group walks with the walking pack!"
                  className="w-full px-3 py-2 text-xs border rounded-xl bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingBadge}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer font-display"
            >
              <Plus className="w-4 h-4" />
              <span>Create &amp; Activate Club Badge</span>
            </button>
          </form>
        </div>

        {/* Right 5 cols: Live Badge Preview & Directory */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Preview Card */}
          <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-woodland-950 text-white rounded-2xl p-5 shadow-md border border-stone-700 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-stone-700 pb-2">
              <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Live Badge Preview
              </span>
              <span className="text-[10px] text-stone-400">
                How it renders for runners
              </span>
            </div>

            <div className="p-3.5 bg-woodland-900/90 border border-woodland-500/60 rounded-xl flex items-start gap-3 shadow-sm">
              <span className="text-3xl shrink-0 mt-0.5">{newBadgeEmoji || '🏅'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-black text-sm text-white">
                    {newBadgeName || 'Sample Badge Name'}
                  </span>
                  {newBadgeIncremental && (
                    <span className="px-1.5 py-0.2 bg-amber-400 text-stone-950 font-black text-[10px] rounded-full shadow-xs">
                      x1
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-amber-300 font-bold mt-0.5">
                  {newBadgeReq || 'Badge requirement details'}
                </div>
                <p className="text-xs text-stone-300 mt-1 leading-snug">
                  {newBadgeDesc || 'This full description will show when runners inspect their achievements or unlock rewards during check-in.'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-white/10 text-stone-300">
                    Category: {newBadgeCategory}
                  </span>
                  {newBadgeCategory === 'special_event' && (
                    <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Active in Dropdowns
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed italic">
              Runners who meet this condition will automatically be awarded this badge at check-in time with celebratory confetti and notifications!
            </p>
          </div>

          {/* Special Events Quick Summary */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-3">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="font-extrabold text-xs text-stone-900 font-display uppercase tracking-wide flex items-center gap-1.5">
                <span>🌟</span>
                <span>Active Special Events ({specialEvents.length})</span>
              </h4>
              <span className="text-[10px] text-stone-400">Available in schedulers</span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {specialEvents.map((se) => (
                <div
                  key={se.id}
                  className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">{se.emoji}</span>
                    <div className="min-w-0">
                      <strong className="text-stone-900 font-bold block truncate">{se.name}</strong>
                      <span className="text-[10px] text-stone-500 font-mono">ID: {se.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {se.isDefault ? (
                      <span className="px-2 py-0.5 bg-stone-200 text-stone-700 text-[10px] font-bold rounded-full">
                        Built-in
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Delete custom special event "${se.name}"?`)) {
                            if (onDeleteBadge) await onDeleteBadge(se.badgeId);
                          }
                        }}
                        className="p-1 text-stone-400 hover:text-red-500 transition"
                        title="Delete custom special event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Directory of Club Badges */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h4 className="font-extrabold text-base text-stone-900 font-display">
              Club Badges Roster ({badges.length})
            </h4>
            <p className="text-xs text-stone-500">
              All active badges earned by runners across milestones, walking, routes, streaks, and special events.
            </p>
          </div>

          {/* Filter chips */}
          <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-semibold gap-1 flex-wrap">
            {['all', 'milestone', 'special_event', 'activity', 'distance', 'pet', 'streak'].map((f) => (
              <button
                key={f}
                onClick={() => setBadgeFilterCategory(f)}
                className={`px-2.5 py-1 rounded-lg transition capitalize text-xs ${
                  badgeFilterCategory === f
                    ? 'bg-white text-stone-900 shadow-xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {f === 'special_event' ? 'Special Events' : f === 'pet' ? '🐕 Pet Runs' : f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {badges
            .filter((b) => badgeFilterCategory === 'all' || b.category === badgeFilterCategory)
            .map((b) => (
              <div
                key={b.id}
                className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 flex flex-col justify-between hover:bg-stone-50/80 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl shrink-0">{b.emoji}</span>
                      <div>
                        <h5 className="font-bold text-sm text-stone-900 leading-snug">{b.name}</h5>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.2 rounded-full border border-amber-200">
                          {b.requirement}
                        </span>
                      </div>
                    </div>

                    {!b.isDefault && onDeleteBadge && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete badge "${b.name}"?`)) {
                            await onDeleteBadge(b.id);
                          }
                        }}
                        className="text-stone-400 hover:text-red-500 p-1"
                        title="Delete custom badge"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                    {b.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[10px] text-stone-400">
                  <span className="capitalize font-semibold text-stone-500">
                    Type: {b.category || 'badge'}
                  </span>
                  {b.isIncremental && (
                    <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Multiplier {b.maxMultiplier ? `(Max ${b.maxMultiplier}+)` : 'Enabled'}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
