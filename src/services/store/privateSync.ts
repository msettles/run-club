import { resetStaffPages } from './staffLoading';
/** Live private data scoped to the signed-in account and role. */
import type { UserProfile, CheckInRecord, MilestoneAlert } from '../../types';
import { isFirebaseConfigured, db } from '../firebase';
import { collection, getDoc, doc, query, where, onSnapshot } from 'firebase/firestore';
import { recentCheckinCutoff } from './helpers';
import type { StoreState } from './state';
import type { createLegacyOps } from './legacy';

export function createPrivateSyncOps(ctx: StoreState & ReturnType<typeof createLegacyOps>) {
  const { setUsers, setMeetupEvents, staffCodeWords, privateSyncEpoch,
    privateUnsubscribers, setCheckins, setOwnLegacyEvents, setLegacyMembers,
    setMilestoneAlerts, fetchLegacyEvents, loadLegacyPool, setPrivateSyncError } = ctx;
  const stop = () => { privateUnsubscribers.current.splice(0).forEach((unsubscribe) => unsubscribe()); };

  const syncPrivateData = async (email: string, isStaff: boolean, _isAdmin = false) => {
    if (!isFirebaseConfigured || !db) return;
    stop();
    resetStaffPages(ctx);
    setUsers((previous) => previous.filter((user) => user.email.toLowerCase() === email.trim().toLowerCase()));
    setMilestoneAlerts([]);
    setPrivateSyncError(null);
    const epoch = ++privateSyncEpoch.current;
    const current = () => epoch === privateSyncEpoch.current;
    const firestore = db;
    const cleanEmail = email.trim().toLowerCase();
    const fail = (err: unknown) => {
      if (!current()) return;
      console.warn('Private subscription failed:', err);
      if ((err as { code?: string })?.code === 'permission-denied') {
        resetStaffPages(ctx);
        setUsers((prev) => prev.filter((u) => u.email.toLowerCase() === cleanEmail));
        setCheckins((prev) => prev.filter((c) => c.userEmail.toLowerCase() === cleanEmail));
        setMilestoneAlerts((prev) => prev.filter((a) => a.userEmail.toLowerCase() === cleanEmail));
        staffCodeWords.current = {};
        setMeetupEvents((prev) => prev.map((e) => ({ ...e, codeWord: '' })));
      }
      setPrivateSyncError('Your private club data could not be refreshed. Please retry loading.');
    };
    getDoc(doc(firestore, 'users', cleanEmail))
      .then((snap) => fetchLegacyEvents(snap.data()?.linkedLegacyIds || []))
      .then((events) => { if (current()) setOwnLegacyEvents(events); }).catch(fail);
    privateUnsubscribers.current.push(onSnapshot(doc(firestore, 'users', cleanEmail), (snap) => {
      if (!current()) return;
      const owner = snap.exists() ? snap.data() as UserProfile : undefined;
      setUsers((prev) => owner ? [owner, ...(isStaff ? prev.filter((u) => u.email.toLowerCase() !== cleanEmail) : [])] : []);
      if (owner) void ctx.syncMemberProjection(cleanEmail).catch(fail);
    }, fail));
    let own: CheckInRecord[] = [];
    let recent: CheckInRecord[] = [];
    const publishCheckins = () => {
      if (current()) setCheckins([...new Map([...recent, ...own].map((c) => [c.id, c])).values()]);
    };
    privateUnsubscribers.current.push(onSnapshot(query(collection(firestore, 'checkins'), where('userEmail', '==', cleanEmail)),
      (snap) => { own = snap.docs.map((d) => d.data() as CheckInRecord); publishCheckins(); }, fail));
    if (isStaff) {
      loadLegacyPool().catch(fail);
      privateUnsubscribers.current.push(onSnapshot(query(collection(firestore, 'checkins'), where('date', '>=', recentCheckinCutoff())),
        (snap) => { recent = snap.docs.map((d) => d.data() as CheckInRecord); publishCheckins(); }, fail));
      privateUnsubscribers.current.push(onSnapshot(collection(firestore, 'meetup_secrets'), (snap) => {
        if (!current()) return;
        const words = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().codeWord || '']));
        staffCodeWords.current = words;
        setMeetupEvents((prev) => prev.map((e) => ({ ...e, codeWord: words[e.id] || '' })));
      }, fail));
    }
    privateUnsubscribers.current.push(onSnapshot(isStaff ? query(collection(firestore, 'milestone_alerts'), where('fulfilled', '==', false)) : query(collection(firestore, 'milestone_alerts'), where('userEmail', '==', cleanEmail)),
      (snap) => { if (current()) setMilestoneAlerts((previous) => [...(isStaff ? previous.filter((alert) => alert.fulfilled) : []), ...snap.docs.map((d) => ({ ...d.data(), id: d.id }) as MilestoneAlert)]); }, fail));
  };
  const clearPrivateData = () => {
    if (!isFirebaseConfigured) return;
    privateSyncEpoch.current++;
    resetStaffPages(ctx);
    if (ctx.privateSessionEpoch) ctx.privateSessionEpoch.current++;
    setPrivateSyncError(null);
    stop();
    setUsers([]); setCheckins([]); setMilestoneAlerts([]); setOwnLegacyEvents([]); setLegacyMembers([]);
    staffCodeWords.current = {};
    setMeetupEvents((prev) => prev.map((e) => ({ ...e, codeWord: '' })));
  };
  return { syncPrivateData, clearPrivateData };
}
