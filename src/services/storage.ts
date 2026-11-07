import { useState, useEffect } from 'react';
import { 
  RunEvent, 
  GPXRoute, 
  Member, 
  Badge, 
  UserProfile,
  MeetupEvent,
  CheckInRecord,
  LegacyMember,
  ActivityType,
  DistanceTier,
  RouteOption,
  MilestoneAlert
} from '../types';
import { 
  INITIAL_RUNS, 
  INITIAL_ROUTES, 
  INITIAL_MEMBERS, 
  INITIAL_BADGES,
  INITIAL_USERS,
  INITIAL_MEETUP_EVENTS,
  INITIAL_CHECKINS,
  INITIAL_LEGACY_MEMBERS,
  CLUB_MILESTONES,
  INITIAL_MILESTONE_ALERTS,
  GUEST_USER
} from '../data/initialData';
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
  // Relational V2 keys
  USERS: 'woodchuckers_users_v2',
  MEETUP_EVENTS: 'woodchuckers_events_v2',
  CHECKINS: 'woodchuckers_checkins_v2',
  LEGACY_MEMBERS: 'woodchuckers_legacy_members_v2',
  CURRENT_USER_EMAIL: 'woodchuckers_current_user_email_v2',
  MILESTONE_ALERTS: 'woodchuckers_milestone_alerts_v2',
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
  // Legacy / existing state
  const [runs, setRuns] = useState<RunEvent[]>(() => loadFromStorage(STORAGE_KEYS.RUNS, INITIAL_RUNS));
  const [routes, setRoutes] = useState<GPXRoute[]>(() => loadFromStorage(STORAGE_KEYS.ROUTES, INITIAL_ROUTES));
  const [members, setMembers] = useState<Member[]>(() => loadFromStorage(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS));
  const [currentMemberId, setCurrentMemberId] = useState<string>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_USER_ID, INITIAL_MEMBERS[0].id)
  );
  const [badges] = useState<Badge[]>(INITIAL_BADGES);
  const [notifications, setNotifications] = useState<ClubNotification[]>(() => getStoredNotifications());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // New Relational Collections state (local testing / offline first)
  const [users, setUsers] = useState<UserProfile[]>(() => loadFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS));
  const [meetupEvents, setMeetupEvents] = useState<MeetupEvent[]>(() => loadFromStorage(STORAGE_KEYS.MEETUP_EVENTS, INITIAL_MEETUP_EVENTS));
  const [checkins, setCheckins] = useState<CheckInRecord[]>(() => loadFromStorage(STORAGE_KEYS.CHECKINS, INITIAL_CHECKINS));
  const [legacyMembers, setLegacyMembers] = useState<LegacyMember[]>(() => loadFromStorage(STORAGE_KEYS.LEGACY_MEMBERS, INITIAL_LEGACY_MEMBERS));
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(() =>
    loadFromStorage(STORAGE_KEYS.CURRENT_USER_EMAIL, INITIAL_USERS[0].email)
  );
  const [milestoneAlerts, setMilestoneAlerts] = useState<MilestoneAlert[]>(() =>
    loadFromStorage(STORAGE_KEYS.MILESTONE_ALERTS, INITIAL_MILESTONE_ALERTS)
  );

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

  // Sync V2 state changes to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.USERS, users);
  }, [users]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEETUP_EVENTS, meetupEvents);
  }, [meetupEvents]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CHECKINS, checkins);
  }, [checkins]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.LEGACY_MEMBERS, legacyMembers);
  }, [legacyMembers]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CURRENT_USER_EMAIL, currentUserEmail);
  }, [currentUserEmail]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MILESTONE_ALERTS, milestoneAlerts);
  }, [milestoneAlerts]);

  // Derived current user (Falls back to GUEST_USER if not logged in)
  const currentUser: UserProfile = currentUserEmail
    ? (users.find((u) => u.email.toLowerCase() === currentUserEmail.toLowerCase()) || users[0])
    : GUEST_USER;
  const currentMember: Member = currentUserEmail
    ? (members.find((m) => m.email.toLowerCase() === currentUserEmail.toLowerCase()) || members[0])
    : { ...GUEST_USER, id: 'guest', name: 'Guest Runner', streak: 0, favoritePace: 'Any', joinedDate: '' };

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

  /**
   * Search unclaimed legacy members by first and/or last name
   */
  const searchLegacyMatches = (nameQuery: string): LegacyMember[] => {
    if (!nameQuery || nameQuery.trim().length < 2) return [];
    const q = nameQuery.trim().toUpperCase();
    return legacyMembers.filter(
      (m) => m.claimedByEmail === null && m.name.toUpperCase().includes(q)
    );
  };

  /**
   * Register a new user profile with optional claimed legacy historical records
   */
  const registerUser = async (
    profileData: {
      email: string;
      firstName: string;
      lastName: string;
      shirtSize: string;
      age?: number;
      city?: string;
      zipCode?: string;
      preferredPace?: string;
    },
    claimedLegacyNames: string[] = []
  ): Promise<UserProfile> => {
    const cleanEmail = profileData.email.trim().toLowerCase();
    const displayName = `${profileData.firstName.trim()} ${profileData.lastName.trim()}`;

    // Find claimed legacy items
    const claimedRecords = legacyMembers.filter((m) =>
      claimedLegacyNames.some((cName) => cName.toUpperCase() === m.name.toUpperCase())
    );

    const legacyNewCount = claimedRecords.reduce((sum, r) => sum + r.newCount, 0);
    const legacyOldCount = claimedRecords.reduce((sum, r) => sum + r.oldCount, 0);
    const totalLegacyRuns = legacyNewCount + legacyOldCount;

    // Estimate initial legacy miles (~3.1 miles per legacy run)
    const initialMiles = Math.round(totalLegacyRuns * 3.1 * 10) / 10;

    const initialBadgeIds: string[] = [];
    const initialBadgeCounts: Record<string, number> = {};
    if (totalLegacyRuns >= 1) {
      initialBadgeIds.push('first-chuck');
      initialBadgeCounts['first-chuck'] = 1;
    }
    if (totalLegacyRuns >= 5) {
      initialBadgeIds.push('milestone-5');
      initialBadgeCounts['milestone-5'] = Math.floor(totalLegacyRuns / 5);
    }
    if (totalLegacyRuns >= 50) {
      initialBadgeIds.push('milestone-50');
      initialBadgeCounts['milestone-50'] = Math.floor(totalLegacyRuns / 50);
    }
    if (totalLegacyRuns >= 100) {
      initialBadgeIds.push('milestone-100');
      initialBadgeCounts['milestone-100'] = Math.floor(totalLegacyRuns / 100);
    }
    if (totalLegacyRuns >= 200) {
      initialBadgeIds.push('milestone-200');
      initialBadgeCounts['milestone-200'] = Math.floor(totalLegacyRuns / 200);
    }

    const newUser: UserProfile = {
      email: cleanEmail,
      firstName: profileData.firstName.trim(),
      lastName: profileData.lastName.trim(),
      displayName,
      shirtSize: profileData.shirtSize,
      age: profileData.age,
      city: profileData.city || 'Woodland',
      zipCode: profileData.zipCode || '95695',
      preferredPace: profileData.preferredPace,
      pre2021Runs: legacyOldCount,
      loggedRuns: legacyNewCount,
      totalRuns: totalLegacyRuns,
      totalMiles: initialMiles,
      runCount: totalLegacyRuns,
      walkCount: 0,
      firstRunDate: totalLegacyRuns > 0 ? '2021-02-10' : new Date().toISOString().split('T')[0],
      linkedLegacyNames: claimedRecords.map((r) => r.name),
      unlockedBadgeIds: initialBadgeIds,
      badgeCounts: initialBadgeCounts,
      role: cleanEmail === 'woodlandwoodchuckers@gmail.com' ? 'admin' : 'member',
      createdAt: new Date().toISOString(),
    };

    // Update legacy records to mark claimed
    const nowIso = new Date().toISOString();
    setLegacyMembers((prev) =>
      prev.map((m) =>
        claimedRecords.some((c) => c.name.toUpperCase() === m.name.toUpperCase())
          ? { ...m, claimedByEmail: cleanEmail, claimedAt: nowIso }
          : m
      )
    );

    // Save to users list
    setUsers((prev) => {
      const filtered = prev.filter((u) => u.email.toLowerCase() !== cleanEmail);
      return [newUser, ...filtered];
    });

    // Also sync to backwards-compatible members list
    setMembers((prev) => {
      const filtered = prev.filter((m) => m.email.toLowerCase() !== cleanEmail);
      const newMember: Member = {
        ...newUser,
        id: newUser.email,
        name: newUser.displayName,
        streak: 1,
        favoritePace: newUser.preferredPace || '9:00 min/mi',
        joinedDate: newUser.firstRunDate || new Date().toISOString().split('T')[0],
      };
      return [newMember, ...filtered];
    });

    setCurrentUserEmail(cleanEmail);
    setCurrentMemberId(cleanEmail);

    return newUser;
  };

  /**
   * Check in a runner to a scheduled meetup event
   */
  const checkInRunner = async (params: {
    eventDate: string;
    userEmail: string;
    codeWordEntered: string;
    activity: ActivityType;
    distanceChoice: DistanceTier;
  }): Promise<{
    success: boolean;
    message: string;
    route?: RouteOption;
    checkIn?: CheckInRecord;
    user?: UserProfile;
    newBadges?: Badge[];
    milestoneAlert?: MilestoneAlert;
  }> => {
    const { eventDate, userEmail, codeWordEntered, activity, distanceChoice } = params;
    const cleanEmail = userEmail.trim().toLowerCase();

    // 1. Locate event
    const event = meetupEvents.find((e) => e.date === eventDate) || meetupEvents[0];
    if (!event) {
      return { success: false, message: 'No meetup event found for this date.' };
    }

    // 2. Validate Code Word (case-insensitive)
    if (codeWordEntered.trim().toUpperCase() !== event.codeWord.trim().toUpperCase()) {
      return {
        success: false,
        message: `Incorrect code word! Today's code word was announced by the organizer before the run.`,
      };
    }

    // 3. Locate route option and actual measured miles
    const distKey = String(distanceChoice) as '1' | '3' | '5';
    const routeOption = event.routes[distKey] || {
      name: `${distanceChoice}-Mile Club Route`,
      actualMiles: distanceChoice === 1 ? 1.15 : distanceChoice === 3 ? 3.22 : 5.12,
      directions: 'Follow group leader from Blue Note Brewing.',
    };

    // 4. Ensure runner doesn't double-checkin on the same date
    const checkinId = `${eventDate}_${cleanEmail}`;
    const alreadyCheckedIn = checkins.some((c) => c.date === eventDate && c.userEmail.toLowerCase() === cleanEmail);
    if (alreadyCheckedIn) {
      return {
        success: false,
        message: `You're already checked in for today's run! Enjoy your ${activity}!`,
        route: routeOption,
      };
    }

    // 5. Create new check-in record for event log
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0]; // "HH:MM:SS"
    const user = users.find((u) => u.email.toLowerCase() === cleanEmail) || currentUser;

    const newCheckIn: CheckInRecord = {
      id: checkinId,
      date: eventDate,
      time: timeStr,
      userEmail: cleanEmail,
      runnerName: user.displayName,
      activity,
      distanceChoice,
      actualMiles: routeOption.actualMiles,
      routeName: routeOption.name,
      source: 'pwa',
      createdAt: now.toISOString(),
    };

    setCheckins((prev) => [newCheckIn, ...prev]);

    // 6. Update user totals & badge checks
    const earnedBadges: Badge[] = [];
    let updatedUser: UserProfile = { ...user };

    setUsers((prev) =>
      prev.map((u) => {
        if (u.email.toLowerCase() !== cleanEmail) return u;

        const newTotalRuns = u.totalRuns + 1;
        const newLoggedRuns = u.loggedRuns + 1;
        const newTotalMiles = Math.round((u.totalMiles + routeOption.actualMiles) * 100) / 100;
        const newRunCount = activity === 'running' ? u.runCount + 1 : u.runCount;
        const newWalkCount = activity === 'walking' ? u.walkCount + 1 : u.walkCount;

        const unlocked = [...(u.unlockedBadgeIds || [])];
        const counts: Record<string, number> = { ...(u.badgeCounts || {}) };

        // Helper to award / increment an achievement badge
        const awardBadge = (badgeId: string, customMultiplier?: number) => {
          const isFirstTime = !unlocked.includes(badgeId);
          if (isFirstTime) {
            unlocked.push(badgeId);
            const b = badges.find((x) => x.id === badgeId);
            if (b) earnedBadges.push(b);
          }
          if (customMultiplier !== undefined) {
            const prevCount = counts[badgeId] || 0;
            if (customMultiplier > prevCount && !isFirstTime) {
              const b = badges.find((x) => x.id === badgeId);
              if (b) earnedBadges.push(b);
            }
            counts[badgeId] = customMultiplier;
          } else {
            counts[badgeId] = (counts[badgeId] || 0) + 1;
            if (!isFirstTime) {
              const b = badges.find((x) => x.id === badgeId);
              if (b) earnedBadges.push(b);
            }
          }
        };

        // 1. First Chuck (1 run attendance)
        if (newTotalRuns >= 1) {
          awardBadge('first-chuck', 1);
        }

        // 2. WoodChucker Milestones (5, 50, 100, 200 runs)
        if (newTotalRuns >= 5) {
          awardBadge('milestone-5', Math.floor(newTotalRuns / 5));
        }
        if (newTotalRuns >= 50) {
          awardBadge('milestone-50', Math.floor(newTotalRuns / 50));
        }
        if (newTotalRuns >= 100) {
          awardBadge('milestone-100', Math.floor(newTotalRuns / 100));
        }
        if (newTotalRuns >= 200) {
          awardBadge('milestone-200', Math.floor(newTotalRuns / 200));
        }

        // 3. Power Walker (Incremental: every 10 walking check-ins)
        if (newWalkCount >= 10) {
          awardBadge('power-walker', Math.floor(newWalkCount / 10));
        }

        // 4. Streaks: Burrow Regular (4 weeks / 1 month) & Burrow Extreme (10 weeks)
        if (newTotalRuns >= 4) {
          awardBadge('streak-4', Math.max(1, Math.floor(newTotalRuns / 4)));
        }
        if (newTotalRuns >= 10) {
          awardBadge('streak-10', Math.max(1, Math.floor(newTotalRuns / 10)));
        }

        // 5. Special Events: Turkey Trot, Halloween Run, Anniversary Run
        // Detected via event.specialEvent dropdown OR code word / title matching
        if (
          event.specialEvent === 'turkey_trot' || 
          event.codeWord.toUpperCase().includes('TURKEY') || 
          event.title.toLowerCase().includes('turkey')
        ) {
          awardBadge('special-turkey');
        }

        if (
          event.specialEvent === 'halloween' || 
          event.codeWord.toUpperCase().includes('HALLOWEEN') || 
          event.codeWord.toUpperCase().includes('SPOOKY') || 
          event.title.toLowerCase().includes('halloween')
        ) {
          awardBadge('special-halloween');
        }

        if (
          event.specialEvent === 'anniversary' || 
          event.codeWord.toUpperCase().includes('ANNIVERSARY') || 
          event.title.toLowerCase().includes('anniversary')
        ) {
          awardBadge('special-anniversary');
        }

        updatedUser = {
          ...u,
          totalRuns: newTotalRuns,
          loggedRuns: newLoggedRuns,
          totalMiles: newTotalMiles,
          runCount: newRunCount,
          walkCount: newWalkCount,
          unlockedBadgeIds: unlocked,
          badgeCounts: counts,
        };

        return updatedUser;
      })
    );

    // Also update backwards-compatible members list
    setMembers((prev) =>
      prev.map((m) => {
        if (m.email.toLowerCase() !== cleanEmail) return m;
        return {
          ...m,
          totalRuns: updatedUser.totalRuns,
          totalMiles: updatedUser.totalMiles,
          unlockedBadgeIds: updatedUser.unlockedBadgeIds,
          badgeCounts: updatedUser.badgeCounts,
        };
      })
    );

    // Check if runner unlocked a major club milestone (5, 50, 100, 200 runs)
    let unlockedMilestone: MilestoneAlert | undefined;
    if ([5, 50, 100, 200].includes(updatedUser.totalRuns)) {
      const mDef = CLUB_MILESTONES.find((m) => m.runsRequired === updatedUser.totalRuns);
      if (mDef) {
        unlockedMilestone = {
          id: `milestone-${Date.now()}_${cleanEmail}`,
          userEmail: cleanEmail,
          runnerName: updatedUser.displayName,
          shirtSize: updatedUser.shirtSize,
          milestoneRuns: updatedUser.totalRuns,
          milestoneName: mDef.name,
          reward: mDef.reward,
          perks: mDef.perks,
          date: eventDate,
          time: timeStr,
          fulfilled: false,
        };
        setMilestoneAlerts((prev) => [unlockedMilestone!, ...prev]);
      }
    }

    return {
      success: true,
      message: `Checked in successfully! That's Run #${updatedUser.totalRuns} for you!`,
      route: routeOption,
      checkIn: newCheckIn,
      user: updatedUser,
      newBadges: earnedBadges,
      milestoneAlert: unlockedMilestone,
    };
  };

  /**
   * Mark a milestone reward as fulfilled / handed out by an organizer
   */
  const markMilestoneFulfilled = (alertId: string, fulfilledBy: string) => {
    setMilestoneAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? { ...a, fulfilled: true, fulfilledAt: new Date().toISOString(), fulfilledBy }
          : a
      )
    );
  };

  /**
   * Save / update a meetup event (Admin)
   */
  const saveMeetupEvent = async (event: MeetupEvent) => {
    setMeetupEvents((prev) => {
      const exists = prev.some((e) => e.date === event.date);
      if (exists) {
        return prev.map((e) => (e.date === event.date ? event : e));
      }
      return [event, ...prev];
    });
  };

  /**
   * Switch the current active testing user by email
   */
  const switchCurrentUser = (email: string) => {
    setCurrentUserEmail(email.toLowerCase());
    setCurrentMemberId(email.toLowerCase());
  };

  /**
   * Toggle RSVP for a run (legacy support)
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
        if (isFirebaseConfigured && db) {
          setDoc(doc(db, 'runs', run.id), updatedRun, { merge: true }).catch(console.error);
        }
        return updatedRun;
      })
    );
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
    setUsers(INITIAL_USERS);
    setMeetupEvents(INITIAL_MEETUP_EVENTS);
    setCheckins(INITIAL_CHECKINS);
    setLegacyMembers(INITIAL_LEGACY_MEMBERS);
    setCurrentUserEmail(INITIAL_USERS[0].email);

    localStorage.removeItem(STORAGE_KEYS.RUNS);
    localStorage.removeItem(STORAGE_KEYS.ROUTES);
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.MEETUP_EVENTS);
    localStorage.removeItem(STORAGE_KEYS.CHECKINS);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_EMAIL);
  };

  return {
    // V2 Relational Collections
    users,
    meetupEvents,
    checkins,
    legacyMembers,
    currentUser,
    currentUserEmail,
    registerUser,
    checkInRunner,
    saveMeetupEvent,
    searchLegacyMatches,
    switchCurrentUser,
    milestoneAlerts,
    markMilestoneFulfilled,

    // V1 / Shared
    runs,
    routes,
    members,
    badges,
    notifications,
    currentMember,
    currentMemberId,
    setCurrentMemberId,
    toggleRSVP,
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
