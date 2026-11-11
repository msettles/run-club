import React, { useState } from 'react';
import { 
  CheckCircle, 
  Check, 
  Gift,
  Sparkles,
  Beer,
  Shirt,
  Clock,
} from 'lucide-react';
import type { AdminDashboardProps } from '../AdminDashboard';
import { runnerLookup } from '../../utils/runnerLookup';
import { alertHasGear } from '../../utils/milestones';

export const MilestonesTab: React.FC<AdminDashboardProps> = (props) => {
  const [mName, setMName] = useState('');
  const [mRuns, setMRuns] = useState('');
  const [mIcon, setMIcon] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mGear, setMGear] = useState('');
  const [mPerks, setMPerks] = useState('');
  const [milestoneError, setMilestoneError] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);
  const {
    milestoneAlerts = [],
    milestones = [],
    onCreateMilestone,
    onDeleteMilestone,
    users = [],
    currentUser,
    onMarkMilestoneFulfilled,
  } = props;
  // Names and sizes follow the runner's current profile, not the copy saved with the alert.
  const runner = runnerLookup(users);
  const currentShirtSize = (alert: { userEmail: string; shirtSize: string }) => runner.shirtSize(alert.userEmail, alert.shirtSize);
  const pendingMilestones = milestoneAlerts.filter((a) => !a.fulfilled && alertHasGear(a));
  const fulfilledMilestones = milestoneAlerts.filter((a) => a.fulfilled);

  return (
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
              When a runner reaches a milestone with gear, an alert appears here with their shirt size so organizers can hand them their gear at Blue Note. Milestones are separate from badges.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 bg-amber-50 rounded-xl border border-amber-200 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Pending Handouts</span>
              <span className="text-lg font-black font-mono text-amber-700">{pendingMilestones.length}</span>
            </div>
            <div className="px-3.5 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">Loaded Fulfilled Awards</span>
              <span className="text-lg font-black font-mono text-emerald-700">{fulfilledMilestones.length}</span>
            </div>
          </div>
        </div>

        {/* Club milestones (separate from badges) */}
        <div className="pt-4 space-y-2 text-xs font-sans">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-stone-600">Club milestones ({milestones.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-200">
                <span className="text-xl leading-none">{m.icon}</span>
                <div className="min-w-0 flex-1">
                  <strong className="text-amber-800 font-black block">{m.runsRequired} {m.runsRequired === 1 ? 'run' : 'runs'}: {m.name}</strong>
                  <span className="text-stone-700">{m.hasGear === false ? 'No gear (organizers see it as a welcome)' : m.reward}{m.perks ? ` · ${m.perks}` : ''}</span>
                </div>
                {!m.isDefault && onDeleteMilestone && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete the ${m.name} milestone? Alerts already created are kept.`)) {
                        onDeleteMilestone(m.id).catch(() => window.alert("Couldn't delete that milestone. Please try again."));
                      }
                    }}
                    className="text-[11px] font-bold text-red-700 hover:underline cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>

          {onCreateMilestone && (
            <form
              className="mt-2 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setMilestoneError('');
                setSavingMilestone(true);
                try {
                  await onCreateMilestone({ name: mName, runsRequired: Number(mRuns), icon: mIcon, description: mDesc, gear: mGear, perks: mPerks });
                  setMName(''); setMRuns(''); setMIcon(''); setMDesc(''); setMGear(''); setMPerks('');
                } catch (err) {
                  setMilestoneError(err instanceof Error ? err.message : 'Could not save the milestone.');
                } finally {
                  setSavingMilestone(false);
                }
              }}
            >
              <h5 className="text-xs font-black uppercase tracking-wider text-amber-900">Add a milestone</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs font-bold text-stone-700">Name *
                  <input required value={mName} onChange={(e) => setMName(e.target.value)} placeholder="e.g. 25 Runs Milestone" className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold" />
                </label>
                <label className="block text-xs font-bold text-stone-700">Total runs required *
                  <input required type="number" min={1} step={1} value={mRuns} onChange={(e) => setMRuns(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold" />
                </label>
                <label className="block text-xs font-bold text-stone-700">Icon (emoji)
                  <input value={mIcon} maxLength={8} onChange={(e) => setMIcon(e.target.value)} placeholder="🏆" className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs" />
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-stone-700">Gear to hand out
                  <input value={mGear} onChange={(e) => setMGear(e.target.value)} placeholder="e.g. Club pin. Leave blank for no gear" className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold" />
                </label>
                <label className="block text-xs font-bold text-stone-700">Perks (optional)
                  <input value={mPerks} onChange={(e) => setMPerks(e.target.value)} placeholder="e.g. $1 off beers at Blue Note" className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs" />
                </label>
              </div>
              <label className="block text-xs font-bold text-stone-700">Description
                <input value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="Shown to runners on the Milestones page" className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs" />
              </label>
              <p className="text-[11px] text-stone-500">With no gear, organizers still see the runner when they reach it, but there is nothing to hand out. Each run count can only be a milestone once.</p>
              {milestoneError && <p role="alert" className="text-xs font-semibold text-amber-900">{milestoneError}</p>}
              <button type="submit" disabled={savingMilestone} className="rounded-xl bg-stone-950 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
                {savingMilestone ? 'Saving…' : 'Add milestone'}
              </button>
            </form>
          )}
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
              When runners reach a milestone with gear, their name, milestone, and shirt size will automatically show up here.
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
                        {runner.name(alert.userEmail, alert.runnerName)}
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
                        {currentShirtSize(alert)}
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

      {props.onRefreshGearHistory && <button type="button" disabled={props.gearHistoryLoading} className="rounded border bg-white p-2 text-sm" onClick={() => { void props.onRefreshGearHistory?.().catch(() => {}); }}>Refresh fulfilled gear history</button>}
      {props.gearHistoryError && <p role="alert" className="text-sm text-amber-900">{props.gearHistoryError}</p>}
      {props.hasMoreGearHistory && <button type="button" disabled={props.gearHistoryLoading} className="rounded border bg-white p-2 text-sm" onClick={() => { void props.onLoadMoreGearHistory?.().catch(() => {}); }}>{props.gearHistoryLoading ? 'Loading fulfilled history…' : 'Load more fulfilled gear history'}</button>}
      {/* SECTION 2: COMPLETED HANDOUTS HISTORY */}
      {fulfilledMilestones.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 space-y-3">
          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Loaded Fulfilled Awards ({fulfilledMilestones.length})</span>
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
                    <td className="py-2.5 px-3 font-bold text-stone-900">{runner.name(f.userEmail, f.runnerName)}</td>
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
  );
};
