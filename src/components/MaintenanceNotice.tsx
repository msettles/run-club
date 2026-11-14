import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../services/firebase';

function useMaintenance() {
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(!isFirebaseConfigured);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'settings', 'maintenance'), snapshot => {
      setActive(snapshot.data()?.active === true); setLoaded(true); setError('');
    }, () => { setLoaded(false); setError('Maintenance status could not be loaded. Retry when connected.'); });
  }, []);
  return { active, loaded, error };
}

export function MaintenanceNotice({ isAdmin }: { isAdmin: boolean }) {
  const { active } = useMaintenance();
  if (!active) return null;
  return <div role="status" className="bg-amber-100 border-b border-amber-300 px-4 py-3 text-sm text-amber-950">
    <strong>Club updates are in progress.</strong>{' '}
    {isAdmin ? 'Registration and member/organizer changes are paused. Admin import, reward rebuild and verification remain available.' : 'Registration, check-ins and profile or schedule changes are temporarily paused. You can still browse the club.'}
  </div>;
}

export function MaintenancePanel() {
  const { active, loaded, error } = useMaintenance();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const toggle = async () => {
    if (!db || !loaded || busy) return;
    setBusy(true); setProblem('');
    try { await setDoc(doc(db, 'settings', 'maintenance'), { active: !active, updatedAt: new Date().toISOString() }); }
    catch { setProblem('The pause could not be changed. Check your admin access and connection, then retry.'); }
    finally { setBusy(false); }
  };
  if (!isFirebaseConfigured) return null;
  return <section aria-label="Club maintenance" className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
    <h3 className="font-bold">Club maintenance: {loaded ? active ? 'paused' : 'open' : 'checking…'}</h3>
    <p className="text-sm">Pause registrations and all member/organizer changes while replacing history. Admins can still import and rebuild rewards. Keep the pause on if any step fails; resume only after checking counts, routes and owner access.</p>
    <button type="button" disabled={!loaded || busy} onClick={() => { void toggle(); }} className="rounded-lg bg-stone-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-40 cursor-pointer">{busy ? 'Saving…' : active ? 'Resume club changes' : 'Pause club changes'}</button>
    {(error || problem) && <p role="alert" className="text-sm text-red-700">{error || problem}</p>}
  </section>;
}
