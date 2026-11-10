import { collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { isAdminProfile, isStaffProfile } from '../../utils/roles';
import type { MilestoneAlert, UserProfile } from '../../types';
import type { StoreState } from './state';
export const STAFF_PAGE_SIZE = 50;
export type StaffSearchRole = 'all' | 'member' | 'organizer' | 'admin';
export interface StaffSearchResult { users: UserProfile[]; total: number; hasMore: boolean }
export interface StaffSearchCache { rows?: UserProfile[]; pending?: Promise<UserProfile[]>; expires: number }
export const newStaffSearchCache = (): StaffSearchCache => ({ expires: 0 });
const searchText = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
export function matchesStaffSearch(user: UserProfile, term: string, role: StaffSearchRole = 'all'): boolean {
  const actualRole = isAdminProfile(user) ? 'admin' : user.role === 'organizer' ? 'organizer' : 'member';
  const text = searchText([user.displayName, user.firstName, user.lastName, user.email].filter(Boolean).join(' '));
  return (role === 'all' || role === actualRole) && searchText(term).trim().split(/\s+/).every((word) => text.includes(word));
}
export interface StaffPage { cursor?: QueryDocumentSnapshot<DocumentData>; pending: boolean; complete: boolean }
export const newStaffPage = (complete = false): StaffPage => ({ pending: false, complete });

export function resetStaffPages(ctx: StoreState) {
  ctx.staffSearchCache.current = newStaffSearchCache();
  ctx.staffRosterPage.current = newStaffPage(!isFirebaseConfigured);
  ctx.gearHistoryPage.current = newStaffPage(!isFirebaseConfigured);
  ctx.setStaffRosterLoading(false); ctx.setStaffRosterError(null); ctx.setHasMoreStaffUsers(isFirebaseConfigured);
  ctx.setGearHistoryLoading(false); ctx.setGearHistoryError(null); ctx.setHasMoreGearHistory(isFirebaseConfigured);
}
function clearRevokedStaffData(ctx: StoreState) {
  resetStaffPages(ctx);
  const owner = ctx.currentUser.email.toLowerCase();
  ctx.setUsers((previous) => previous.filter((user) => user.email.toLowerCase() === owner));
  ctx.setMilestoneAlerts((previous) => previous.filter((alert) => alert.userEmail?.toLowerCase() === owner));
}
export function createStaffLoadingOps(ctx: StoreState) {
  const read = async <T>(operation: Promise<T>, current: () => boolean): Promise<T> => {
    try { return await operation; }
    catch (error) {
      if (current() && (error as { code?: string }).code === 'permission-denied') clearRevokedStaffData(ctx);
      throw error;
    }
  };
  const allowed = () => { if (!isStaffProfile(ctx.currentUser)) throw new Error('Staff access is required.'); };
  const page = async (kind: 'roster' | 'gear', reset = false) => {
    if (!db || !isFirebaseConfigured) return;
    allowed();
    const ref = kind === 'roster' ? ctx.staffRosterPage : ctx.gearHistoryPage;
    const state = ref.current;
    if (state.pending || state.complete) return;
    const epoch = ctx.privateSyncEpoch.current;
    const current = () => epoch === ctx.privateSyncEpoch.current && ref.current === state;
    const setLoading = kind === 'roster' ? ctx.setStaffRosterLoading : ctx.setGearHistoryLoading;
    const setError = kind === 'roster' ? ctx.setStaffRosterError : ctx.setGearHistoryError;
    state.pending = true; setLoading(true); setError(null);
    try {
      const filters = kind === 'roster' ? [] : [where('fulfilled', '==', true)];
      const snapshot = await getDocs(query(collection(db, kind === 'roster' ? 'users' : 'milestone_alerts'), ...filters, orderBy(documentId()), ...(state.cursor ? [startAfter(state.cursor)] : []), limit(STAFF_PAGE_SIZE + 1)));
      if (!current()) return;
      const documents = snapshot.docs.slice(0, STAFF_PAGE_SIZE);
      if (kind === 'roster') {
        const rows = documents.map((doc) => ({ ...doc.data(), email: doc.id }) as UserProfile).filter((user) => user.email.toLowerCase() !== ctx.currentUser.email.toLowerCase());
        ctx.setUsers((previous) => [...new Map([...(reset ? previous.filter((user) => user.email.toLowerCase() === ctx.currentUser.email.toLowerCase()) : previous), ...rows].map((row) => [row.email.toLowerCase(), row])).values()]);
      } else {
        const rows = documents.map((doc) => ({ ...doc.data(), id: doc.id }) as MilestoneAlert);
        ctx.setMilestoneAlerts((previous) => [...new Map([...(reset ? previous.filter((alert) => !alert.fulfilled) : previous), ...rows].map((row) => [row.id, row])).values()]);
      }
      state.cursor = documents[documents.length - 1] || state.cursor;
      state.complete = snapshot.size <= STAFF_PAGE_SIZE;
      (kind === 'roster' ? ctx.setHasMoreStaffUsers : ctx.setHasMoreGearHistory)(!state.complete);
    } catch (error) {
      if (current()) {
        if ((error as { code?: string }).code === 'permission-denied') clearRevokedStaffData(ctx);
        setError(kind === 'roster' ? 'Runner profiles could not be loaded. Please retry.' : 'Fulfilled gear history could not be loaded. Please retry.');
      }
      throw error;
    } finally { state.pending = false; if (current()) setLoading(false); }
  };
  const findStaffUser = async (email: string) => {
    allowed();
    const clean = email.trim().toLowerCase();
    if (!db || !isFirebaseConfigured) return ctx.users.find((user) => user.email.toLowerCase() === clean);
    const epoch = ctx.privateSyncEpoch.current;
    const roster = ctx.staffRosterPage.current;
    const snapshot = await read(getDoc(doc(db, 'users', clean)), () => epoch === ctx.privateSyncEpoch.current && roster === ctx.staffRosterPage.current);
    if (epoch !== ctx.privateSyncEpoch.current || roster !== ctx.staffRosterPage.current) throw new Error('Your staff session changed. Please retry.');
    if (!snapshot.exists()) return undefined;
    const user = { ...snapshot.data(), email: snapshot.id } as UserProfile;
    if (clean !== ctx.currentUser.email.toLowerCase()) ctx.setUsers((previous) => [user, ...previous.filter((row) => row.email.toLowerCase() !== clean)]);
    return user;
  };
  // Explicit exports keep the complete dataset without making every sign-in read it.
  const exportStaffUsers = async (): Promise<UserProfile[]> => {
    allowed();
    if (!db || !isFirebaseConfigured) return ctx.users;
    const epoch = ctx.privateSyncEpoch.current;
    const roster = ctx.staffRosterPage.current;
    const rows: UserProfile[] = [];
    let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
    for (;;) {
      const snapshot = await read(getDocs(query(collection(db, 'users'), orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(STAFF_PAGE_SIZE))), () => epoch === ctx.privateSyncEpoch.current && roster === ctx.staffRosterPage.current);
      if (epoch !== ctx.privateSyncEpoch.current || roster !== ctx.staffRosterPage.current) throw new Error('Your staff session changed. Export cancelled.');
      rows.push(...snapshot.docs.map((doc) => ({ ...doc.data(), email: doc.id }) as UserProfile));
      if (snapshot.size < STAFF_PAGE_SIZE) return rows;
      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
  };
  const searchStaffUsers = async (term: string, role: StaffSearchRole = 'all', offset = 0): Promise<StaffSearchResult> => {
    allowed();
    if (!term.trim()) return { users: [], total: 0, hasMore: false };
    const epoch = ctx.privateSyncEpoch.current;
    const cache = ctx.staffSearchCache.current;
    if (!cache.rows || cache.expires <= Date.now()) {
      if (!cache.pending) {
        const pending = exportStaffUsers().then((rows) => {
          if (ctx.privateSyncEpoch.current !== epoch || ctx.staffSearchCache.current !== cache) throw new Error('Your staff session changed. Please retry.');
          cache.rows = rows; cache.expires = Date.now() + 120_000;
          return rows;
        }).finally(() => { cache.pending = undefined; });
        cache.pending = pending;
      }
      await cache.pending;
    }
    if (ctx.privateSyncEpoch.current !== epoch || ctx.staffSearchCache.current !== cache) throw new Error('Your staff session changed. Please retry.');
    const available = [...new Map([...cache.rows!, ...ctx.users].map((user) => [user.email.toLowerCase(), user])).values()];
    const matches = available.filter((user) => matchesStaffSearch(user, term, role)).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.email.localeCompare(b.email));
    const start = Math.max(0, Math.trunc(offset));
    const users = matches.slice(start, start + STAFF_PAGE_SIZE);
    ctx.setUsers((previous) => [...new Map([...users.filter((user) => user.email.toLowerCase() !== ctx.currentUser.email.toLowerCase()), ...previous].map((user) => [user.email.toLowerCase(), user])).values()]);
    return { users, total: matches.length, hasMore: start + STAFF_PAGE_SIZE < matches.length };
  };
  const refresh = async (kind: 'roster' | 'gear') => {
    if (!db || !isFirebaseConfigured) return;
    allowed();
    const ref = kind === 'roster' ? ctx.staffRosterPage : ctx.gearHistoryPage;
    if (ref.current.pending) return;
    ref.current = newStaffPage();
    if (kind === 'roster') {
      ctx.staffSearchCache.current = newStaffSearchCache();
      ctx.setHasMoreStaffUsers(true);
    } else {
      ctx.setHasMoreGearHistory(true);
    }
    await page(kind, true);
  };
  return { searchStaffUsers, refreshStaffUsers: () => refresh('roster'), refreshGearHistory: () => refresh('gear'), loadMoreStaffUsers: () => page('roster'), loadMoreGearHistory: () => page('gear'), findStaffUser, exportStaffUsers };
}
