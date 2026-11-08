import React, { useState } from 'react';
import { 
  RunEvent, 
  Member, 
  GPXRoute, 
  MeetupEvent, 
  CheckInRecord, 
  UserProfile, 
  LegacyMember,
  MilestoneAlert,
  SpecialEventType,
  Badge,
  SpecialEventDefinition,
  BadgeCategory,
  BadgeTriggerConfig,
  ActivityType,
  DistanceChoice
} from '../types';
import { INITIAL_BADGES, INITIAL_SPECIAL_EVENTS } from '../data/initialData';
import { ClubNotification } from '../services/notifications';
import { 
  Calendar, 
  Users, 
  Bell, 
  Download, 
  CheckCircle, 
  Send, 
  Search, 
  Key, 
  ShieldCheck, 
  Check, 
  FileText,
  Gift,
  Sparkles,
  Beer,
  Shirt,
  Clock,
  Award,
  Plus,
  Trash2,
  CheckCheck
} from 'lucide-react';

interface AdminDashboardProps {
  runs?: RunEvent[];
  members?: Member[];
  routes?: GPXRoute[];
  notifications: ClubNotification[];
  // Relational V2 props
  meetupEvents: MeetupEvent[];
  checkins: CheckInRecord[];
  users: UserProfile[];
  legacyMembers: LegacyMember[];
  milestoneAlerts?: MilestoneAlert[];
  currentUser?: UserProfile;
  badges?: Badge[];
  specialEvents?: SpecialEventDefinition[];
  onCreateBadge?: (badgeData: {
    name: string;
    emoji: string;
    description: string;
    requirement: string;
    category: BadgeCategory;
    isIncremental?: boolean;
    maxMultiplier?: number;
    triggerConfig: BadgeTriggerConfig;
    createSpecialEventOption?: boolean;
  }) => Promise<Badge>;
  onDeleteBadge?: (badgeId: string) => Promise<void>;
  onCreateSpecialEvent?: (name: string, emoji: string, description?: string) => Promise<SpecialEventDefinition>;
  onDeleteSpecialEvent?: (eventId: string) => Promise<void>;
  onSaveMeetupEvent: (event: MeetupEvent) => void;
  onMarkMilestoneFulfilled?: (alertId: string, fulfilledBy: string) => void;
  onOpenNewRun?: () => void;
  onEditRun?: (run: RunEvent) => void;
  onDeleteRun?: (runId: string) => void;
  onUpdateMemberStats?: (memberId: string, updates: Partial<Member>) => void;
  onSendBroadcast: (title: string, body: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  routes = [],
  notifications,
  meetupEvents,
  checkins,
  users,
  legacyMembers,
  milestoneAlerts = [],
  currentUser,
  badges = INITIAL_BADGES,
  specialEvents = INITIAL_SPECIAL_EVENTS,
  onCreateBadge,
  onDeleteBadge,
  onSaveMeetupEvent,
  onMarkMilestoneFulfilled,
  onSendBroadcast,
}) => {
  const [adminTab, setAdminTab] = useState<'events' | 'badges' | 'checkins' | 'milestones' | 'members' | 'notifications'>('events');
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [checkinFilterDate, setCheckinFilterDate] = useState<string>('all');
  const [notifTitle, setNotifTitle] = useState<string>('🦫 Run Tonight: Wednesday Code Word!');
  const [notifBody, setNotifBody] = useState<string>('Meet at 6:00 PM on Blue Note Brewing patio. Check-in is live!');
  const [broadcastSent, setBroadcastSent] = useState<boolean>(false);

  // Edit / Schedule Meetup Event State
  const defaultNextDate = '2026-11-18';
  const [eventDate, setEventDate] = useState<string>(defaultNextDate);
  const [eventTitle, setEventTitle] = useState<string>('Wednesday Woodchucker Meetup');
  const [eventCodeWord, setEventCodeWord] = useState<string>('WOODCHUCK');
  const [specialEvent, setSpecialEvent] = useState<SpecialEventType>('none');
  const [eventNotes, setEventNotes] = useState<string>('Weekly social run & post-run social on the patio.');
  
  // 1-Mile route state
  const [has1Mi, setHas1Mi] = useState<boolean>(true);
  const [name1Mi, setName1Mi] = useState<string>('Downtown Historic Stroll');
  const [miles1Mi, setMiles1Mi] = useState<number>(1.15);
  const [url1Mi, setUrl1Mi] = useState<string>('https://www.strava.com/routes/31201');
  const [dir1Mi, setDir1Mi] = useState<string>('East on Main St, loop at 1st St back to brewery.');

  // 3-Mile route state
  const [has3Mi, setHas3Mi] = useState<boolean>(true);
  const [name3Mi, setName3Mi] = useState<string>('Heritage Park Loop');
  const [miles3Mi, setMiles3Mi] = useState<number>(3.22);
  const [url3Mi, setUrl3Mi] = useState<string>('https://www.strava.com/routes/31203');
  const [dir3Mi, setDir3Mi] = useState<string>('East on Main, left on 3rd, through Heritage Park trail, back via Court St.');

  // 5-Mile route state
  const [has5Mi, setHas5Mi] = useState<boolean>(true);
  const [name5Mi, setName5Mi] = useState<string>('Spring Lake Trek');
  const [miles5Mi, setMiles5Mi] = useState<number>(5.12);
  const [url5Mi, setUrl5Mi] = useState<string>('https://www.strava.com/routes/31205');
  const [dir5Mi, setDir5Mi] = useState<string>('South on East St to Farmers Central, perimeter loop of Spring Lake, back on 6th St.');

  const [eventSavedToast, setEventSavedToast] = useState<boolean>(false);

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

  // Quick stats
  const totalCheckinsLogged = checkins.length;
  const totalLifetimeMiles = Math.round(users.reduce((sum, u) => sum + u.totalMiles, 0) * 10) / 10;
  const totalLegacyClaimed = legacyMembers.filter((m) => m.claimedByEmail !== null).length;
  const pendingMilestones = milestoneAlerts.filter((a) => !a.fulfilled);
  const fulfilledMilestones = milestoneAlerts.filter((a) => a.fulfilled);

  // Filtered checkins
  const filteredCheckins = checkins.filter((c) => {
    if (checkinFilterDate === 'all') return true;
    return c.date === checkinFilterDate;
  });

  // Filtered members
  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Handle saving the Meetup Event
  const handleSaveMeetup = (e: React.FormEvent) => {
    e.preventDefault();
    const activeDists: string[] = [];
    if (has1Mi) activeDists.push('1');
    if (has3Mi) activeDists.push('3');
    if (has5Mi) activeDists.push('5');

    if (activeDists.length === 0) {
      alert('Please activate at least one distance (1, 3, or 5 miles) for the run.');
      return;
    }

    const newEvent: MeetupEvent = {
      id: eventDate,
      date: eventDate,
      time: '06:00 PM',
      title: eventTitle,
      codeWord: eventCodeWord.trim().toUpperCase(),
      specialEvent,
      activeDistances: activeDists,
      routes: {
        ...(has1Mi && {
          '1': {
            name: name1Mi,
            actualMiles: miles1Mi,
            routeUrl: url1Mi,
            directions: dir1Mi,
          },
        }),
        ...(has3Mi && {
          '3': {
            name: name3Mi,
            actualMiles: miles3Mi,
            routeUrl: url3Mi,
            directions: dir3Mi,
          },
        }),
        ...(has5Mi && {
          '5': {
            name: name5Mi,
            actualMiles: miles5Mi,
            routeUrl: url5Mi,
            directions: dir5Mi,
          },
        }),
      },
      notes: eventNotes,
    };

    onSaveMeetupEvent(newEvent);
    setEventSavedToast(true);
    setTimeout(() => setEventSavedToast(false), 3000);
  };

  // Export CSV functions
  const exportCheckinsCSV = () => {
    const headers = ['Date', 'Time', 'User Email', 'Runner Name', 'Activity', 'With Pet', 'Loops', 'Distance Choice', 'Actual GPS Miles', 'Route Name', 'Source'];
    const rows = checkins.map((c) => [
      c.date,
      c.time,
      c.userEmail,
      `"${c.runnerName || ''}"`,
      c.activity,
      c.withPet ? 'Yes' : 'No',
      c.loops || 1,
      `${c.distanceChoice} mi`,
      c.actualMiles,
      `"${c.routeName || ''}"`,
      c.source,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(csvContent, 'woodchuckers-checkins-log.csv');
  };

  const exportUsersCSV = () => {
    const headers = ['Email', 'Display Name', 'Shirt Size', 'Total Runs', 'Pre-2021 Runs', 'Logged Runs', 'Total Miles', 'Runs Count', 'Walks Count', 'First Run Date', 'Linked Legacy Names'];
    const rows = users.map((u) => [
      u.email,
      `"${u.displayName}"`,
      u.shirtSize,
      u.totalRuns,
      u.pre2021Runs,
      u.loggedRuns,
      u.totalMiles,
      u.runCount,
      u.walkCount,
      u.firstRunDate || '',
      `"${(u.linkedLegacyNames || []).join('; ')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(csvContent, 'woodchuckers-users-profiles.csv');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) return;
    onSendBroadcast(notifTitle, notifBody);
    setBroadcastSent(true);
    setTimeout(() => setBroadcastSent(false), 4000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-stone-900 text-white rounded-2xl p-6 shadow-md border border-stone-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Organizer Administration Portal</span>
          </div>
          <h2 className="text-2xl font-black font-display tracking-tight text-white">
            Club Operations &amp; Event Management
          </h2>
          <p className="text-xs text-stone-300 mt-1">
            Define weekly code words, route maps, inspect the live check-in event log, and oversee legacy runner claims.
          </p>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 bg-stone-800 rounded-xl border border-stone-700 text-center">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Event Check-Ins</span>
            <span className="text-lg font-black font-mono text-amber-400">{totalCheckinsLogged}</span>
          </div>
          <div className="px-3.5 py-2 bg-stone-800 rounded-xl border border-stone-700 text-center">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Lifetime Miles</span>
            <span className="text-lg font-black font-mono text-emerald-400">{totalLifetimeMiles}</span>
          </div>
          <div className="px-3.5 py-2 bg-stone-800 rounded-xl border border-stone-700 text-center">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Legacy Claimed</span>
            <span className="text-lg font-black font-mono text-cyan-400">{totalLegacyClaimed}</span>
          </div>
        </div>
      </div>

      {/* Pending Milestone Alert Banner for Organizers */}
      {pendingMilestones.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 p-4 sm:p-5 rounded-2xl shadow-lg border border-amber-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-stone-950 text-amber-400 flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              🎁
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                <span>{pendingMilestones.length} Runner Milestone{pendingMilestones.length > 1 ? 's' : ''} Ready for Fulfillment Tonight!</span>
                <span className="px-2 py-0.5 bg-stone-950 text-amber-300 rounded-full text-[10px] font-bold">Action Needed</span>
              </div>
              <p className="text-xs font-semibold text-stone-900 mt-0.5">
                {pendingMilestones.map((m) => `${m.runnerName} (${m.milestoneName} • Size: ${m.shirtSize})`).join(' | ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdminTab('milestones')}
            className="px-4 py-2 bg-stone-950 hover:bg-stone-900 text-amber-300 font-extrabold text-xs rounded-xl shadow-md transition shrink-0 uppercase tracking-wider flex items-center gap-1.5"
          >
            <span>Fulfill Gear Queue</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="flex border-b border-stone-200 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setAdminTab('events')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition ${
            adminTab === 'events'
              ? 'bg-white text-stone-900 border-t-2 border-amber-500 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Key className="w-4 h-4 text-amber-500" />
          <span>Meetups &amp; Code Words</span>
        </button>

        <button
          onClick={() => setAdminTab('checkins')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition ${
            adminTab === 'checkins'
              ? 'bg-white text-stone-900 border-t-2 border-amber-500 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>Check-In Log ({checkins.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('milestones')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition relative ${
            adminTab === 'milestones'
              ? 'bg-white text-stone-900 border-t-2 border-amber-500 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Gift className="w-4 h-4 text-amber-500" />
          <span>Milestones &amp; Gear</span>
          {pendingMilestones.length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-stone-950 font-black text-[10px] rounded-full">
              {pendingMilestones.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAdminTab('badges')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition ${
            adminTab === 'badges'
              ? 'bg-white text-stone-900 border-t-2 border-amber-500 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Award className="w-4 h-4 text-amber-500" />
          <span>Badges &amp; Special Events ({badges.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition ${
            adminTab === 'members'
              ? 'bg-white text-stone-900 border-t-2 border-amber-500 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Users className="w-4 h-4 text-woodland-600" />
          <span>Runners &amp; Claims ({users.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition ${
            adminTab === 'notifications'
              ? 'bg-white text-stone-900 border-t-2 border-amber-500 shadow-xs'
              : 'text-stone-500 hover:text-stone-800'
          }`}
        >
          <Bell className="w-4 h-4 text-indigo-500" />
          <span>Push Alerts</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: MEETUPS & CODE WORDS */}
      {/* ============================================================== */}
      {adminTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Schedule Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 font-display">
                  Configure Scheduled Run Event
                </h3>
                <p className="text-xs text-stone-500">
                  Set today's secret code word, title, and select which 1, 3, and 5-mile routes are active tonight.
                </p>
              </div>
              {eventSavedToast && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg animate-in fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>Event Saved!</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveMeetup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Meetup Date *</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-xl font-bold bg-stone-50 focus:bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Event Code Word *</label>
                  <input
                    type="text"
                    required
                    value={eventCodeWord}
                    onChange={(e) => setEventCodeWord(e.target.value.toUpperCase())}
                    placeholder="e.g. TURKEY"
                    className="w-full px-3 py-2 text-sm border rounded-xl font-mono uppercase font-black text-amber-700 bg-amber-50/50 focus:bg-white outline-none tracking-wider"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">Is Special Event?</label>
                    <button
                      type="button"
                      onClick={() => setAdminTab('badges')}
                      className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-0.5 underline cursor-pointer"
                    >
                      <Plus className="w-3 h-3 inline" /> New Event/Badge
                    </button>
                  </div>
                  <select
                    value={specialEvent}
                    onChange={(e) => setSpecialEvent(e.target.value as SpecialEventType)}
                    className="w-full px-3 py-2 text-sm border rounded-xl font-bold bg-amber-50/70 border-amber-300 text-stone-900 outline-none"
                  >
                    <option value="none">None (Regular Run)</option>
                    {specialEvents.map((se) => (
                      <option key={se.id} value={se.id}>
                        {se.emoji} {se.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Event Title</label>
                  <input
                    type="text"
                    required
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Wednesday Woodchucker Meetup"
                    className="w-full px-3 py-2 text-sm border rounded-xl font-semibold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Meetup Notes &amp; Theme (Optional)</label>
                <input
                  type="text"
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="e.g. Wear orange/brown for Turkey Trot warmup!"
                  className="w-full px-3 py-2 text-sm border rounded-xl outline-none"
                />
              </div>

              {/* ROUTE DEFINITIONS */}
              <div className="space-y-3 pt-2">
                <span className="block text-xs font-extrabold text-stone-800 uppercase tracking-wider">
                  Active Routes For Tonight (At least one required):
                </span>

                {/* 1-MILE ROUTE */}
                <div className={`p-4 rounded-xl border transition ${has1Mi ? 'bg-stone-50 border-stone-300' : 'bg-stone-100/50 border-stone-200 opacity-60'}`}>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-900 mb-2">
                    <input
                      type="checkbox"
                      checked={has1Mi}
                      onChange={(e) => setHas1Mi(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>[✓] 1-Mile Option Active</span>
                  </label>
                  {has1Mi && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {routes && routes.length > 0 && (
                        <div className="sm:col-span-3 pb-1">
                          <select
                            onChange={(e) => {
                              const r = routes.find((x) => x.id === e.target.value);
                              if (r) {
                                setName1Mi(r.name);
                                setMiles1Mi(r.distanceMiles);
                                setUrl1Mi(r.externalLinks?.stravaUrl || r.externalLinks?.garminUrl || r.externalLinks?.rungoUrl || '');
                                if (r.directions && r.directions.length > 0) {
                                  setDir1Mi(r.directions.map((d) => `${d.step}. ${d.instruction_concise}`).join(' | '));
                                }
                              }
                            }}
                            className="text-xs px-2.5 py-1.5 border border-woodland-300 rounded-lg bg-woodland-50 text-woodland-900 font-semibold w-full"
                          >
                            <option value="">⚡ Autofill 1-Mile from Route Library...</option>
                            {routes.map((r) => (
                              <option key={r.id} value={r.id}>{r.name} ({r.distanceMiles} mi)</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <input
                        type="text"
                        value={name1Mi}
                        onChange={(e) => setName1Mi(e.target.value)}
                        placeholder="Route Name (e.g. Downtown Stroll)"
                        className="px-2.5 py-1.5 border rounded-lg bg-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={miles1Mi}
                        onChange={(e) => setMiles1Mi(parseFloat(e.target.value) || 1.0)}
                        placeholder="Actual GPS Miles (e.g. 1.15)"
                        className="px-2.5 py-1.5 border rounded-lg bg-white font-mono font-bold"
                      />
                      <input
                        type="text"
                        value={url1Mi}
                        onChange={(e) => setUrl1Mi(e.target.value)}
                        placeholder="Strava/Garmin Link"
                        className="px-2.5 py-1.5 border rounded-lg bg-white"
                      />
                      <div className="sm:col-span-3">
                        <textarea
                          rows={2}
                          value={dir1Mi}
                          onChange={(e) => setDir1Mi(e.target.value)}
                          placeholder="Turn-by-turn directions..."
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3-MILE ROUTE */}
                <div className={`p-4 rounded-xl border transition ${has3Mi ? 'bg-stone-50 border-stone-300' : 'bg-stone-100/50 border-stone-200 opacity-60'}`}>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-900 mb-2">
                    <input
                      type="checkbox"
                      checked={has3Mi}
                      onChange={(e) => setHas3Mi(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>[✓] 3-Mile Option Active</span>
                  </label>
                  {has3Mi && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {routes && routes.length > 0 && (
                        <div className="sm:col-span-3 pb-1">
                          <select
                            onChange={(e) => {
                              const r = routes.find((x) => x.id === e.target.value);
                              if (r) {
                                setName3Mi(r.name);
                                setMiles3Mi(r.distanceMiles);
                                setUrl3Mi(r.externalLinks?.stravaUrl || r.externalLinks?.garminUrl || r.externalLinks?.rungoUrl || '');
                                if (r.directions && r.directions.length > 0) {
                                  setDir3Mi(r.directions.map((d) => `${d.step}. ${d.instruction_concise}`).join(' | '));
                                }
                              }
                            }}
                            className="text-xs px-2.5 py-1.5 border border-woodland-300 rounded-lg bg-woodland-50 text-woodland-900 font-semibold w-full"
                          >
                            <option value="">⚡ Autofill 3-Mile from Route Library...</option>
                            {routes.map((r) => (
                              <option key={r.id} value={r.id}>{r.name} ({r.distanceMiles} mi)</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <input
                        type="text"
                        value={name3Mi}
                        onChange={(e) => setName3Mi(e.target.value)}
                        placeholder="Route Name (e.g. Heritage Park Loop)"
                        className="px-2.5 py-1.5 border rounded-lg bg-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={miles3Mi}
                        onChange={(e) => setMiles3Mi(parseFloat(e.target.value) || 3.0)}
                        placeholder="Actual GPS Miles (e.g. 3.22)"
                        className="px-2.5 py-1.5 border rounded-lg bg-white font-mono font-bold"
                      />
                      <input
                        type="text"
                        value={url3Mi}
                        onChange={(e) => setUrl3Mi(e.target.value)}
                        placeholder="Strava/Garmin Link"
                        className="px-2.5 py-1.5 border rounded-lg bg-white"
                      />
                      <div className="sm:col-span-3">
                        <textarea
                          rows={2}
                          value={dir3Mi}
                          onChange={(e) => setDir3Mi(e.target.value)}
                          placeholder="Turn-by-turn directions..."
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 5-MILE ROUTE */}
                <div className={`p-4 rounded-xl border transition ${has5Mi ? 'bg-stone-50 border-stone-300' : 'bg-stone-100/50 border-stone-200 opacity-60'}`}>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-900 mb-2">
                    <input
                      type="checkbox"
                      checked={has5Mi}
                      onChange={(e) => setHas5Mi(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>[✓] 5-Mile Option Active</span>
                  </label>
                  {has5Mi && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      {routes && routes.length > 0 && (
                        <div className="sm:col-span-3 pb-1">
                          <select
                            onChange={(e) => {
                              const r = routes.find((x) => x.id === e.target.value);
                              if (r) {
                                setName5Mi(r.name);
                                setMiles5Mi(r.distanceMiles);
                                setUrl5Mi(r.externalLinks?.stravaUrl || r.externalLinks?.garminUrl || r.externalLinks?.rungoUrl || '');
                                if (r.directions && r.directions.length > 0) {
                                  setDir5Mi(r.directions.map((d) => `${d.step}. ${d.instruction_concise}`).join(' | '));
                                }
                              }
                            }}
                            className="text-xs px-2.5 py-1.5 border border-woodland-300 rounded-lg bg-woodland-50 text-woodland-900 font-semibold w-full"
                          >
                            <option value="">⚡ Autofill 5-Mile from Route Library...</option>
                            {routes.map((r) => (
                              <option key={r.id} value={r.id}>{r.name} ({r.distanceMiles} mi)</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <input
                        type="text"
                        value={name5Mi}
                        onChange={(e) => setName5Mi(e.target.value)}
                        placeholder="Route Name (e.g. Spring Lake Trek)"
                        className="px-2.5 py-1.5 border rounded-lg bg-white"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={miles5Mi}
                        onChange={(e) => setMiles5Mi(parseFloat(e.target.value) || 5.0)}
                        placeholder="Actual GPS Miles (e.g. 5.12)"
                        className="px-2.5 py-1.5 border rounded-lg bg-white font-mono font-bold"
                      />
                      <input
                        type="text"
                        value={url5Mi}
                        onChange={(e) => setUrl5Mi(e.target.value)}
                        placeholder="Strava/Garmin Link"
                        className="px-2.5 py-1.5 border rounded-lg bg-white"
                      />
                      <div className="sm:col-span-3">
                        <textarea
                          rows={2}
                          value={dir5Mi}
                          onChange={(e) => setDir5Mi(e.target.value)}
                          placeholder="Turn-by-turn directions..."
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 font-black text-stone-950 text-xs rounded-xl shadow-md transition font-display uppercase tracking-wider"
                >
                  Save Scheduled Meetup
                </button>
              </div>
            </form>
          </div>

          {/* Right: Scheduled Events Roster */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Meetups &amp; Active Code Words</span>
            </h4>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
              {meetupEvents.map((evt) => (
                <div
                  key={evt.date}
                  className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <strong className="text-stone-900 font-bold">{evt.title}</strong>
                      {evt.specialEvent && evt.specialEvent !== 'none' && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] rounded-full uppercase flex items-center gap-1">
                          <span>
                            {specialEvents.find((se) => se.id === evt.specialEvent)?.emoji || '🌟'}
                          </span>
                          <span>
                            {specialEvents.find((se) => se.id === evt.specialEvent)?.name || evt.specialEvent}
                          </span>
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-stone-500">{evt.date}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-stone-500">Code Word:</span>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-950 font-mono font-bold rounded-md">
                      {evt.codeWord}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-stone-400">Distances:</span>
                    {evt.activeDistances.map((d) => {
                      const r = evt.routes[d];
                      return (
                        <span
                          key={d}
                          className="px-2 py-0.5 bg-stone-200 text-stone-800 font-bold text-[10px] rounded-full"
                        >
                          {r ? `${r.actualMiles} mi • ${r.name}` : `${d} Mi`}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: BADGES & SPECIAL EVENTS STUDIO */}
      {/* ============================================================== */}
      {adminTab === 'badges' && (
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
      )}
      {adminTab === 'checkins' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-stone-900 font-display">
                Check-In Single Entry Event Log
              </h3>
              <p className="text-xs text-stone-500">
                Every granular check-in record capturing date, runner, run/walk, distance choice, and actual measured GPS miles.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={checkinFilterDate}
                onChange={(e) => setCheckinFilterDate(e.target.value)}
                className="text-xs px-3 py-1.5 border rounded-xl bg-stone-50 font-bold outline-none"
              >
                <option value="all">All Dates ({checkins.length})</option>
                {Array.from(new Set(checkins.map((c) => c.date))).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <button
                onClick={exportCheckinsCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-xl transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Runner</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Activity</th>
                  <th className="py-2.5 px-3">Choice</th>
                  <th className="py-2.5 px-3">Actual Miles</th>
                  <th className="py-2.5 px-3">Route Name</th>
                  <th className="py-2.5 px-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-sans">
                {filteredCheckins.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-stone-400">
                      No check-ins recorded for this date filter.
                    </td>
                  </tr>
                ) : (
                  filteredCheckins.map((c) => (
                    <tr key={c.id} className="hover:bg-stone-50/70 transition">
                      <td className="py-2.5 px-3 font-mono text-stone-700">
                        {c.date} <span className="text-stone-400 text-[11px]">{c.time}</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-stone-900">{c.runnerName || 'Woodchuck Runner'}</td>
                      <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">{c.userEmail}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.activity === 'running' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {c.activity === 'running' ? '🏃 Running' : '🚶 Walking'}
                          </span>
                          {c.withPet && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title="Ran with a pet">
                              🐕 Pet
                            </span>
                          )}
                          {c.loops && c.loops > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-200" title={`${c.loops} loops completed`}>
                              🔄 {c.loops} Loops
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-stone-800">{c.distanceChoice} Mi</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-woodland-800">{c.actualMiles} mi</td>
                      <td className="py-2.5 px-3 text-stone-600 truncate max-w-xs">{c.routeName || 'Club Route'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 bg-stone-100 text-stone-600 text-[10px] rounded uppercase font-semibold">
                          {c.source}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB: MILESTONES & GEAR FULFILLMENT QUEUE */}
      {/* ============================================================== */}
      {adminTab === 'milestones' && (
        <div className="space-y-6">
          {/* Header & Stats */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Patio Gear Distribution</span>
                </div>
                <h3 className="font-extrabold text-lg text-stone-900 font-display">
                  Milestone Awards &amp; Gear Queue
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  When a runner checks into their 5th, 50th, 100th, or 200th run, an alert appears here with their shirt size so organizers can hand them their gear at Blue Note!
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Pending Handouts</span>
                  <span className="text-lg font-black font-mono text-amber-700">{pendingMilestones.length}</span>
                </div>
                <div className="px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">Fulfilled Awards</span>
                  <span className="text-lg font-black font-mono text-emerald-700">{fulfilledMilestones.length}</span>
                </div>
              </div>
            </div>

            {/* Club Milestone Rules Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 text-xs font-sans">
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <strong className="text-amber-800 font-black block">5 Runs:</strong>
                <span className="text-stone-700">Official Club Shirt + $1 off draft beers</span>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <strong className="text-amber-800 font-black block">50 Runs:</strong>
                <span className="text-stone-700">Woodchucker Running Hat</span>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <strong className="text-amber-800 font-black block">100 Runs:</strong>
                <span className="text-stone-700">Woodchucker Beer Mug</span>
              </div>
              <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <strong className="text-amber-800 font-black block">200 Runs:</strong>
                <span className="text-stone-700">Custom Name Water Bottle</span>
              </div>
            </div>
          </div>

          {/* SECTION 1: PENDING GEAR HANDOUTS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-600" />
              <span>Pending Gear to Deliver Tonight ({pendingMilestones.length})</span>
            </h4>

            {pendingMilestones.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                <h5 className="font-bold text-stone-800 text-sm">All Milestone Gear is Fulfilled!</h5>
                <p className="text-xs text-stone-500 max-w-md mx-auto">
                  When runners check into tonight's run and hit 5, 50, 100, or 200 runs, their name, milestone, and shirt size will automatically show up here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingMilestones.map((alert) => (
                  <div
                    key={alert.id}
                    className="bg-white rounded-2xl border-2 border-amber-400 p-5 shadow-md flex flex-col justify-between space-y-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 bg-amber-500 text-stone-950 font-black text-[10px] uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                      Pending Handout
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 text-stone-950 flex items-center justify-center font-bold text-2xl shadow-inner shrink-0 border border-amber-200">
                          {alert.milestoneRuns === 5 ? '👕' : alert.milestoneRuns === 50 ? '🧢' : alert.milestoneRuns === 100 ? '🍺' : '🍶'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                            {alert.milestoneName} ({alert.milestoneRuns} Runs)
                          </div>
                          <h4 className="text-lg font-black text-stone-900 font-display">
                            {alert.runnerName}
                          </h4>
                          <span className="text-xs text-stone-500 font-mono">
                            {alert.userEmail}
                          </span>
                        </div>
                      </div>

                      {/* Reward Details & Shirt Size Badge */}
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-600 font-medium">Reward:</span>
                          <strong className="text-stone-900 font-bold">{alert.reward}</strong>
                        </div>

                        {/* Shirt Size Highlight (Crucial for 5-run shirt!) */}
                        <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                          <span className="text-stone-700 font-bold flex items-center gap-1.5">
                            <Shirt className="w-4 h-4 text-amber-600" />
                            <span>Shirt Size on File:</span>
                          </span>
                          <span className="px-3 py-1 bg-amber-200 text-stone-950 font-black text-xs rounded-lg border border-amber-400 shadow-2xs font-mono">
                            {alert.shirtSize}
                          </span>
                        </div>

                        {alert.perks && (
                          <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-[11px] pt-1">
                            <Beer className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{alert.perks}</span>
                          </div>
                        )}

                        <div className="text-[10px] text-stone-400 pt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Checked in on {alert.date} at {alert.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button: Mark Handed Out */}
                    <button
                      onClick={() => {
                        if (onMarkMilestoneFulfilled) {
                          onMarkMilestoneFulfilled(alert.id, currentUser?.displayName || currentUser?.email || 'Organizer');
                        }
                      }}
                      className="w-full py-2.5 bg-stone-950 hover:bg-stone-800 text-amber-300 font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Mark Handed Out &amp; Delivered</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: COMPLETED HANDOUTS HISTORY */}
          {fulfilledMilestones.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-3">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Previously Fulfilled Awards ({fulfilledMilestones.length})</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 px-3">Runner</th>
                      <th className="py-2.5 px-3">Milestone</th>
                      <th className="py-2.5 px-3">Reward</th>
                      <th className="py-2.5 px-3">Shirt Size</th>
                      <th className="py-2.5 px-3">Check-In Date</th>
                      <th className="py-2.5 px-3">Fulfilled By</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-sans">
                    {fulfilledMilestones.map((f) => (
                      <tr key={f.id} className="hover:bg-stone-50/70 transition">
                        <td className="py-2.5 px-3 font-bold text-stone-900">{f.runnerName}</td>
                        <td className="py-2.5 px-3 font-semibold text-amber-800">{f.milestoneName}</td>
                        <td className="py-2.5 px-3 text-stone-700">{f.reward}</td>
                        <td className="py-2.5 px-3 font-mono font-bold">{f.shirtSize}</td>
                        <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">{f.date}</td>
                        <td className="py-2.5 px-3 text-stone-600 text-[11px]">{f.fulfilledBy || 'Organizer'}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Delivered</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: RUNNERS & LEGACY CLAIMS */}
      {/* ============================================================== */}
      {adminTab === 'members' && (
        <div className="space-y-6">
          {/* User Roster */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 font-display">
                  Active User Profiles (Keyed on Email)
                </h3>
                <p className="text-xs text-stone-500">
                  Roster of registered runners, their shirt sizes, lifetime miles, and claimed legacy records.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search runner or email..."
                    className="pl-8 pr-3 py-1.5 text-xs border rounded-xl outline-none"
                  />
                </div>
                <button
                  onClick={exportUsersCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-xl transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200">
                  <tr>
                    <th className="py-2.5 px-3">Runner</th>
                    <th className="py-2.5 px-3">Email Key</th>
                    <th className="py-2.5 px-3">Shirt</th>
                    <th className="py-2.5 px-3">Total Runs</th>
                    <th className="py-2.5 px-3">Old Counts</th>
                    <th className="py-2.5 px-3">Lifetime Miles</th>
                    <th className="py-2.5 px-3">Run/Walk Split</th>
                    <th className="py-2.5 px-3">Claimed Past Aliases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.email} className="hover:bg-stone-50/70 transition">
                      <td className="py-2.5 px-3 font-bold text-stone-900">{u.displayName}</td>
                      <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-800 font-mono font-bold rounded-md">
                          {u.shirtSize}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-amber-700">{u.totalRuns}</td>
                      <td className="py-2.5 px-3 font-mono text-stone-500">{u.pre2021Runs}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">{u.totalMiles} mi</td>
                      <td className="py-2.5 px-3 text-stone-500">
                        {u.runCount}R / {u.walkCount}W
                      </td>
                      <td className="py-2.5 px-3">
                        {(u.linkedLegacyNames && u.linkedLegacyNames.length > 0) ? (
                          <div className="flex gap-1 flex-wrap">
                            {u.linkedLegacyNames.map((leg) => (
                              <span key={leg} className="px-1.5 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] font-bold rounded">
                                {leg}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-300 italic text-[11px]">None linked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legacy Members Claim Pool */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
            <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 font-display">
                  Legacy Members Roster &amp; Claim Pool
                </h3>
                <p className="text-xs text-stone-500">
                  Historical runner entries available for self-service claiming during onboarding.
                </p>
              </div>
              <span className="px-3 py-1 bg-stone-100 text-stone-700 text-xs font-bold rounded-full font-mono">
                {totalLegacyClaimed} / {legacyMembers.length} Claimed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {legacyMembers.map((leg) => {
                const isClaimed = leg.claimedByEmail !== null;
                return (
                  <div
                    key={leg.id}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                      isClaimed ? 'bg-emerald-50/70 border-emerald-200' : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-stone-900">{leg.name}</div>
                      <div className="text-[10px] text-stone-500 font-mono">
                        {leg.totalRuns} past runs ({leg.newCount} logged + {leg.oldCount} old)
                      </div>
                    </div>

                    <div>
                      {isClaimed ? (
                        <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 font-bold text-[10px] rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Claimed</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-stone-200 text-stone-600 font-semibold text-[10px] rounded-full">
                          Unclaimed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: PUSH ANNOUNCEMENTS */}
      {/* ============================================================== */}
      {adminTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-4 h-4 text-woodland-600" />
              <span>Broadcast Web Push Notification</span>
            </h4>

            {broadcastSent && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Announcement broadcast to all installed PWA devices!</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Notification Title:
                </label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Alert Message:
                </label>
                <textarea
                  rows={3}
                  required
                  value={notifBody}
                  onChange={(e) => setNotifBody(e.target.value)}
                  className="w-full text-sm px-3 py-2 border rounded-xl outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Push Alert Now</span>
                </button>
              </div>
            </form>
          </div>

          {/* Broadcast History */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-amber-500" />
              <span>Announcement Feed</span>
            </h4>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-stone-400 py-4 text-center">No announcements broadcast yet.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-stone-900 font-bold">{n.title}</strong>
                      <span className="text-[10px] text-stone-400">
                        {new Date(n.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-stone-600 leading-relaxed">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
