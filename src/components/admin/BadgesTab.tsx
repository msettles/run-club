import { formatMiles } from '../../utils/miles';
import React, { useState } from 'react';
import { 
  BadgeCategory,
  BadgeTriggerConfig,
  IncrementalCounter,
  DistanceChoice
} from '../../types';
import { 
  Sparkles,
  Plus,
  Trash2,
  CheckCheck
} from 'lucide-react';
import type { AdminDashboardProps } from '../AdminDashboard';
import { EmojiPicker } from './EmojiPicker';
import { emojiOwners } from '../../utils/emoji';
import { badgeFormFromBadge } from '../../utils/badgeForm';

const COUNTER_LABEL: Record<IncrementalCounter, { plural: string }> = {
  walks: { plural: 'walking check-ins' },
  runs: { plural: 'running check-ins' },
  pet: { plural: 'check-ins with a pet' },
  miles: { plural: 'miles' },
};

export const BadgesTab: React.FC<AdminDashboardProps> = (props) => {
  const {
    routes = [],
    badges = [],
    specialEvents = [],
    onCreateBadge,
    onUpdateBadge,
    onDeleteBadge,
    onInstallStarterCatalog,
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
  const [triggerCounter, setTriggerCounter] = useState<IncrementalCounter>('walks');
  const [triggerStep, setTriggerStep] = useState<number>(10);
  const [triggerDistanceChoice, setTriggerDistanceChoice] = useState<DistanceChoice>('3.1');
  const [triggerDistanceThreshold, setTriggerDistanceThreshold] = useState<number>(10);
  const [triggerStreakWeeks, setTriggerStreakWeeks] = useState<number>(4);
  const [triggerMaxDisplay, setTriggerMaxDisplay] = useState<string>(''); // blank = no cap
  const [badgeSavedToast, setBadgeSavedToast] = useState<string | null>(null);
  const [badgeFilterCategory, setBadgeFilterCategory] = useState<string>('all');
  const [isSubmittingBadge, setIsSubmittingBadge] = useState<boolean>(false);
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
  const [restoreNote, setRestoreNote] = useState('');

  const resetBadgeForm = () => {
    setEditingBadgeId(null); setNewBadgeName(''); setNewBadgeDesc(''); setNewBadgeReq(''); setNewBadgeEmoji('🏅');
    setNewBadgeCategory('special_event'); setNewBadgeIncremental(true); setTriggerSpecialSlug(''); setTriggerMaxDisplay('');
  };
  /** Load an existing badge into the form to edit it (any badge, including the starter ones). */
  const startEditBadge = (b: (typeof badges)[number]) => {
    const f = badgeFormFromBadge(b);
    setEditingBadgeId(b.id); setNewBadgeName(f.name); setNewBadgeEmoji(f.emoji); setNewBadgeDesc(f.description); setNewBadgeReq(f.requirement);
    setNewBadgeIncremental(f.incremental); setTriggerMaxDisplay(f.maxDisplay); setNewBadgeCategory(f.category);
    setTriggerCounter(f.counter); setTriggerStep(f.step); setTriggerSpecialSlug(f.specialSlug);
    setTriggerDistanceChoice(f.distanceChoice); setTriggerDistanceThreshold(f.distanceThreshold); setTriggerStreakWeeks(f.streakWeeks);
    document.getElementById('badge-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
              Create new "Is Special Event?" options, walking/running achievements, and route distance mastery badges. (Gear milestones are managed separately under Milestones & Gear.)
            </p>
          </div>
        </div>

        {onInstallStarterCatalog && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => { onInstallStarterCatalog().then((n) => setRestoreNote(n ? `Added back ${n} starter item${n === 1 ? '' : 's'}. Your edits were not touched.` : 'Every starter item is already saved.')).catch(() => setRestoreNote("Couldn't add the starter items. Please try again.")); }}
              className="text-[11px] font-bold text-amber-200 hover:text-white underline cursor-pointer"
            >
              Add back starter badges &amp; milestones
            </button>
            {restoreNote && <p role="status" className="mt-1 text-[11px] text-stone-300">{restoreNote}</p>}
          </div>
        )}

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
                {editingBadgeId ? 'Edit Club Badge' : 'Create New Club Badge or Special Event'}
              </h4>
              <p className="text-xs text-stone-500">
                Define the emoji, achievement rule, and automatic reward triggers.
              </p>
            </div>
            <span className="text-xs font-black px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full border border-amber-300">
              {editingBadgeId ? 'Editing' : 'New Badge'}
            </span>
          </div>

          <form
            id="badge-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newBadgeName.trim() || isSubmittingBadge) return;
              setIsSubmittingBadge(true);
              try {
                const triggerConfig: BadgeTriggerConfig = {
                  type: newBadgeCategory as BadgeTriggerConfig['type'],
                  isIncremental: newBadgeIncremental,
                };

                const categoryToSave: BadgeCategory = newBadgeCategory;

                if (newBadgeCategory === 'special_event') {
                  const slug = triggerSpecialSlug.trim() || newBadgeName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                  triggerConfig.specialEventId = slug;
                  triggerConfig.step = 1;
                } else if (newBadgeCategory === 'incremental') {
                  const step = Math.floor(Number(triggerStep));
                  if (!Number.isFinite(step) || step < 1) throw new Error('"Level up every" must be a whole number of 1 or more.');
                  triggerConfig.counter = triggerCounter;
                  triggerConfig.step = step;
                  triggerConfig.isIncremental = true;
                } else if (newBadgeCategory === 'distance') {
                  triggerConfig.distanceTier = triggerDistanceChoice;
                  triggerConfig.distanceCount = Number(triggerDistanceThreshold);
                  triggerConfig.step = Number(triggerDistanceThreshold);
                } else if (newBadgeCategory === 'streak') {
                  triggerConfig.streakWeeks = Number(triggerStreakWeeks);
                  triggerConfig.step = Number(triggerStreakWeeks);
                }

                const payload = {
                  name: newBadgeName.trim(),
                  emoji: newBadgeEmoji.trim() || '🏅',
                  description: newBadgeDesc.trim() || `Achievement badge for ${newBadgeName.trim()}`,
                  requirement: newBadgeReq.trim() || newBadgeName.trim(),
                  category: categoryToSave,
                  isIncremental: newBadgeCategory === 'incremental' ? true : newBadgeIncremental,
                  maxMultiplier: newBadgeCategory === 'incremental' && triggerMaxDisplay.trim() ? Math.floor(Number(triggerMaxDisplay)) : undefined,
                  triggerConfig,
                };
                if (editingBadgeId && onUpdateBadge) {
                  await onUpdateBadge(editingBadgeId, payload);
                } else if (onCreateBadge) {
                  await onCreateBadge({
                    name: newBadgeName.trim(),
                    emoji: newBadgeEmoji.trim() || '🏅',
                    description: newBadgeDesc.trim() || `Achievement badge for ${newBadgeName.trim()}`,
                    requirement: newBadgeReq.trim() || newBadgeName.trim(),
                    category: categoryToSave,
                    isIncremental: newBadgeCategory === 'incremental' ? true : newBadgeIncremental,
                    maxMultiplier: newBadgeCategory === 'incremental' && triggerMaxDisplay.trim() ? Math.floor(Number(triggerMaxDisplay)) : undefined,
                    triggerConfig,
                    createSpecialEventOption: newBadgeCategory === 'special_event',
                  });
                }

                setBadgeSavedToast(`${editingBadgeId ? 'Saved' : 'Created'} "${newBadgeName.trim()}" badge!`);
                setTimeout(() => setBadgeSavedToast(null), 4000);
                resetBadgeForm();
              } catch (err: any) {
                alert(err.message || 'Error creating badge');
              } finally {
                setIsSubmittingBadge(false);
              }
            }}
            className="space-y-4"
          >
            {/* 1. Emoji Selection Section */}
            <EmojiPicker value={newBadgeEmoji} onChange={setNewBadgeEmoji} title="Badge Emoji & Visual Symbol" required taken={emojiOwners(badges, props.milestones || [])} />

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
                  } else if (newBadgeCategory === 'incremental') {
                    setNewBadgeDesc(`Levels up every ${triggerStep} ${COUNTER_LABEL[triggerCounter].plural}!`);
                    setNewBadgeReq(`Every ${triggerStep} ${COUNTER_LABEL[triggerCounter].plural}`);
                  } else if (newBadgeCategory === 'distance') {
                    const distStr = typeof triggerDistanceChoice === 'number' ? `${triggerDistanceChoice.toFixed(1)} mi` : `${triggerDistanceChoice}`;
                    setNewBadgeDesc(`Completed ${triggerDistanceThreshold} ${distStr} routes with the club!`);
                    setNewBadgeReq(`${triggerDistanceThreshold} times completing ${distStr} route`);
                  } else if (newBadgeCategory === 'streak') {
                    setNewBadgeDesc(`Maintained an active ${triggerStreakWeeks}-week consecutive attendance streak!`);
                    setNewBadgeReq(`${triggerStreakWeeks}-week consecutive streak`);
                  }
                }}
                placeholder="e.g. St. Patrick's Day Run, 5-Mile Beast, Pet Pack"
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
                  { id: 'incremental', label: '🔼 Incremental', desc: 'Levels up every N walks, runs or pet check-ins (x2, x3…)' },
                  { id: 'distance', label: '📍 Route Distance', desc: 'Route choices completed (e.g. 1.2 mi, 3.1 mi, 5.2 mi)' },
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
                        } else if (catId === 'incremental') {
                          setNewBadgeDesc(`Levels up every ${triggerStep} ${COUNTER_LABEL[triggerCounter].plural}!`);
                          setNewBadgeReq(`Every ${triggerStep} ${COUNTER_LABEL[triggerCounter].plural}`);
                        } else if (catId === 'distance') {
                          const distStr = typeof triggerDistanceChoice === 'number' ? `${triggerDistanceChoice.toFixed(1)} mi` : `${triggerDistanceChoice}`;
                          setNewBadgeDesc(`Completed ${triggerDistanceThreshold} ${distStr} routes!`);
                          setNewBadgeReq(`${triggerDistanceThreshold} times completing ${distStr} route`);
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

              {newBadgeCategory === 'incremental' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">What to count</label>
                      <select
                        value={triggerCounter}
                        onChange={(e) => setTriggerCounter(e.target.value as IncrementalCounter)}
                        className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                      >
                        <option value="walks">🚶 Walking check-ins</option>
                        <option value="runs">🏃 Running check-ins</option>
                        <option value="pet">🐕 Check-ins with a pet</option>
                        <option value="miles">📏 Total miles</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Level up every *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        step={1}
                        value={triggerStep}
                        onChange={(e) => setTriggerStep(Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">Max display (optional)</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={triggerMaxDisplay}
                        onChange={(e) => setTriggerMaxDisplay(e.target.value)}
                        placeholder="No cap"
                        className="w-full px-3 py-1.5 text-xs border rounded-lg bg-white font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-500">
                    First earned at {triggerStep} {COUNTER_LABEL[triggerCounter].plural}, then it levels up every {triggerStep} more (x2, x3…).
                    {triggerMaxDisplay.trim() ? ` Levels above ${triggerMaxDisplay} show as ${triggerMaxDisplay}+ (${triggerMaxDisplay} itself shows as ${triggerMaxDisplay}).` : ' With no max, the level always shows its full number.'}
                  </p>
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
                          const mi = formatMiles(r.distanceMiles);
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

              {/* Incremental Multiplier Toggle (always on for Incremental badges) */}
              {newBadgeCategory !== 'incremental' && (
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
              )}
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
              <span>{editingBadgeId ? 'Save Changes' : 'Create & Activate Club Badge'}</span>
            </button>
            {editingBadgeId && (
              <button type="button" onClick={resetBadgeForm} className="w-full py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer">Cancel editing</button>
            )}
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
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Delete special event "${se.name}"?`) && onDeleteBadge) {
                            try {
                              await onDeleteBadge(se.badgeId);
                            } catch (err) {
                              console.error('Deleting special event failed:', err);
                              alert("The special event couldn't be deleted. Please check your connection and try again.");
                            }
                          }
                        }}
                        className="p-1 text-stone-400 hover:text-red-500 transition"
                        title="Delete special event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
            {['all', 'special_event', 'incremental', 'distance', 'streak'].map((f) => (
              <button
                key={f}
                onClick={() => setBadgeFilterCategory(f)}
                className={`px-2.5 py-1 rounded-lg transition capitalize text-xs ${
                  badgeFilterCategory === f
                    ? 'bg-white text-stone-900 shadow-xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {f === 'special_event' ? 'Special Events' : f === 'incremental' ? '🔼 Incremental' : f}
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

                    <div className="flex items-center gap-1">
                    {onUpdateBadge && (
                      <button type="button" onClick={() => startEditBadge(b)} className="text-[11px] font-bold text-woodland-800 hover:underline px-1 cursor-pointer" title="Edit badge">Edit</button>
                    )}
                    {onDeleteBadge && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Delete the "${b.name}" badge? Runners who earned it keep their record, but it no longer shows or counts.`)) {
                            try {
                              await onDeleteBadge(b.id);
                            } catch (err) {
                              console.error('Deleting badge failed:', err);
                              alert("The badge couldn't be deleted. Please check your connection and try again.");
                            }
                          }
                        }}
                        className="text-stone-400 hover:text-red-500 p-1"
                        title="Delete badge"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    </div>
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
                      Level-up {b.maxMultiplier ? `(shows up to ${b.maxMultiplier}+)` : '(no cap)'}
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
