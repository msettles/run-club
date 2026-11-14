import { useMemo, useState } from 'react';
import type { CheckInRecord, MeetupEvent, MilestoneAlert, RunEvent } from '../types';
import { clubYmd } from '../utils/dateUtils';
import { checkInStatus, checkInWindow, formatOpening, isRunLive, eventStart } from '../utils/checkInWindow';
import { alertHasGear, alertsForRoster } from '../utils/milestones';
import { runNightCounts } from '../utils/runNight';
export function RunNightPage({ runs, events, checkins, alerts, now, staffName, loading, error, onRetry, onAssist, onEdit, onRoster, onFulfill }: {
  runs: RunEvent[]; events: MeetupEvent[]; checkins: CheckInRecord[]; alerts: MilestoneAlert[]; now: Date; staffName: string;
  loading: boolean; error?: string | null; onRetry: () => void; onAssist: (event: MeetupEvent) => void;
  onEdit: (run: RunEvent) => void; onRoster: (run: RunEvent) => void; onFulfill: (id: string, name: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState(''); const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(''); const [gearError, setGearError] = useState('');
  const available = runs.filter((r) => r.date >= clubYmd(now) && !r.deleting && isRunLive(r, events)).sort((a, b) => eventStart(a.date, a.time).getTime() - eventStart(b.date, b.time).getTime());
  const run = available.find((r) => r.id === selected) || available.find((r) => events.some((e) => e.id === r.id && checkInStatus(e, now) === 'open')) || available.find((r) => events.some((e) => e.id === r.id && checkInStatus(e, now) !== 'closed')) || available[0];
  const event = events.find((e) => e.id === run?.id);
  const attendance = useMemo(() => checkins.filter((c) => c.runId === run?.id).sort((a, b) => b.time.localeCompare(a.time)), [checkins, run?.id]);
  const counts = runNightCounts(attendance);
  const queue = run ? alertsForRoster(run.id, [], alerts, attendance.map((c) => c.userEmail)).filter((a) => !a.fulfilled) : [];
  const status = event ? checkInStatus(event, now) : undefined;
  const handOut = async (id: string) => {
    if (busy) return; setBusy(id); setGearError('');
    try { await onFulfill(id, staffName); } catch { setGearError('Could not save the handout. It remains in the queue; please retry.'); }
    finally { setBusy(''); }
  };
  return <section className="max-w-5xl mx-auto space-y-5">
    <div className="rounded-2xl bg-woodland-900 p-6 text-white"><h2 className="text-2xl font-bold">Run Night / Table Mode</h2><p className="mt-2 text-woodland-100">Live attendance, headcounts and gear pickup for the table team.</p></div>
    {loading && <p role="status">Loading tonight's run…</p>}
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-900">{error} <button type="button" onClick={onRetry} className="font-bold underline">Retry loading</button></p>}
    {!loading && !run && <p className="rounded-xl bg-white border p-5">No published run is scheduled. Create a run from the Runs page, then return here.</p>}
    {run && event && <>
      <label className="block text-sm font-bold">Table run<select value={run.id} onChange={(e) => { setSelected(e.target.value); setSearch(''); }} className="block w-full mt-2 rounded-xl border bg-white p-3">{available.map((r) => <option key={r.id} value={r.id}>{r.date} · {r.title}</option>)}</select></label>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[['Checked in', counts.total], ['Running', counts.running], ['Walking', counts.walking], ['With a pet', counts.pets]].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><dt className="text-sm text-stone-600">{label}</dt><dd className="text-3xl font-black text-woodland-900">{loading ? '…' : value}</dd></div>)}</dl>
      <div className="flex flex-wrap gap-2">{!loading && counts.routes.map((group) => <span key={group.id} className="rounded-full bg-woodland-100 px-3 py-1 text-xs font-bold">{group.name}: {group.count} ({group.running} running / {group.walking} walking)</span>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border bg-white p-4"><h3 className="font-bold">{run.title}</h3><p className="text-sm mt-1">{run.date} · {run.time} · {run.locationName}</p><p className="mt-3 font-bold">{status === 'open' ? 'Check-in is open' : status === 'closed' ? 'Check-in is closed' : `Check-in opens ${formatOpening(checkInWindow(event).opensAt)}`}</p><div className="flex flex-wrap gap-3 mt-3"><button type="button" onClick={() => onAssist(event)} disabled={status !== 'open' || Boolean(error) || loading} className="rounded-lg bg-woodland-700 px-4 py-2 text-white text-sm font-bold disabled:opacity-40">Assist check-in</button><button type="button" onClick={() => onRoster(run)} className="text-sm font-bold underline">Runner details</button></div></div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="font-bold text-sm">Tonight's code word · Staff only</h3><p className="text-3xl font-black tracking-widest mt-3 break-words">{event.codeWord || 'Loading…'}</p><p className="text-sm mt-3">{status === 'not_open' ? 'The code word can be changed before check-in opens.' : 'The code word is locked after check-in opens.'}</p>{status === 'not_open' && <button type="button" onClick={() => onEdit(run)} className="text-sm font-bold underline mt-2">Edit run / code word</button>}</div></div>
      <section className="rounded-xl border bg-white p-4 space-y-3"><h3 className="text-lg font-bold">Milestones & gear pickup</h3>{!loading && !queue.length && <p className="text-sm text-stone-500">No pending milestones for this run's attendees.</p>}{!loading && queue.map((alert) => <div key={alert.id} className="rounded-xl bg-amber-50 border border-amber-200 p-3"><p className="font-bold">{alert.runnerName} · {alert.milestoneName}</p><p className="text-sm">{alert.reward}{alertHasGear(alert) ? ` · Shirt size: ${alert.shirtSize || 'Not recorded'}` : ' · Recognition only; no gear to hand out'}</p>{alertHasGear(alert) && <button type="button" disabled={Boolean(busy)} onClick={() => void handOut(alert.id)} className="mt-2 rounded-lg bg-woodland-700 px-3 py-2 text-white text-sm font-bold disabled:opacity-40">{busy === alert.id ? 'Saving…' : 'Mark delivered'}</button>}</div>)}{gearError && <p role="alert" className="text-sm text-red-800">{gearError}</p>}</section>
      <section className="rounded-xl border bg-white p-4 space-y-3"><div className="flex flex-wrap gap-3 justify-between items-center"><h3 className="text-lg font-bold">Live check-in feed</h3><label className="text-sm">Find attendee<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="ml-2 rounded-lg border p-2" /></label></div>{!loading && !attendance.length && <p className="text-sm text-stone-500">Nobody has checked in yet.</p>}<ul className="divide-y">{!loading && attendance.filter((c) => !search || c.runnerName?.toLowerCase().includes(search.toLowerCase())).map((row) => <li key={row.id} className="py-3"><p className="font-bold">{row.runnerName || 'Registered runner'}{row.withPet ? ' 🐕' : ''}</p><p className="text-sm text-stone-600">{row.time} · {row.actualMiles.toFixed(2)} miles · {row.activity} · {row.routeName || 'Saved route'}{row.source === 'admin' ? ' · Organizer-assisted' : ''}</p></li>)}</ul></section>
    </>}
  </section>;
}
