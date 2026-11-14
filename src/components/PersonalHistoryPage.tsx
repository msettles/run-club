import { useEffect, useState } from 'react';
import type { GPXRoute, UserProfile } from '../types';
import type { PersonalHistoryRow } from '../utils/personalHistory';
import { runShareUrl } from '../utils/runLinks';
const PAGE_SIZE = 25;
export function PersonalHistoryPage({ user, onLoad, onLoadRecordedRoute, onViewRoute, onClaim }: {
  user: UserProfile; onLoad: () => Promise<PersonalHistoryRow[]>; onLoadRecordedRoute: (row: PersonalHistoryRow) => Promise<GPXRoute>;
  onViewRoute: (route: GPXRoute) => void; onClaim: () => void;
}) {
  const [rows, setRows] = useState<PersonalHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [routeBusy, setRouteBusy] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setRows([]); setPage(0);
    void onLoad().then((result) => { if (active) setRows(result); }).catch(() => { if (active) setError('Your run history could not be loaded. Please retry.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Reload on identity or attendance/claim changes; the loader is recreated by the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, user.totalRuns, user.lastCheckInUpdatedAt, user.linkedLegacyIds?.join(','), attempt]);
  const viewRoute = async (row: PersonalHistoryRow) => {
    setRouteBusy(row.id); setError('');
    try { onViewRoute(await onLoadRecordedRoute(row)); } catch { setError('The saved route could not be opened. Please retry.'); }
    finally { setRouteBusy(''); }
  };
  return <section className="max-w-4xl mx-auto space-y-5">
    <div className="rounded-2xl bg-woodland-900 text-white p-6"><h2 className="text-2xl font-bold">My Runs</h2><p className="mt-2">{user.totalRuns} lifetime runs · {user.totalMiles.toFixed(2)} miles</p><p className="text-sm text-woodland-100 mt-2">Your attendance from this app and your claimed historical names, with shared runs shown once.</p></div>
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4"><p className="font-bold">{user.pre2021Runs} undated historical credit{user.pre2021Runs === 1 ? '' : 's'}</p><p className="text-sm mt-1">These count toward your lifetime total but have no individual run dates. Older attendance may not include mileage, activity or route details.</p><button type="button" onClick={onClaim} className="mt-3 text-sm font-bold text-woodland-800 underline">Claim additional historical names</button></div>
    <div className="flex items-center justify-between"><p className="text-sm text-stone-600">{loading ? 'Loading attendance…' : `${rows.length} dated run${rows.length === 1 ? '' : 's'}`}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} disabled={loading} className="font-bold text-sm underline">Refresh history</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {loading && <p role="status">Loading your runs…</p>}
    {!loading && !error && !rows.length && <p className="rounded-xl bg-white border p-5">No dated attendance yet. Check in at a club run or claim your historical names.</p>}
    <ol className="space-y-3">{rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) => <li key={row.id} className="rounded-2xl bg-white border border-stone-200 p-4 space-y-2">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{row.title}</h3><span className="text-xs rounded-full bg-stone-100 px-2 py-1">{row.source === 'legacy' ? 'Claimed / imported history' : row.source === 'assisted' ? 'Organizer-assisted' : 'App check-in'}</span></div>
      <p className="text-sm text-stone-600"><time dateTime={row.date}>{row.date}</time>{row.time ? ` · ${row.time} (Woodland time)` : ''}</p>
      {row.miles !== undefined ? <p className="text-sm">{row.routeName || 'Saved run'} · {row.miles.toFixed(2)} miles{(row.loops || 1) > 1 ? ` · ${row.loops} loops` : ''}{row.activity ? ` · ${row.activity === 'walking' ? 'Walking' : 'Running'}` : ''}{row.withPet ? ' · With a pet' : ''}</p> : <p className="text-sm text-stone-500">Attendance recorded; route, mileage and activity details unavailable.</p>}
      <div className="flex gap-4 text-sm font-bold text-woodland-800">{row.runId && <a href={runShareUrl(row.runId, window.location.origin)} className="underline">View run</a>}{(row.routeId || (row.source !== 'legacy' && row.runId && row.routeChoice !== undefined)) && <button type="button" disabled={Boolean(routeBusy)} onClick={() => void viewRoute(row)} className="underline">{routeBusy === row.id ? 'Opening…' : 'View route'}</button>}</div>
    </li>)}</ol>
    {!loading && rows.length > PAGE_SIZE && <div className="flex justify-between items-center gap-3"><button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40">Previous</button><span className="text-sm">Page {page + 1} of {Math.ceil(rows.length / PAGE_SIZE)}</span><button type="button" disabled={(page + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage((value) => value + 1)} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40">Next</button></div>}
    <p className="text-xs text-stone-500">History is read-only. Ask a club admin about attendance corrections. Badge totals appear on Milestones; older records do not establish exactly which night a badge was earned.</p>
  </section>;
}
