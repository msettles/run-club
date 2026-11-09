import React, { useEffect, useState } from 'react';
import { 
  UserProfile, 
  LegacyMember,
} from '../../types';
import { calculateAge } from '../../utils/dateUtils';
import { ADMIN_EMAILS } from '../../utils/roles';
import { isLegacyClaimed, matchLegacyNames } from '../../utils/legacy';
import { 
  Download, 
  Search, 
  ShieldCheck, 
  Check, 
  Trash2,
} from 'lucide-react';
import type { AdminDashboardProps } from '../AdminDashboard';
import { RunnerPicker, ROLE_OPTIONS, ROLE_BADGE, effectiveRole, downloadCSV, type AssignableRole } from './shared';

export const MembersTab: React.FC<AdminDashboardProps> = (props) => {
  const {
    checkins,
    users,
    legacyMembers,
    currentUser,
    onSetUserRole,
    onSetLegacyClaim,
    onDeleteRunner,
    onImportLegacyData,
    onReloadLegacyPool,
  } = props;
  const totalLegacyClaimed = legacyMembers.filter(isLegacyClaimed).length;
  const [memberSearch, setMemberSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | AssignableRole>('all');
  const [roleSaving, setRoleSaving] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<{ email: string; message: string } | null>(null);
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
    if (legacyMembers.length === 0 && onReloadLegacyPool) {
      onReloadLegacyPool().catch((err) => console.warn('Legacy pool load failed:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
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
  );
};
