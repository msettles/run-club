import React, { useState } from 'react';
import { RunEvent, Member, GPXRoute } from '../types';
import { ClubNotification } from '../services/notifications';
import { 
  ShieldCheck, 
  Calendar, 
  Users, 
  Bell, 
  Plus, 
  Edit3, 
  Trash2, 
  Download, 
  CheckCircle, 
  Send, 
  Search, 
  Flame,
  Smartphone
} from 'lucide-react';

interface AdminDashboardProps {
  runs: RunEvent[];
  members: Member[];
  routes: GPXRoute[];
  notifications: ClubNotification[];
  onOpenNewRun: () => void;
  onEditRun: (run: RunEvent) => void;
  onDeleteRun: (runId: string) => void;
  onUpdateMemberStats: (memberId: string, updates: Partial<Member>) => void;
  onSendBroadcast: (title: string, body: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  runs,
  members,
  notifications,
  onOpenNewRun,
  onEditRun,
  onDeleteRun,
  onUpdateMemberStats,
  onSendBroadcast,
}) => {
  const [adminTab, setAdminTab] = useState<'runs' | 'members' | 'notifications'>('runs');
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [notifTitle, setNotifTitle] = useState<string>('🦫 Run Tomorrow: Saturday Trail Loop!');
  const [notifBody, setNotifBody] = useState<string>('Meet at 8:00 AM at Creek Park. Hydration pack recommended.');
  const [broadcastSent, setBroadcastSent] = useState<boolean>(false);

  // Edit member modal state
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Quick stats
  const totalRunsLogged = members.reduce((sum, m) => sum + m.totalRuns, 0);
  const totalMilesLogged = Math.round(members.reduce((sum, m) => sum + m.totalMiles, 0) * 10) / 10;
  const totalCheckInsAcrossRuns = runs.reduce(
    (sum, r) => sum + r.attendees.filter((a) => a.checkedIn).length,
    0
  );

  // Filtered members
  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Export CSV functions
  const exportMembersCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Total Runs', 'Total Miles', 'Streak', 'Pace', 'Joined Date'];
    const rows = members.map((m) => [
      m.id,
      `"${m.name}"`,
      m.email,
      m.totalRuns,
      m.totalMiles,
      m.streak,
      `"${m.favoritePace}"`,
      m.joinedDate,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(csvContent, 'woodchuckers-membership-roster.csv');
  };

  const exportRunAttendanceCSV = (run: RunEvent) => {
    const headers = ['Member Name', 'Checked In', 'Checked In Time', 'RSVP Date'];
    const rows = run.attendees.map((a) => [
      `"${a.name}"`,
      a.checkedIn ? 'YES' : 'NO',
      a.checkedInAt || 'N/A',
      a.rsvpDate,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    downloadCSV(csvContent, `attendance-${run.id}.csv`);
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
    URL.revokeObjectURL(url);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifBody) return;
    onSendBroadcast(notifTitle, notifBody);
    setBroadcastSent(true);
    setTimeout(() => setBroadcastSent(false), 4000);
  };

  const setPresetBroadcast = (title: string, body: string) => {
    setNotifTitle(title);
    setNotifBody(body);
  };

  return (
    <div className="space-y-6">
      {/* Admin Header & KPI Cards */}
      <div className="bg-gradient-to-r from-stone-900 to-emerald-950 text-white rounded-2xl p-6 shadow-md border border-stone-800">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 rounded-xl shadow-inner">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Admin & Organizer Portal</h1>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  woodlandwoodchuckers@gmail.com
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Manage group runs, audit membership run counts, and blast push notifications to runners' phones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenNewRun}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Run</span>
            </button>
            <button
              onClick={exportMembersCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs rounded-xl border border-stone-700 transition"
              title="Export roster as CSV"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* KPI metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-800">
          <div className="bg-stone-800/60 p-3 rounded-xl border border-stone-700/60">
            <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Club Members</span>
            <span className="text-xl font-black text-white">{members.length}</span>
          </div>
          <div className="bg-stone-800/60 p-3 rounded-xl border border-stone-700/60">
            <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Member Runs Logged</span>
            <span className="text-xl font-black text-white">{totalRunsLogged}</span>
          </div>
          <div className="bg-stone-800/60 p-3 rounded-xl border border-stone-700/60">
            <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Total Run Check-Ins</span>
            <span className="text-xl font-black text-emerald-400">{totalCheckInsAcrossRuns}</span>
          </div>
          <div className="bg-stone-800/60 p-3 rounded-xl border border-stone-700/60">
            <span className="text-[11px] text-stone-400 uppercase tracking-wider block">Total Club Miles</span>
            <span className="text-xl font-black text-amber-400">{totalMilesLogged} mi</span>
          </div>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex border-b border-stone-200 bg-white px-4 rounded-xl shadow-xs">
        <button
          onClick={() => setAdminTab('runs')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
            adminTab === 'runs'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Runs & Schedules ({runs.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('members')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
            adminTab === 'members'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          <span>Membership & Run Counts ({members.length})</span>
        </button>

        <button
          onClick={() => setAdminTab('notifications')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
            adminTab === 'notifications'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Bell className="w-4 h-4 text-amber-500" />
          <span>Push Alerts & Announcements</span>
        </button>
      </div>

      {/* TAB A: RUNS MANAGEMENT */}
      {adminTab === 'runs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">All Scheduled & Past Group Runs</h3>
            <button
              onClick={onOpenNewRun}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Run Event</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500 border-b border-stone-200 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Run Title</th>
                  <th className="py-3 px-4">Distance & Surface</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">RSVPs / Check-Ins</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {runs.map((run) => {
                  const checkInCount = run.attendees.filter((a) => a.checkedIn).length;
                  return (
                    <tr key={run.id} className="hover:bg-stone-50/70 transition">
                      <td className="py-3.5 px-4 font-semibold text-stone-800 whitespace-nowrap">
                        {run.date} • {run.time}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-stone-900 line-clamp-1">{run.title}</div>
                        {run.completed && (
                          <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.2 rounded font-medium">
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-emerald-800">{run.distanceMiles} mi</span>{' '}
                        <span className="text-stone-400">({run.surface})</span>
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px] truncate text-stone-600">
                        {run.locationName}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-stone-800">{run.attendees.length} RSVPs</span>
                        {checkInCount > 0 && (
                          <span className="text-emerald-700 ml-1.5 font-bold">
                            ({checkInCount} checked in)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => exportRunAttendanceCSV(run)}
                            className="p-1.5 text-stone-500 hover:text-stone-800 rounded hover:bg-stone-100"
                            title="Export attendance CSV"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditRun(run)}
                            className="p-1.5 text-emerald-700 hover:text-emerald-900 rounded hover:bg-emerald-50"
                            title="Edit run details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete run "${run.title}"?`)) {
                                onDeleteRun(run.id);
                              }
                            }}
                            className="p-1.5 text-red-600 hover:text-red-800 rounded hover:bg-red-50"
                            title="Delete run"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB B: MEMBERSHIP & RUN COUNTS AUDIT */}
      {adminTab === 'members' && (
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Membership Run Counts & Mileage Roster</h3>
              <p className="text-xs text-stone-500">Review, audit, or adjust run counts and awards.</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={exportMembersCSV}
                className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-500 border-b border-stone-200 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Runner</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-center">Total Runs</th>
                  <th className="py-3 px-4 text-center">Total Miles</th>
                  <th className="py-3 px-4 text-center">Streak</th>
                  <th className="py-3 px-4">Badges</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-stone-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-stone-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-stone-200 overflow-hidden flex items-center justify-center text-xs">
                          {member.avatarUrl ? (
                            <img src={member.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            member.name.charAt(0)
                          )}
                        </div>
                        <span>{member.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-stone-500">{member.email}</td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-stone-900">
                      {member.totalRuns}
                    </td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-emerald-800">
                      {member.totalMiles} mi
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-amber-600">
                      <span className="inline-flex items-center gap-0.5">
                        <Flame className="w-3.5 h-3.5" /> {member.streak}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs">{member.unlockedBadgeIds.length} unlocked</span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick +1 Run button */}
                        <button
                          onClick={() => {
                            onUpdateMemberStats(member.id, {
                              totalRuns: member.totalRuns + 1,
                              totalMiles: Math.round((member.totalMiles + 5.0) * 10) / 10,
                            });
                          }}
                          className="px-2 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded text-[11px] font-semibold transition"
                          title="Quick +1 group run & +5 miles credit"
                        >
                          +1 Run
                        </button>

                        <button
                          onClick={() => setEditingMember(member)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-semibold transition"
                        >
                          Edit Stats
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB C: PUSH ALERTS & BROADCASTS */}
      {adminTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Push Broadcast Composer */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>Blast Push Notification to Runners' Phones</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Sends Web Push alert to all members who have the Woodland Woodchuckers PWA installed or alerts enabled.
              </p>
            </div>

            {broadcastSent && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Push alert sent to runners and logged in club announcement history!</span>
              </div>
            )}

            {/* Quick Templates */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Quick Template Presets:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPresetBroadcast(
                      '🦫 Run Tomorrow: Saturday Trail Loop!',
                      'Meet at 8:00 AM at Creek Park. Hydration pack recommended!'
                    )
                  }
                  className="text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-medium"
                >
                  ⏰ Saturday Morning Reminder
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPresetBroadcast(
                      '🌧️ Trail Alert: Route Adjusted for Mud',
                      'Due to rain, we will take the paved perimeter loop today. Meet at usual spot!'
                    )
                  }
                  className="text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-medium"
                >
                  🌧️ Weather / Mud Alert
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPresetBroadcast(
                      '🏁 Check-In is Now Open!',
                      'Woodchuckers check-in is live for today\'s run. Tap to log your attendance!'
                    )
                  }
                  className="text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-stone-700 font-medium"
                >
                  🏁 Run Day Check-In Open
                </button>
              </div>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Notification Title:
                </label>
                <input
                  type="text"
                  required
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g. 🦫 Run Tomorrow at 8:00 AM"
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  placeholder="Details, gear notes, parking directions..."
                  className="w-full text-sm px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Push Alert Now</span>
                </button>
              </div>
            </form>
          </div>

          {/* Broadcast History */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-3">
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

      {/* Edit Member Stats Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-stone-900">Edit Member Run Counts</h3>
              <button onClick={() => setEditingMember(null)} className="text-stone-400 hover:text-stone-700">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Runner Name</label>
                <input
                  type="text"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  className="w-full px-3 py-1.5 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Total Runs</label>
                  <input
                    type="number"
                    value={editingMember.totalRuns}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, totalRuns: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Total Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingMember.totalMiles}
                    onChange={(e) =>
                      setEditingMember({ ...editingMember, totalMiles: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-1.5 border rounded-lg font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Active Streak</label>
                <input
                  type="number"
                  value={editingMember.streak}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, streak: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-1.5 border rounded-lg font-bold"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t">
              <button
                onClick={() => setEditingMember(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onUpdateMemberStats(editingMember.id, {
                    name: editingMember.name,
                    totalRuns: editingMember.totalRuns,
                    totalMiles: editingMember.totalMiles,
                    streak: editingMember.streak,
                  });
                  setEditingMember(null);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
              >
                Save Stats
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
