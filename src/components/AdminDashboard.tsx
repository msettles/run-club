import React, { useState } from 'react';
import { 
  RunEvent, 
  Member, 
  GPXRoute, 
  MeetupEvent, 
  CheckInRecord, 
  UserProfile, 
  LegacyMember,
  MilestoneAlert
} from '../types';
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
  Clock
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
  onSaveMeetupEvent: (event: MeetupEvent) => void;
  onMarkMilestoneFulfilled?: (alertId: string, fulfilledBy: string) => void;
  onOpenNewRun?: () => void;
  onEditRun?: (run: RunEvent) => void;
  onDeleteRun?: (runId: string) => void;
  onUpdateMemberStats?: (memberId: string, updates: Partial<Member>) => void;
  onSendBroadcast: (title: string, body: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  notifications,
  meetupEvents,
  checkins,
  users,
  legacyMembers,
  milestoneAlerts = [],
  currentUser,
  onSaveMeetupEvent,
  onMarkMilestoneFulfilled,
  onSendBroadcast,
}) => {
  const [adminTab, setAdminTab] = useState<'events' | 'checkins' | 'milestones' | 'members' | 'notifications'>('events');
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
    const activeDists: ('1' | '3' | '5')[] = [];
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
    const headers = ['Date', 'Time', 'User Email', 'Runner Name', 'Activity', 'Distance Choice', 'Actual GPS Miles', 'Route Name', 'Source'];
    const rows = checkins.map((c) => [
      c.date,
      c.time,
      c.userEmail,
      `"${c.runnerName || ''}"`,
      c.activity,
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <strong className="text-stone-900 font-bold">{evt.title}</strong>
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
                    {evt.activeDistances.map((d) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 bg-stone-200 text-stone-800 font-bold text-[10px] rounded-full"
                      >
                        {d} Mi ({evt.routes[d]?.actualMiles || d} mi)
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CHECK-IN EVENT LOG */}
      {/* ============================================================== */}
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
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.activity === 'running' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {c.activity === 'running' ? '🏃 Running' : '🚶 Walking'}
                        </span>
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
