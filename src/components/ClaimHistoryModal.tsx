import { useEffect, useRef, useState } from 'react';
import type { LegacyMember, UserProfile } from '../types';
import { isLegacyClaimed, matchLegacyNames } from '../utils/legacy';
import { Modal } from './Modal';
export function ClaimHistoryModal({ user, onLoadPool, onClaim, onClose }: {
  user: UserProfile; onLoadPool: () => Promise<LegacyMember[]>;
  onClaim: (id: string) => Promise<{ user: UserProfile; rewardsPending: boolean }>; onClose: () => void;
}) {
  const [pool, setPool] = useState<LegacyMember[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LegacyMember>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const [latest, setLatest] = useState(user);
  const linked = [...new Set([...(user.linkedLegacyIds || []), ...(latest.linkedLegacyIds || [])])];
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    void onLoadPool().then((rows) => { if (active) setPool(rows); }).catch(() => { if (active) setError('Historical names could not be loaded. Retry to search.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // The dialog is keyed by signed-in email; refresh explicitly after every claim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.email, attempt]);
  const results = matchLegacyNames(query, pool.filter((row) => !isLegacyClaimed(row) && !linked.includes(row.id))).slice(0, 25);
  const claim = async (id: string) => {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await onClaim(id); setLatest(result.user); setSelected(undefined);
      setPool((rows) => rows.filter((row) => row.id !== id));
      setMessage(`History saved. Your total is ${result.user.totalRuns} runs.${result.rewardsPending ? ' Rewards could not finish refreshing; reload the app to retry.' : ' Rewards have been refreshed.'}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'The claim could not finish. Refresh and retry; a saved claim will not be counted twice.'); }
    finally { saving.current = false; setBusy(false); }
  };
  const pending = user.pendingLegacyClaim || latest.pendingLegacyClaim;
  return <Modal title="Claim historical runs" onClose={() => { if (!saving.current) onClose(); }} className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/60 p-4"><div className="max-w-xl w-full max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-5 space-y-4">
    <div className="flex justify-between gap-3"><h2 className="text-xl font-bold">Claim historical runs</h2><button type="button" disabled={busy} onClick={onClose} className="font-bold">Close</button></div>
    <p className="text-sm text-stone-600">Search names you used in the old club records. Claim only your own attendance. Ask an admin about a name already claimed by someone else.</p>
    <div className="rounded-xl bg-woodland-50 p-3"><h3 className="font-bold text-sm">Your linked names</h3><p className="text-sm mt-1">{[...new Set([...user.linkedLegacyNames, ...latest.linkedLegacyNames])].join(', ') || 'No historical names linked yet.'}</p></div>
    {pending && <div className="rounded-xl bg-amber-50 p-3 text-sm"><p>A saved claim needs to finish reconciling.</p><button type="button" disabled={busy} onClick={() => void claim(pending)} className="font-bold underline mt-2">Finish interrupted claim</button></div>}
    <label className="block text-sm font-bold">Search historical names<input type="search" value={query} disabled={busy} onChange={(e) => { setQuery(e.target.value); setSelected(undefined); }} placeholder="First name, surname or an old spelling" className="mt-2 w-full border rounded-lg p-3 font-normal" /></label>
    {loading && <p role="status">Loading historical names…</p>}
    {!loading && query.trim().length < 2 && <p className="text-sm text-stone-500">Enter at least two characters to search.</p>}
    {!loading && query.trim().length >= 2 && !results.length && <p className="text-sm">No available historical names match. Try another spelling or ask an admin.</p>}
    <ul className="space-y-2">{results.map((row) => <li key={row.id}><button type="button" disabled={busy || Boolean(pending)} onClick={() => setSelected(row)} aria-pressed={selected?.id === row.id} className={`w-full rounded-xl border p-3 text-left ${selected?.id === row.id ? 'border-woodland-700 bg-woodland-50' : ''}`}><span className="font-bold">{row.name}</span><span className="block text-sm text-stone-500">{row.oldCount} undated credits · {row.newCount} dated attendance records</span></button></li>)}</ul>
    {selected && <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2"><h3 className="font-bold">Claim {selected.name}?</h3><p className="text-sm">Adds {selected.oldCount} undated credits and up to {selected.newCount} dated runs. Shared dated runs already in your history count once. The exact new total is calculated when you confirm.</p><button type="button" disabled={busy || Boolean(pending)} onClick={() => void claim(selected.id)} className="rounded-lg bg-woodland-700 text-white px-4 py-2 font-bold disabled:opacity-50">{busy ? 'Saving claim…' : 'Confirm this is my history'}</button></div>}
    {error && <p role="alert" className="text-red-800 text-sm">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{message}</p>}
    <button type="button" disabled={busy || loading} onClick={() => { setSelected(undefined); setAttempt((value) => value + 1); }} className="text-sm font-bold underline">Refresh available names</button>
  </div></Modal>;
}
