import React, { useEffect, useState } from 'react';
import { 
  GPXRoute, 
  MeetupEvent, 
  CheckInRecord, 
  UserProfile, 
  LegacyMember,
  MilestoneAlert,
  Badge,
  SpecialEventDefinition,
  BadgeCategory,
  BadgeTriggerConfig,
  ActivityType,
  DistanceChoice
} from '../types';
import { INITIAL_BADGES, INITIAL_SPECIAL_EVENTS } from '../data/initialData';
import { ClubNotification } from '../services/notifications';
import { calculateAge } from '../utils/dateUtils';
import { ADMIN_EMAILS } from '../utils/roles';
import { isLegacyClaimed, matchLegacyNames } from '../utils/legacy';
import { RECENT_CHECKIN_DAYS } from '../services/storage';
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
  onMarkMilestoneFulfilled?: (alertId: string, fulfilledBy: string) => Promise<void> | void;
  onOpenNewRun?: () => void;
  onSendBroadcast: (title: string, body: string) => Promise<void> | void;
  onSetUserRole?: (email: string, role: AssignableRole) => Promise<void>;
  onSetLegacyClaim?: (legacyId: string, toEmail: string | null) => Promise<void>;
  onDeleteRunner?: (email: string) => Promise<void>;
  onImportLegacyData?: (
    totalsCsv: string,
    checkinsCsv: string,
    onProgress?: (msg: string) => void
  ) => Promise<{ names: number; events: number; duplicatesDropped: number; oldRuns: number }>;
  onReloadLegacyPool?: () => Promise<unknown>;
  onCountPushDevices?: () => Promise<number>;
  onDeleteAnnouncement?: (id: string) => Promise<void>;
}

type AssignableRole = 'member' | 'organizer' | 'admin';

const ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: 'member', label: 'Runner' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'admin', label: 'Admin' },
];

const ROLE_BADGE: Record<AssignableRole, string> = {
  member: 'bg-stone-100 text-stone-700',
  organizer: 'bg-cyan-100 text-cyan-800',
  admin: 'bg-amber-100 text-amber-800',
};

const effectiveRole = (u: UserProfile): AssignableRole =>
  ADMIN_EMAILS.includes(u.email.toLowerCase()) || u.role === 'admin'
    ? 'admin'
    : u.role === 'organizer'
      ? 'organizer'
      : 'member';

/** Searchable runner picker (the roster can get long). */
const RunnerPicker: React.FC<{
  users: UserProfile[];
  excludeEmail?: string;
  label: string;
  disabled?: boolean;
  onPick: (email: string) => void;
}> = ({ users, excludeEmail, label, disabled, onPick }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const matches = users
    .filter((u) => u.email !== excludeEmail)
    .filter((u) => !query || u.displayName.toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    .slice(0, 8);
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="px-2 py-1 text-[11px] font-semibold border rounded-lg bg-white hover:bg-stone-50 disabled:opacity-50"
      >
        {label}
      </button>
    );
  }
  return (
    <div className="relative w-52">
      <input
        type="search"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setQ('');
          }
        }}
        placeholder="Search runners…"
        aria-label="Search runners to assign"
        className="w-full px-2 py-1 text-[11px] border rounded-lg outline-none focus:ring-2 focus:ring-woodland-500"
      />
      <ul className="mt-1 w-full max-h-56 overflow-y-auto bg-white border border-stone-200 rounded-lg shadow-lg text-[11px]" role="listbox">
        {matches.length === 0 ? (
          <li className="px-2 py-1.5 text-stone-500 italic">No runners match</li>
        ) : (
          matches.map((u) => (
            <li key={u.email} role="option" aria-selected="false">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setQ('');
                  onPick(u.email);
                }}
                className="w-full text-left px-2 py-1.5 hover:bg-stone-100"
              >
                <span className="font-semibold text-stone-900">{u.displayName}</span>
                <span className="block text-stone-500 truncate">{u.email}</span>
              </button>
            </li>
          ))
        )}
        <li>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQ('');
            }}
            className="w-full text-left px-2 py-1.5 text-stone-500 hover:bg-stone-100 border-t border-stone-100"
          >
            Cancel
          </button>
        </li>
      </ul>
    </div>
  );
};

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
  onMarkMilestoneFulfilled,
  onOpenNewRun,
  onSendBroadcast,
  onSetUserRole,
  onSetLegacyClaim,
  onDeleteRunner,
  onImportLegacyData,
  onReloadLegacyPool,
  onCountPushDevices,
  onDeleteAnnouncement,
}) => {
  const [adminTab, setAdminTab] = useState<'events' | 'badges' | 'checkins' | 'milestones' | 'members' | 'notifications'>('events');
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | AssignableRole>('all');
  const [roleSaving, setRoleSaving] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<{ email: string; message: string } | null>(null);
  const [checkinFilterDate, setCheckinFilterDate] = useState<string>('all');
  const [notifTitle, setNotifTitle] = useState<string>('🦫 Run Tonight: Wednesday Code Word!');
  const [notifBody, setNotifBody] = useState<string>('Meet at 6:00 PM on Blue Note Brewing patio. Check-in is live!');
  const [broadcastSent, setBroadcastSent] = useState<boolean>(false);
  const [pushDeviceCount, setPushDeviceCount] = useState<number | null>(null);
  useEffect(() => {
    if (adminTab !== 'notifications' || !onCountPushDevices) return;
    onCountPushDevices()
      .then(setPushDeviceCount)
      .catch((err) => {
        console.warn('Counting push devices failed:', err);
        setPushDeviceCount(0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab]);

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
  const totalLegacyClaimed = legacyMembers.filter(isLegacyClaimed).length;

  // ---- Legacy (old app) claim pool ----
  const [legacySearch, setLegacySearch] = useState<string>('');
  const [legacyFilter, setLegacyFilter] = useState<'all' | 'claimed' | 'unclaimed'>('all');
  const [legacyBusyId, setLegacyBusyId] = useState<string | null>(null);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [legacyTotalsFile, setLegacyTotalsFile] = useState<File | null>(null);
  const [legacyCheckinsFile, setLegacyCheckinsFile] = useState<File | null>(null);
  const [legacyImportBusy, setLegacyImportBusy] = useState<boolean>(false);
  const [legacyImportMsg, setLegacyImportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (adminTab === 'members' && legacyMembers.length === 0 && onReloadLegacyPool) {
      onReloadLegacyPool().catch((err) => console.warn('Legacy pool load failed:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminTab]);

  const filteredLegacy = (() => {
    const byStatus = legacyMembers.filter((m) =>
      legacyFilter === 'all' ? true : legacyFilter === 'claimed' ? isLegacyClaimed(m) : !isLegacyClaimed(m)
    );
    return legacySearch.trim().length >= 2 ? matchLegacyNames(legacySearch, byStatus, 0.6) : byStatus;
  })();
  const visibleLegacy = filteredLegacy.slice(0, 150);
  const assignableUsers = [...users]
    .filter((u) => u.role !== 'guest' && u.email)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const handleLegacyAssign = async (leg: LegacyMember, toEmail: string | null) => {
    if (!onSetLegacyClaim) return;
    const target = toEmail ? users.find((u) => u.email === toEmail) : undefined;
    const message = toEmail
      ? `Assign ${leg.name} (${leg.totalRuns} runs) to ${target?.displayName || toEmail}?${leg.claimedByEmail ? ' It will be removed from its current runner.' : ''}`
      : `Unclaim ${leg.name}? Its ${leg.totalRuns} runs will be removed from that runner's total.`;
    if (!window.confirm(message)) return;
    setLegacyBusyId(leg.id);
    setLegacyError(null);
    try {
      await onSetLegacyClaim(leg.id, toEmail);
    } catch (err) {
      console.error('Legacy claim change failed:', err);
      setLegacyError(`Could not update ${leg.name}. Only admins can change claims.`);
    } finally {
      setLegacyBusyId(null);
    }
  };

  const handleLegacyImport = async () => {
    if (!onImportLegacyData || !legacyTotalsFile || !legacyCheckinsFile) return;
    setLegacyImportBusy(true);
    setLegacyImportMsg('Reading files…');
    try {
      const [totals, checkinsCsv] = await Promise.all([legacyTotalsFile.text(), legacyCheckinsFile.text()]);
      const stats = await onImportLegacyData(totals, checkinsCsv, setLegacyImportMsg);
      setLegacyImportMsg(
        `Imported ${stats.names} names, ${stats.events} sign-ins since 2021 (${stats.duplicatesDropped} double sign-ins dropped) and ${stats.oldRuns} pre-2021 runs.`
      );
    } catch (err: any) {
      console.error('Legacy import failed:', err);
      setLegacyImportMsg(`Import failed: ${err?.message || 'unknown error'}`);
    } finally {
      setLegacyImportBusy(false);
    }
  };
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
      (roleFilter === 'all' || effectiveRole(u) === roleFilter) &&
      (u.displayName.toLowerCase().includes(memberSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(memberSearch.toLowerCase()))
  );

  const roleCounts = users.reduce<Record<AssignableRole, number>>(
    (acc, u) => {
      acc[effectiveRole(u)] += 1;
      return acc;
    },
    { member: 0, organizer: 0, admin: 0 }
  );

  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ email: string; message: string } | null>(null);

  const handleDeleteRunner = async (u: UserProfile) => {
    if (!onDeleteRunner) return;
    const runnerCheckins = checkins.filter((c) => c.userEmail.toLowerCase() === u.email.toLowerCase()).length;
    const names = u.linkedLegacyNames || [];
    const checkinText = `${runnerCheckins} check-in${runnerCheckins === 1 ? '' : 's'}`;
    const unclaimText = names.length ? ` Their old names (${names.join(', ')}) become unclaimed.` : '';
    if (!window.confirm(`Delete ${u.displayName} (${u.email})?\n\nThis removes their profile, leaderboard row, ${checkinText}, gear alerts and RSVPs.${unclaimText} It can't be undone. They can sign up again with the same email.`)) {
      return;
    }
    setDeletingEmail(u.email);
    setDeleteError(null);
    try {
      await onDeleteRunner(u.email);
    } catch (err: any) {
      console.error('Delete runner failed:', err);
      setDeleteError({ email: u.email, message: err?.message?.startsWith('You') ? err.message : 'Could not delete. Only admins can delete runners.' });
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleRoleChange = async (u: UserProfile, next: AssignableRole) => {
    if (!onSetUserRole || next === effectiveRole(u)) return;
    const label = ROLE_OPTIONS.find((o) => o.value === next)?.label ?? next;
    const warning =
      next === 'admin'
        ? `Make ${u.displayName} an admin? Admins can change anyone's role, edit profiles and manage badges.`
        : effectiveRole(u) === 'admin'
          ? `Remove admin from ${u.displayName} and make them ${label === 'Runner' ? 'a runner' : 'an organizer'}?`
          : null;
    if (warning && !window.confirm(warning)) return;

    setRoleSaving(u.email);
    setRoleError(null);
    try {
      await onSetUserRole(u.email, next);
    } catch (err) {
      console.error('Role change failed:', err);
      setRoleError({ email: u.email, message: 'Could not change role. Only admins can change roles, and not their own.' });
    } finally {
      setRoleSaving(null);
    }
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
    const headers = ['Email', 'Display Name', 'Shirt Size', 'Birthday', 'Age', 'Total Runs', 'Pre-2021 Runs', 'Logged Runs', 'Total Miles', 'Runs Count', 'Walks Count', 'First Run Date', 'Linked Legacy Names'];
    const rows = users.map((u) => [
      u.email,
      `"${u.displayName}"`,
      u.shirtSize,
      u.birthday || '',
      calculateAge(u.birthday) ?? u.age ?? '',
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
    Promise.resolve(onSendBroadcast(notifTitle, notifBody))
      .then(() => {
        setBroadcastSent(true);
        setTimeout(() => setBroadcastSent(false), 4000);
      })
      .catch((err: any) => {
        console.error('Announcement failed:', err);
        alert(
          err?.code === 'permission-denied'
            ? 'Not posted: only admins can post announcements.'
            : "The announcement couldn't be posted. Please check your connection and try again."
        );
      });
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
          {/* Left: runs are the only place check-in events and code words are created */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
            <div className="border-b border-stone-100 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 font-display">Check-in Events &amp; Code Words</h3>
              <p className="text-xs text-stone-500">
                Each run has its own check-in event and code word. Create them with <strong>New Run</strong>, and change the code word from
                <strong> Edit Run</strong> until that run&apos;s check-in opens (2 hours before the start). Code words must be different for runs on the same day:
                the word tells the app which run a runner is checking into.
              </p>
            </div>
            {onOpenNewRun && (
              <button
                type="button"
                onClick={onOpenNewRun}
                className="flex items-center gap-2 px-4 py-2.5 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Run</span>
              </button>
            )}
          </div>

          {/* Right: Scheduled Events Roster */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>Meetups &amp; Active Code Words</span>
              </h4>
              {onOpenNewRun && (
                <button
                  type="button"
                  onClick={onOpenNewRun}
                  className="px-2.5 py-1 bg-woodland-700 hover:bg-woodland-800 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Run</span>
                </button>
              )}
            </div>

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
                Check-ins from the last {RECENT_CHECKIN_DAYS} days: date, runner, run/walk, distance choice and measured miles.
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
                          Promise.resolve(
                            onMarkMilestoneFulfilled(alert.id, currentUser?.displayName || currentUser?.email || 'Organizer')
                          ).catch((err) => {
                            console.error('Marking gear handed out failed:', err);
                            window.alert("Couldn't save that the gear was handed out. Please try again.");
                          });
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
                  Roster of registered runners, their roles, shirt sizes, lifetime miles, and claimed legacy records.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'all' | AssignableRole)}
                  aria-label="Filter by role"
                  className="px-2.5 py-1.5 text-xs border rounded-xl outline-none bg-white"
                >
                  <option value="all">All roles ({users.length})</option>
                  <option value="admin">Admins ({roleCounts.admin})</option>
                  <option value="organizer">Organizers ({roleCounts.organizer})</option>
                  <option value="member">Runners ({roleCounts.member})</option>
                </select>
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
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Email Key</th>
                    <th className="py-2.5 px-3">Shirt</th>
                    <th className="py-2.5 px-3">Total Runs</th>
                    <th className="py-2.5 px-3">Legacy Runs</th>
                    <th className="py-2.5 px-3">Lifetime Miles</th>
                    <th className="py-2.5 px-3">Run/Walk Split</th>
                    <th className="py-2.5 px-3">Claimed Past Aliases</th>
                    {onDeleteRunner && <th className="py-2.5 px-3"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.email} className="hover:bg-stone-50/70 transition">
                      <td className="py-2.5 px-3 font-bold text-stone-900">{u.displayName}</td>
                      <td className="py-2.5 px-3">
                        {(() => {
                          const role = effectiveRole(u);
                          const isOwner = ADMIN_EMAILS.includes(u.email.toLowerCase());
                          const isSelf = currentUser?.email?.toLowerCase() === u.email.toLowerCase();
                          if (isOwner || isSelf || !onSetUserRole) {
                            return (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 font-bold text-[10px] rounded-full ${ROLE_BADGE[role]}`}
                                title={isOwner ? 'Club owner account: always an admin' : isSelf ? "You can't change your own role" : undefined}
                              >
                                {role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                                {ROLE_OPTIONS.find((o) => o.value === role)?.label}
                                {isOwner ? ' · Owner' : isSelf ? ' · You' : ''}
                              </span>
                            );
                          }
                          return (
                            <div className="space-y-1">
                              <select
                                value={role}
                                disabled={roleSaving === u.email}
                                onChange={(e) => handleRoleChange(u, e.target.value as AssignableRole)}
                                aria-label={`Role for ${u.displayName}`}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg border border-transparent outline-none cursor-pointer disabled:opacity-50 ${ROLE_BADGE[role]}`}
                              >
                                {ROLE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                              {roleError?.email === u.email && (
                                <div className="text-[10px] text-red-600 font-semibold max-w-[180px]">{roleError.message}</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">{u.email}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 bg-stone-100 text-stone-800 font-mono font-bold rounded-md">
                          {u.shirtSize}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-amber-700">{u.totalRuns}</td>
                      <td className="py-2.5 px-3 font-mono text-stone-500" title="Pre-2021 runs + old-app sign-ins since 2021">
                        {u.pre2021Runs} + {u.legacyEventRuns || 0}
                      </td>
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
                      {onDeleteRunner && (
                        <td className="py-2.5 px-3">
                          {ADMIN_EMAILS.includes(u.email.toLowerCase()) ||
                          currentUser?.email?.toLowerCase() === u.email.toLowerCase() ? null : (
                            <div className="space-y-1">
                              <button
                                type="button"
                                disabled={deletingEmail === u.email}
                                onClick={() => handleDeleteRunner(u)}
                                aria-label={`Delete ${u.displayName}`}
                                title="Delete runner"
                                className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{deletingEmail === u.email ? 'Deleting…' : 'Delete'}</span>
                              </button>
                              {deleteError?.email === u.email && (
                                <div className="text-[10px] text-red-600 font-semibold max-w-[160px]">{deleteError.message}</div>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legacy Members Claim Pool */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
            <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 font-display">
                  Legacy Members Roster &amp; Claim Pool
                </h3>
                <p className="text-xs text-stone-500">
                  Sign-in names from the old app. A claimed name is locked to one runner; its pre-2021 runs and sign-ins since 2021 count toward their total.
                </p>
              </div>
              <span className="px-3 py-1 bg-stone-100 text-stone-700 text-xs font-bold rounded-full font-mono shrink-0">
                {totalLegacyClaimed} / {legacyMembers.length} Claimed
              </span>
            </div>

            {/* Import */}
            {onImportLegacyData && (
              <details className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs">
                <summary className="font-bold text-stone-800 cursor-pointer select-none">
                  Import old-app data (CSV)
                </summary>
                <div className="mt-3 space-y-3">
                  <p className="text-stone-600">
                    Upload the two exports from the old app. Re-importing keeps existing claims and recalculates those runners&apos; totals.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block font-semibold text-stone-700 mb-1">Totals file (Name, OldCounts)</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => setLegacyTotalsFile(e.target.files?.[0] || null)}
                        className="block w-full text-[11px]"
                      />
                    </label>
                    <label className="block">
                      <span className="block font-semibold text-stone-700 mb-1">Check-ins file (Name, Date, Time, Code Name)</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => setLegacyCheckinsFile(e.target.files?.[0] || null)}
                        className="block w-full text-[11px]"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!legacyTotalsFile || !legacyCheckinsFile || legacyImportBusy}
                      onClick={handleLegacyImport}
                      className="px-4 py-2 bg-woodland-700 hover:bg-woodland-800 disabled:opacity-40 text-white font-bold rounded-xl transition"
                    >
                      {legacyImportBusy ? 'Importing…' : 'Import'}
                    </button>
                    {legacyImportMsg && <span className="text-stone-700 font-semibold">{legacyImportMsg}</span>}
                  </div>
                </div>
              </details>
            )}

            {/* Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-400" />
                <input
                  type="text"
                  value={legacySearch}
                  onChange={(e) => setLegacySearch(e.target.value)}
                  placeholder="Search old names..."
                  aria-label="Search old names"
                  className="pl-8 pr-3 py-1.5 text-xs border rounded-xl outline-none"
                />
              </div>
              <select
                value={legacyFilter}
                onChange={(e) => setLegacyFilter(e.target.value as 'all' | 'claimed' | 'unclaimed')}
                aria-label="Filter by claim status"
                className="px-2.5 py-1.5 text-xs border rounded-xl outline-none bg-white"
              >
                <option value="all">All ({legacyMembers.length})</option>
                <option value="claimed">Claimed ({totalLegacyClaimed})</option>
                <option value="unclaimed">Unclaimed ({legacyMembers.length - totalLegacyClaimed})</option>
              </select>
              {legacyError && <span className="text-[11px] text-red-600 font-semibold">{legacyError}</span>}
            </div>

            {legacyMembers.length === 0 ? (
              <p className="text-xs text-stone-500 italic">No old-app names loaded yet. Import the CSV exports above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200">
                    <tr>
                      <th className="py-2 px-3">Old Name</th>
                      <th className="py-2 px-3">Pre-2021</th>
                      <th className="py-2 px-3">2021+</th>
                      <th className="py-2 px-3">Total</th>
                      <th className="py-2 px-3">Claimed By</th>
                      <th className="py-2 px-3">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {visibleLegacy.map((leg) => {
                      const claimer = leg.claimedByEmail
                        ? users.find((u) => u.email.toLowerCase() === leg.claimedByEmail!.toLowerCase())
                        : undefined;
                      const claimed = isLegacyClaimed(leg);
                      const busy = legacyBusyId === leg.id;
                      return (
                        <tr key={leg.id} className={claimed ? 'bg-emerald-50/40' : ''}>
                          <td className="py-2 px-3 font-bold text-stone-900">{leg.name}</td>
                          <td className="py-2 px-3 font-mono text-stone-600">{leg.oldCount}</td>
                          <td className="py-2 px-3 font-mono text-stone-600">{leg.newCount}</td>
                          <td className="py-2 px-3 font-mono font-black text-amber-700">{leg.totalRuns}</td>
                          <td className="py-2 px-3">
                            {claimed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-200/80 text-emerald-900 font-bold text-[10px] rounded-full">
                                <Check className="w-3 h-3" />
                                {claimer ? claimer.displayName : 'Unknown runner'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-stone-200 text-stone-600 font-semibold text-[10px] rounded-full">
                                Unclaimed
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {onSetLegacyClaim && (
                              <div className="flex items-center gap-2">
                                <RunnerPicker
                                  users={assignableUsers}
                                  excludeEmail={claimer?.email}
                                  label={claimed ? 'Reassign to…' : 'Assign to…'}
                                  disabled={busy}
                                  onPick={(email) => handleLegacyAssign(leg, email)}
                                />
                                {claimed && (
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => handleLegacyAssign(leg, null)}
                                    className="px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                  >
                                    Unclaim
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredLegacy.length > visibleLegacy.length && (
                  <p className="pt-2 text-[11px] text-stone-500">
                    Showing {visibleLegacy.length} of {filteredLegacy.length}. Search to narrow the list.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: PUSH ANNOUNCEMENTS */}
      {/* ============================================================== */}
      {adminTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2 bg-amber-50 rounded-2xl p-6 border border-amber-200 space-y-3 text-xs text-stone-700">
            <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-amber-600" />
              <span>Phone notifications</span>
            </h4>
            <p>
              <strong>{pushDeviceCount === null ? '…' : pushDeviceCount}</strong> device{pushDeviceCount === 1 ? ' has' : 's have'} notifications turned on
              (signed-in runners only). Being signed in isn&apos;t enough: each runner turns them on per device with{' '}
              <strong>Enable Alerts</strong> in the top banner, or in their profile menu under <strong>Notifications on this device</strong>.
              iPhones must add the app to their Home Screen first.
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Open{' '}
                <a
                  href="https://console.firebase.google.com/project/woodland-woodchuckers/messaging"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-woodland-700 underline"
                >
                  Firebase console → Messaging
                </a>{' '}
                and click <strong>New campaign → Notifications</strong>.
              </li>
              <li>Enter the title and text, then <strong>Next</strong>.</li>
              <li>Under <strong>Target</strong>, choose <strong>User segment</strong> and select the Woodchuckers <strong>web</strong> app.</li>
              <li>Schedule <strong>Now</strong> and <strong>Review → Publish</strong>.</li>
            </ol>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-4">
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-4 h-4 text-woodland-600" />
              <span>Post Announcement</span>
            </h4>
            <p className="text-xs text-stone-500">
              Posts to the in-app announcement feed. To reach phones, also send it from the Firebase console (see below).
            </p>

            {broadcastSent && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Posted to the in-app announcement feed.</span>
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
                  <span>Post Announcement</span>
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
                <p className="text-xs text-stone-400 py-4 text-center">No announcements posted yet.</p>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-stone-900 font-bold">{n.title}</strong>
                      <span className="flex items-center gap-2 text-[10px] text-stone-400">
                        {new Date(n.timestamp).toLocaleDateString()}
                        {onDeleteAnnouncement && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`Delete "${n.title}" from everyone's announcements?`)) return;
                              onDeleteAnnouncement(n.id).catch((err) => {
                                console.error('Deleting announcement failed:', err);
                                window.alert("Couldn't delete that announcement. Please try again.");
                              });
                            }}
                            aria-label={`Delete announcement ${n.title}`}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
