import { useEffect, useId, useRef, useState } from 'react';
import type { MeetupEvent, UserProfile } from '../types';
import type { AssistedCheckInInput } from '../utils/assistedCheckIn';
import type { StaffSearchResult } from '../services/store/staffLoading';
import { Modal } from './Modal';
import { checkInStatus } from '../utils/checkInWindow';
export function AssistedCheckInModal({ event, onSearch, onSave, onClose }: {
  event: MeetupEvent; onSearch: (term: string, role?: 'all', offset?: number) => Promise<StaffSearchResult>;
  onSave: (input: AssistedCheckInInput) => Promise<{ success: boolean; message: string }>; onClose: () => void;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState(''); const [offset, setOffset] = useState(0);
  const [matches, setMatches] = useState<StaffSearchResult>({ users: [], total: 0, hasMore: false });
  const [runner, setRunner] = useState<UserProfile>();
  const [route, setRoute] = useState(event.activeDistances?.[0] || Object.keys(event.routes)[0] || '');
  const [loops, setLoops] = useState(1); const [activity, setActivity] = useState<'running' | 'walking'>('running');
  const [pet, setPet] = useState(false); const [busy, setBusy] = useState(false); const [searching, setSearching] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 10000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    let active = true; setMatches({ users: [], total: 0, hasMore: false });
    if (query.trim().length < 2) { setSearching(false); return; }
    setSearching(true);
    const timer = window.setTimeout(() => { void onSearch(query, 'all', offset).then((result) => { if (active) setMatches(result); }).catch(() => { if (active) setError('Runner search failed. Retry or refresh the search.'); }).finally(() => { if (active) setSearching(false); }); }, 300);
    return () => { active = false; clearTimeout(timer); };
    // Search ops are recreated by the store; guard obsolete queries and role/session changes at the store too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, offset, attempt]);
  const option = event.routes[route];
  const open = checkInStatus(event, now) === 'open';
  const maxLoops = option?.isLoop ? Math.min(20, option.maxLoops || 4) : 1;
  const miles = option ? Math.round((loops > 1 ? option.baseMiles || option.actualMiles : option.actualMiles) * loops * 100) / 100 : 0;
  const submit = async () => {
    if (saving.current || !runner || !option || !open) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await onSave({ eventId: event.id, userEmail: runner.email, activity, distanceChoice: route, loops, withPet: pet });
      if (!result.success) throw new Error(result.message);
      setMessage(result.message); setRunner(undefined); setQuery(''); setOffset(0);
    } catch (err) { setError(err instanceof Error ? err.message : 'Check-in could not be confirmed. Retry safely; the runner will not be counted twice.'); }
    finally { saving.current = false; setBusy(false); }
  };
  return <Modal title="Assist a runner check-in" onClose={() => { if (!saving.current) onClose(); }} className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 p-4"><div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-white rounded-2xl p-5 space-y-4">
    <div className="flex justify-between gap-3"><h2 className="text-xl font-bold">Assist a runner check-in</h2><button type="button" disabled={busy} onClick={onClose} className="font-bold">Close</button></div>
    <p className="text-sm text-stone-600">{event.title} · {event.date}. Confirm the runner's identity and choices with them. Your staff account is recorded with this check-in.</p>
    {!open && <p role="alert" className="text-amber-900">The normal check-in window is closed. Assisted check-in cannot bypass it.</p>}
    <label className="block font-bold text-sm">Find a registered runner<input type="search" value={query} disabled={busy} onChange={(e) => { setQuery(e.target.value); setOffset(0); setRunner(undefined); setError(''); }} className="block w-full mt-2 border rounded-lg p-3 font-normal" placeholder="Search name or email" /></label>
    {searching && <p role="status">Searching all registered runners…</p>}
    {!searching && query.trim().length >= 2 && !matches.users.length && <p className="text-sm">No matching runners. First-time participants must join the club first.</p>}
    <ul className="space-y-2">{matches.users.filter((u) => !u.deleting && u.role !== 'guest').map((u) => <li key={u.email}><button type="button" disabled={busy} aria-pressed={runner?.email === u.email} onClick={() => { setRunner(u); setMessage(''); }} className={`w-full border rounded-lg p-3 text-left ${runner?.email === u.email ? 'bg-woodland-50 border-woodland-700' : ''}`}><strong>{u.displayName}</strong><span className="block text-xs text-stone-600">{u.email}</span></button></li>)}</ul>
    {query.trim().length >= 2 && <div className="flex justify-between text-sm"><button type="button" disabled={busy || searching || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 50))}>Previous matches</button><span>{matches.total} matches</span><button type="button" disabled={busy || searching || !matches.hasMore} onClick={() => setOffset((value) => value + 50)}>Next matches</button></div>}
    {runner && <fieldset disabled={busy} className="space-y-3 border rounded-xl p-4"><legend className="font-bold">Check in {runner.displayName}</legend>
      <div><label htmlFor={`${fieldId}-route`} className="block text-sm font-bold">Route</label><select id={`${fieldId}-route`} value={route} onChange={(e) => { setRoute(e.target.value); setLoops(1); }} className="block w-full mt-1 border rounded-lg p-2">{(event.activeDistances || Object.keys(event.routes)).map((id) => <option key={id} value={id}>{event.routes[id]?.name} · {event.routes[id]?.actualMiles} miles</option>)}</select></div>
      {maxLoops > 1 && <div><label htmlFor={`${fieldId}-loops`} className="block text-sm font-bold">Loops</label><select id={`${fieldId}-loops`} value={loops} onChange={(e) => setLoops(Number(e.target.value))} className="ml-2 border rounded p-2">{Array.from({ length: maxLoops }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></div>}
      <div><label htmlFor={`${fieldId}-activity`} className="block text-sm font-bold">Activity</label><select id={`${fieldId}-activity`} value={activity} onChange={(e) => setActivity(e.target.value as 'running' | 'walking')} className="ml-2 border rounded p-2"><option value="running">Running</option><option value="walking">Walking</option></select></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pet} onChange={(e) => setPet(e.target.checked)} />With a pet</label>
      <p className="text-sm">Confirm: <strong>{runner.displayName}</strong> · {miles.toFixed(2)} miles · {activity}{pet ? ' · With a pet' : ''}.</p>
      <button type="button" disabled={!open || !option || busy} onClick={() => void submit()} className="rounded-lg bg-woodland-700 px-4 py-2 text-white font-bold disabled:opacity-50">{busy ? 'Saving…' : 'Confirm assisted check-in'}</button>
    </fieldset>}
    {error && <p role="alert" className="text-sm text-red-800">{error} <button type="button" disabled={busy || searching} onClick={() => { setError(''); setAttempt((value) => value + 1); }} className="underline font-bold">Retry search</button></p>}
    {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{message}</p>}
  </div></Modal>;
}
