import React, { useEffect, useMemo, useState } from 'react';
import { CheckInRecord, MilestoneAlert, RunEvent, UserProfile } from '../types';
import { Modal } from './Modal';
import { calculateAge } from '../utils/dateUtils';
import { runnerLookup } from '../utils/runnerLookup';
import { CheckCircle, ChevronDown, Gift, Phone, Search, Shirt, X } from 'lucide-react';

interface RunRosterModalProps {
  run: RunEvent;
  /** Live gear alerts (updated when one is marked handed out); merged over the ones loaded for this run. */
  alerts: MilestoneAlert[];
  users: UserProfile[];
  onLoadRoster: (runId: string) => Promise<{ checkins: CheckInRecord[]; alerts: MilestoneAlert[] }>;
  onFindUser: (email: string) => Promise<UserProfile | undefined>;
  onMarkFulfilled: (alertId: string, fulfilledBy: string) => Promise<void> | void;
  staffName: string;
  onClose: () => void;
}

/** Organizer tool for one run: who checked in, their emergency info, and the gear to hand out. */
export const RunRosterModal: React.FC<RunRosterModalProps> = ({ run, alerts: liveAlerts, users, onLoadRoster, onFindUser, onMarkFulfilled, staffName, onClose }) => {
  const [query, setQuery] = useState('');
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfile | null | 'loading' | 'error'>>({});
  const [busyAlert, setBusyAlert] = useState<string | null>(null);
  const [gearError, setGearError] = useState('');

  // Only this run's check-ins and gear are loaded, however old the run is.
  const [loaded, setLoaded] = useState<{ checkins: CheckInRecord[]; alerts: MilestoneAlert[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoaded(null); setLoadError(false);
    onLoadRoster(run.id).then((result) => { if (!cancelled) setLoaded(result); }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id, attempt]);

  const runner = useMemo(() => runnerLookup(users), [users]);
  // Live alert changes (handed out) win over the copy loaded when the window opened.
  const gear = useMemo(() => {
    const byId = new Map((loaded?.alerts || []).map((a) => [a.id, a]));
    for (const a of liveAlerts) if (a.runId === run.id) byId.set(a.id, a);
    return [...byId.values()];
  }, [loaded, liveAlerts, run.id]);
  // Runners who reached a milestone come first (gear still to hand out before handed out), then by check-in time.
  const forRun = useMemo(() => {
    const rank = new Map<string, number>();
    for (const a of gear) rank.set(a.userEmail.toLowerCase(), Math.min(rank.get(a.userEmail.toLowerCase()) ?? 2, a.fulfilled ? 1 : 0));
    return [...(loaded?.checkins || [])].sort((a, b) =>
      (rank.get(a.userEmail.toLowerCase()) ?? 2) - (rank.get(b.userEmail.toLowerCase()) ?? 2) || a.time.localeCompare(b.time));
  }, [loaded, gear]);
  const pending = gear.filter((a) => !a.fulfilled);
  const done = gear.filter((a) => a.fulfilled);
  const gearByEmail = new Map(gear.map((a) => [a.userEmail.toLowerCase(), a]));

  const q = query.trim().toLowerCase();
  const rows = forRun.filter((c) => !q || runner.name(c.userEmail, c.runnerName).toLowerCase().includes(q));

  const toggle = async (email: string) => {
    const key = email.toLowerCase();
    if (openEmail === key) { setOpenEmail(null); return; }
    setOpenEmail(key);
    if (profiles[key] && profiles[key] !== 'error') return;
    setProfiles((p) => ({ ...p, [key]: 'loading' }));
    try {
      const user = await onFindUser(key);
      setProfiles((p) => ({ ...p, [key]: user ?? null }));
    } catch {
      setProfiles((p) => ({ ...p, [key]: 'error' }));
    }
  };

  const handOut = async (alert: MilestoneAlert) => {
    setBusyAlert(alert.id);
    setGearError('');
    try {
      await onMarkFulfilled(alert.id, staffName);
    } catch {
      setGearError("Couldn't save that the gear was handed out. Please try again.");
    } finally {
      setBusyAlert(null);
    }
  };

  return (
    <Modal title={`Check-ins for ${run.title}`} onClose={onClose} className="fixed inset-0 z-[1000] overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-6">
        <div className="bg-gradient-to-r from-woodland-950 via-woodland-900 to-[#13495d] px-6 py-5 text-white relative">
          <button type="button" aria-label="Close window" onClick={onClose} className="absolute top-4 right-4 p-2 text-stone-300 hover:text-white rounded-full hover:bg-white/10 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-extrabold font-display pr-8">{run.title}</h2>
          <p className="text-xs text-woodland-200 mt-1">{run.date} · {run.time}{loaded ? ` · ${forRun.length} checked in` : ''}</p>
        </div>

        <div className="p-5 space-y-5">
          {/* Gear to hand out */}
          <section aria-label="Gear for this run" className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5"><Gift className="w-4 h-4" /> Milestones reached at this run ({gear.length})</h3>
            {gear.length === 0 && <p className="text-sm text-stone-500">No milestone gear from this run.</p>}
            {gearError && <p role="alert" className="text-sm text-amber-900">{gearError}</p>}
            {pending.map((a) => (
              <div key={a.id} className="rounded-2xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-stone-900">{runner.name(a.userEmail, a.runnerName)}</div>
                    <div className="text-xs text-stone-700">{a.milestoneName} · <strong>{a.reward}</strong></div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-amber-200 px-2 py-1 font-mono text-xs font-black text-stone-950">
                    <Shirt className="w-3.5 h-3.5" />{runner.shirtSize(a.userEmail, a.shirtSize)}
                  </span>
                </div>
                <button type="button" disabled={busyAlert === a.id} onClick={() => { void handOut(a); }} className="w-full rounded-xl bg-stone-950 py-2 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-stone-800 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />{busyAlert === a.id ? 'Saving…' : 'Mark handed out'}
                </button>
              </div>
            ))}
            {done.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate"><strong>{runner.name(a.userEmail, a.runnerName)}</strong> · {a.reward}</span>
                <span className="shrink-0 text-[11px] font-bold text-emerald-800">Handed out ✓</span>
              </div>
            ))}
          </section>

          {/* Checked-in runners */}
          <section aria-label="Checked-in runners" className="space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-stone-600">Checked in{loaded ? ` (${forRun.length})` : ''}</h3>
            <label className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm">
              <Search className="w-4 h-4 text-stone-400" />
              <input type="search" aria-label="Search checked-in runners" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a runner…" className="w-full outline-none" />
            </label>
            {!loaded && !loadError && <p role="status" className="text-sm text-stone-500">Loading check-ins…</p>}
            {loadError && <p role="alert" className="text-sm text-amber-900">Couldn't load this run's check-ins. <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-bold underline">Retry</button></p>}
            {loaded && forRun.length === 0 && <p className="text-sm text-stone-500">Nobody has checked in to this run yet.</p>}
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200">
              {rows.map((c) => {
                const email = c.userEmail.toLowerCase();
                const isOpen = openEmail === email;
                const profile = profiles[email];
                const alert = gearByEmail.get(email);
                const loaded = profile && profile !== 'loading' && profile !== 'error' ? profile : users.find((u) => u.email.toLowerCase() === email);
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => { void toggle(c.userEmail); }} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-stone-50 cursor-pointer">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-stone-900">
                          {runner.name(c.userEmail, c.runnerName) || 'Woodchuck Runner'}
                          {alert && <span className="ml-1.5 text-xs">{alert.fulfilled ? '🎁✓' : '🎁'}</span>}
                        </span>
                        <span className="block text-[11px] text-stone-500">{c.time.slice(0, 5)} · {c.activity}{c.routeName ? ` · ${c.routeName}` : ''}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 shrink-0 text-stone-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-1.5 bg-stone-50 px-3 pb-3 pt-1 text-sm">
                        {profile === 'loading' && <p role="status" className="text-stone-500">Loading profile…</p>}
                        {profile === 'error' && <p role="alert" className="text-amber-900">Couldn't load this profile. Tap the runner to retry.</p>}
                        {profile === null && <p className="text-stone-500">No profile found for this runner.</p>}
                        {loaded && (
                          <dl className="space-y-1.5">
                            <div className="rounded-xl border border-red-200 bg-white px-3 py-2">
                              <dt className="text-[10px] font-black uppercase tracking-wider text-red-700">Emergency contact</dt>
                              <dd className="text-stone-900">
                                {loaded.emergencyContact?.name || loaded.emergencyContact?.phone ? (
                                  <>
                                    {loaded.emergencyContact?.name && <span className="font-bold">{loaded.emergencyContact.name}</span>}
                                    {loaded.emergencyContact?.phone && (
                                      <a href={`tel:${loaded.emergencyContact.phone}`} className="ml-2 inline-flex items-center gap-1 font-bold text-woodland-800 underline"><Phone className="w-3.5 h-3.5" />{loaded.emergencyContact.phone}</a>
                                    )}
                                  </>
                                ) : <span className="text-stone-500">None on file</span>}
                              </dd>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-700">
                              <div><dt className="inline text-stone-500">Shirt: </dt><dd className="inline font-bold">{loaded.shirtSize}</dd></div>
                              <div><dt className="inline text-stone-500">Pace: </dt><dd className="inline font-bold">{loaded.preferredPace || '—'}</dd></div>
                              <div><dt className="inline text-stone-500">Age: </dt><dd className="inline font-bold">{calculateAge(loaded.birthday) ?? loaded.age ?? '—'}</dd></div>
                              <div><dt className="inline text-stone-500">Runs: </dt><dd className="inline font-bold">{loaded.totalRuns}</dd></div>
                              <div className="col-span-2 truncate"><dt className="inline text-stone-500">Email: </dt><dd className="inline font-mono">{loaded.email}</dd></div>
                            </div>
                          </dl>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </Modal>
  );
};
