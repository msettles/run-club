import type { StaffSearchResult, StaffSearchRole } from '../services/store/staffLoading';
import { roundMiles } from '../utils/miles';
import React, { useState } from 'react';
import { 
  GPXRoute, 
  MeetupEvent, 
  CheckInRecord, 
  UserProfile, 
  LegacyMember,
  MilestoneAlert,
  MilestoneReward,
  Badge,
  SpecialEventDefinition,
  BadgeCategory,
  BadgeTriggerConfig,
} from '../types';
import { INITIAL_BADGES } from '../data/catalog';
import { ClubNotification } from '../services/notifications';
import { isLegacyClaimed } from '../utils/legacy';
import { type AssignableRole } from './admin/shared';
import { EventsTab } from './admin/EventsTab';
import { BadgesTab } from './admin/BadgesTab';
import { CheckinsTab } from './admin/CheckinsTab';
import { MilestonesTab } from './admin/MilestonesTab';
import { runnerLookup } from '../utils/runnerLookup';
import { alertHasGear } from '../utils/milestones';
import { MembersTab } from './admin/MembersTab';
import { NotificationsTab } from './admin/NotificationsTab';
import { 
  Users, 
  Bell, 
  Key, 
  ShieldCheck, 
  FileText,
  Gift,
  Award,
} from 'lucide-react';

export interface AdminDashboardProps {
  onLoadPriorRuns?: () => Promise<void>;
  priorRunsLoading?: boolean;
  hasMorePriorRuns?: boolean;
  priorRunsError?: string | null;
  routes?: GPXRoute[];
  notifications: ClubNotification[];
  // Relational V2 props
  meetupEvents: MeetupEvent[];
  checkins: CheckInRecord[];
  onSearchStaffUsers?: (term: string, role?: StaffSearchRole, offset?: number) => Promise<StaffSearchResult>;
  staffRosterLoaded?: boolean;
  onRefreshStaffUsers?: () => Promise<void>;
  onRefreshGearHistory?: () => Promise<void>;
  onLoadMoreStaffUsers?: () => Promise<void>;
  onFindStaffUser?: (email: string) => Promise<UserProfile | undefined>;
  onExportStaffUsers?: () => Promise<UserProfile[]>;
  staffRosterLoading?: boolean;
  staffRosterError?: string | null;
  hasMoreStaffUsers?: boolean;
  onLoadMoreGearHistory?: () => Promise<void>;
  gearHistoryLoading?: boolean;
  gearHistoryError?: string | null;
  hasMoreGearHistory?: boolean;
  users: UserProfile[];
  legacyMembers: LegacyMember[];
  milestoneAlerts?: MilestoneAlert[];
  /** Club milestones (gear tiers); admins can add their own. Separate from badges. */
  milestones?: MilestoneReward[];
  onCreateMilestone?: (data: { name: string; runsRequired: number; icon: string; description: string; gear: string; perks?: string }) => Promise<unknown>;
  onDeleteMilestone?: (id: string) => Promise<void>;
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


export const AdminDashboard: React.FC<AdminDashboardProps> = (props) => {
  const {
    checkins,
    users,
    legacyMembers,
    milestoneAlerts = [],
    badges = INITIAL_BADGES,
  } = props;
  const [adminTab, setAdminTab] = useState<'events' | 'badges' | 'checkins' | 'milestones' | 'members' | 'notifications'>('events');

  // Quick stats
  const totalCheckinsLogged = checkins.length;
  const totalLifetimeMiles = roundMiles(users.reduce((sum, u) => sum + u.totalMiles, 0));
  const totalLegacyClaimed = legacyMembers.filter(isLegacyClaimed).length;
  // Recognition-only milestones (first run) are never a gear handout.
  const pendingMilestones = milestoneAlerts.filter((a) => !a.fulfilled && alertHasGear(a));




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
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Loaded Profile Miles</span>
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
                {pendingMilestones.map((m) => `${runnerLookup(users).name(m.userEmail, m.runnerName)} (${m.milestoneName} • Size: ${runnerLookup(users).shirtSize(m.userEmail, m.shirtSize)})`).join(' | ')}
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
          <span>Runners &amp; Claims ({users.length} loaded)</span>
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
      {adminTab === 'events' && <EventsTab {...props} />}

      {/* ============================================================== */}
      {/* TAB: BADGES & SPECIAL EVENTS STUDIO */}
      {/* ============================================================== */}
      {adminTab === 'badges' && <BadgesTab {...props} />}
      {adminTab === 'checkins' && <CheckinsTab {...props} />}

      {/* ============================================================== */}
      {/* TAB: MILESTONES & GEAR FULFILLMENT QUEUE */}
      {/* ============================================================== */}
      {adminTab === 'milestones' && <MilestonesTab {...props} />}

      {/* ============================================================== */}
      {/* TAB 3: RUNNERS & LEGACY CLAIMS */}
      {/* ============================================================== */}
      {adminTab === 'members' && <MembersTab {...props} />}

      {/* ============================================================== */}
      {/* TAB 4: PUSH ANNOUNCEMENTS */}
      {/* ============================================================== */}
      {adminTab === 'notifications' && <NotificationsTab {...props} />}
    </div>
  );
};
