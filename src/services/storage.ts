import { useState, useEffect } from 'react';
import { RunEvent, GPXRoute, Member, Badge, CheckInPayload } from '../types';
import { INITIAL_RUNS, INITIAL_ROUTES, INITIAL_MEMBERS, INITIAL_BADGES } from '../data/initialData';
import { isFirebaseConfigured, db } from './firebase';
import { 
  collection, 
  getDocs, 
  setDoc, 
  deleteDoc,
  doc 
} from 'firebase/firestore';
import { 
  ClubNotification, 
  getStoredNotifications, 
  storeNotification, 
  showLocalNotification 
} from './notifications';

const STORAGE_KEYS = {
  RUNS: 'woodchuckers_runs_v1',
  ROUTES: 'woodchuckers_routes_v1',
  MEMBERS: 'woodchuckers_members_v1',
  CURRENT_USER_ID: 'woodchuckers_current_user_id_v1',
};

// Safe localStorage getters
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error loading key ${key} from storage:`, e);
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving key ${key} to storage:`, e);
  }
}

export function useClubStore() {
  const [runs, setRuns] = useState<RunEvent[]>(() => loadFromStorage(STORAGE_KEYS.RUNS, INITIAL_RUNS));
  const [routes, setRoutes] = useState<GPXRoute[]>(() => loadFromStorage(STORAGE_KEYS.ROUTES, INITIAL_ROUTES));
  const [members, setMembers] = useState<Member[]>(() => loadFromStorage(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS));
  const [currentMemberId, setCurrentMemberId] = useState<string>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_USER_ID, INITIAL_MEMBERS[0].id)
  );
  const [badges] = useState<Badge[]>(INITIAL_BADGES);
  const [notifications, setNotifications] = useState<ClubNotification[]>(() => getStoredNotifications());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Sync state changes to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.RUNS, runs);
  }, [runs]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.ROUTES, routes);
  }, [routes]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEMBERS, members);
  }, [members]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER_ID, currentMemberId);
  }, [currentMemberId]);

  // If Firebase is configured, fetch collections on initial load
  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;

    async function syncFromFirestore() {
      if (!db) return;
      setIsSyncing(true);
      try {
        const runsSnap = await getDocs(collection(db, 'runs'));
        if (!runsSnap.empty) {
          const remoteRuns = runsSnap.docs.map((d) => d.data() as RunEvent);
          setRuns(remoteRuns);
        }

        const routesSnap = await getDocs(collection(db, 'routes'));
        if (!routesSnap.empty) {
          const remoteRoutes = routesSnap.docs.map((d) => d.data() as GPXRoute);
          setRoutes(remoteRoutes);
        }

        const membersSnap = await getDocs(collection(db, 'members'));
        if (!membersSnap.empty) {
          const remoteMembers = membersSnap.docs.map((d) => d.data() as Member);
          setMembers(remoteMembers);
        }
      } catch (err) {
        console.warn('Firestore initial fetch skipped or failed:', err);
      } finally {
        setIsSyncing(false);
      }
    }

    syncFromFirestore();
  }, []);

  const currentMember = members.find((m) => m.id === currentMemberId) || members[0];

  /**
   * Toggle RSVP for a run
   */
  const toggleRSVP = async (runId: string) => {
    setRuns((prevRuns) =>
      prevRuns.map((run) => {
        if (run.id !== runId) return run;

        const isAttending = run.attendees.some((a) => a.memberId === currentMember.id);
        let updatedAttendees;

        if (isAttending) {
          updatedAttendees = run.attendees.filter((a) => a.memberId !== currentMember.id);
        } else {
          updatedAttendees = [
            ...run.attendees,
            {
              memberId: currentMember.id,
              name: currentMember.name,
              checkedIn: false,
              rsvpDate: new Date().toISOString(),
            },
          ];
        }

        const updatedRun = { ...run, attendees: updatedAttendees };

        // Async sync to firestore if configured
        if (isFirebaseConfigured && db) {
          setDoc(doc(db, 'runs', run.id), updatedRun, { merge: true }).catch(console.error);
        }

        return updatedRun;
      })
    );
  };

  /**
   * Check in to a run
   */
  const checkInMember = async ({ runId, memberId }: CheckInPayload): Promise<{ newBadges: Badge[] }> => {
    let earnedBadges: Badge[] = [];
    const run = runs.find((r) => r.id === runId);
    if (!run) return { newBadges: [] };

    // Update run attendees
    setRuns((prevRuns) =>
      prevRuns.map((r) => {
        if (r.id !== runId) return r;
        const exists = r.attendees.some((a) => a.memberId === memberId);
        let attendees;
        if (exists) {
          attendees = r.attendees.map((a) =>
            a.memberId === memberId
              ? { ...a, checkedIn: true, checkedInAt: new Date().toISOString() }
              : a
          );
        } else {
          const memberObj = members.find((m) => m.id === memberId);
          attendees = [
            ...r.attendees,
            {
              memberId,
              name: memberObj?.name || 'Woodchuck Runner',
              checkedIn: true,
              checkedInAt: new Date().toISOString(),
              rsvpDate: new Date().toISOString(),
            },
          ];
        }
        const updated = { ...r, attendees };
        if (isFirebaseConfigured && db) {
          setDoc(doc(db, 'runs', r.id), updated, { merge: true }).catch(console.error);
        }
        return updated;
      })
    );

    // Update member stats and check badge unlocks
    setMembers((prevMembers) =>
      prevMembers.map((m) => {
        if (m.id !== memberId) return m;

        const newTotalRuns = m.totalRuns + 1;
        const newTotalMiles = Math.round((m.totalMiles + run.distanceMiles) * 10) / 10;
        const newStreak = m.streak + 1;
        const unlocked = [...m.unlockedBadgeIds];

        // Badge checks
        if (!unlocked.includes('first-chuck') && newTotalRuns >= 1) {
          unlocked.push('first-chuck');
          const b = badges.find((x) => x.id === 'first-chuck');
          if (b) earnedBadges.push(b);
        }
        if (!unlocked.includes('streak-3') && newStreak >= 3) {
          unlocked.push('streak-3');
          const b = badges.find((x) => x.id === 'streak-3');
          if (b) earnedBadges.push(b);
        }
        if (!unlocked.includes('trail-hound') && run.surface === 'Trail') {
          unlocked.push('trail-hound');
          const b = badges.find((x) => x.id === 'trail-hound');
          if (b) earnedBadges.push(b);
        }
        if (!unlocked.includes('mile-50') && newTotalMiles >= 50) {
          unlocked.push('mile-50');
          const b = badges.find((x) => x.id === 'mile-50');
          if (b) earnedBadges.push(b);
        }

        const updatedMember: Member = {
          ...m,
          totalRuns: newTotalRuns,
          totalMiles: newTotalMiles,
          streak: newStreak,
          unlockedBadgeIds: unlocked,
        };

        if (isFirebaseConfigured && db) {
          setDoc(doc(db, 'members', m.id), updatedMember, { merge: true }).catch(console.error);
        }

        return updatedMember;
      })
    );

    return { newBadges: earnedBadges };
  };

  /**
   * Add a new scheduled run
   */
  const addRun = async (newRun: Omit<RunEvent, 'id' | 'attendees'>) => {
    const id = `run-${Date.now()}`;
    const run: RunEvent = {
      ...newRun,
      id,
      attendees: [
        {
          memberId: currentMember.id,
          name: currentMember.name,
          checkedIn: false,
          rsvpDate: new Date().toISOString(),
        },
      ],
    };

    setRuns((prev) => [run, ...prev]);

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'runs', id), run).catch(console.error);
    }
  };

  /**
   * Add a newly parsed GPX route
   */
  const addRoute = async (routeData: Omit<GPXRoute, 'id'>): Promise<GPXRoute> => {
    const id = `route-${Date.now()}`;
    const newRoute: GPXRoute = {
      ...routeData,
      id,
    };

    setRoutes((prev) => [newRoute, ...prev]);

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'routes', id), newRoute).catch(console.error);
    }

    return newRoute;
  };

  /**
   * Update an existing run (Admin)
   */
  const updateRun = async (updatedRun: RunEvent) => {
    setRuns((prev) => prev.map((r) => (r.id === updatedRun.id ? updatedRun : r)));

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'runs', updatedRun.id), updatedRun, { merge: true }).catch(console.error);
    }
  };

  /**
   * Delete a run (Admin)
   */
  const deleteRun = async (runId: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== runId));

    if (isFirebaseConfigured && db) {
      deleteDoc(doc(db, 'runs', runId)).catch(console.error);
    }
  };

  /**
   * Update member stats or profile (Admin / Member)
   */
  const updateMemberStats = async (memberId: string, updates: Partial<Member>) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const updated = { ...m, ...updates };
        if (isFirebaseConfigured && db) {
          setDoc(doc(db, 'members', memberId), updated, { merge: true }).catch(console.error);
        }
        return updated;
      })
    );
  };

  /**
   * Send a club-wide push announcement (Admin)
   */
  const sendPushAnnouncement = async (title: string, body: string, targetRunId?: string) => {
    const notif: ClubNotification = {
      id: `notif-${Date.now()}`,
      title,
      body,
      timestamp: new Date().toISOString(),
      targetRunId,
      sender: currentMember.name,
    };

    storeNotification(notif);
    setNotifications((prev) => [notif, ...prev]);

    // Trigger local push notification on device
    showLocalNotification(title, body);

    if (isFirebaseConfigured && db) {
      setDoc(doc(db, 'settings', 'latest_announcement'), notif).catch(console.error);
    }
  };

  /**
   * Reset local state to defaults
   */
  const resetToDefaults = () => {
    setRuns(INITIAL_RUNS);
    setRoutes(INITIAL_ROUTES);
    setMembers(INITIAL_MEMBERS);
    setCurrentMemberId(INITIAL_MEMBERS[0].id);
    localStorage.removeItem(STORAGE_KEYS.RUNS);
    localStorage.removeItem(STORAGE_KEYS.ROUTES);
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
  };

  return {
    runs,
    routes,
    members,
    badges,
    notifications,
    currentMember,
    currentMemberId,
    setCurrentMemberId,
    toggleRSVP,
    checkInMember,
    addRun,
    updateRun,
    deleteRun,
    updateMemberStats,
    sendPushAnnouncement,
    addRoute,
    resetToDefaults,
    isSyncing,
    isFirebaseConfigured,
  };
}
