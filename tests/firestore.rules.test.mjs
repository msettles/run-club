// Firestore security rules tests. Run with: npm run test:rules
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch, Timestamp,
} from 'firebase/firestore';

const memberKeyFor = (email) =>
  createHash('sha256').update(`woodchuckers:${email.toLowerCase()}`).digest('hex');

const DATE = '2026-11-11';
const ALICE = 'alice@example.com';
const BOB = 'bob@example.com';
const ORGANIZER = 'org@example.com';

let env;

const baseUser = (email, extra = {}) => ({
  email,
  firstName: email.split('@')[0],
  lastName: 'Runner',
  displayName: `${email.split('@')[0]} Runner`,
  shirtSize: 'M',
  pre2021Runs: 0,
  loggedRuns: 4,
  totalRuns: 4,
  totalMiles: 12,
  runCount: 4,
  walkCount: 0,
  linkedLegacyNames: [],
  unlockedBadgeIds: [],
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const freshUser = (email, extra = {}) =>
  baseUser(email, { loggedRuns: 0, totalRuns: 0, totalMiles: 0, runCount: 0, ...extra });

const memberFromUser = (u) => ({
  id: memberKeyFor(u.email),
  name: u.displayName,
  totalRuns: u.totalRuns,
  totalMiles: u.totalMiles,
  runCount: u.runCount,
  walkCount: u.walkCount,
  streak: 1,
  favoritePace: 'Any',
  unlockedBadgeIds: u.unlockedBadgeIds,
  joinedDate: '2026-01-01',
});

const checkIn = (email, extra = {}) => ({
  id: `${DATE}_${email}`,
  date: DATE,
  time: '18:05:00',
  userEmail: email,
  activity: 'running',
  distanceChoice: 'route-3',
  actualMiles: 3.1,
  createdAt: '2026-11-11T18:05:00.000Z',
  updatedAt: '2026-11-11T18:05:00.000Z',
  source: 'pwa',
  codeWord: 'ACORN',
  ...extra,
});

const run = {
  id: 'run-1',
  title: 'Wednesday Run',
  date: DATE,
  time: '06:00 PM',
  locationName: 'Blue Note',
  address: 'Main St',
  distanceMiles: 3.1,
  surface: 'Pavement',
  elevationGainFt: 10,
  description: '',
  paceGroups: [],
  attendees: [],
  organizerName: 'Org',
};

const ctx = (email) =>
  env.authenticatedContext(email.replace(/\W/g, ''), { email, email_verified: true }).firestore();

async function seed({ windowOpen = true } = {}) {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const now = Date.now();
    await setDoc(doc(db, 'meetup_events', DATE), {
      id: DATE, date: DATE, title: 'Wed', activeDistances: [], routes: {},
      checkInOpensAt: Timestamp.fromMillis(windowOpen ? now - 3600e3 : now + 3600e3),
      checkInClosesAt: Timestamp.fromMillis(now + 7200e3),
    });
    await setDoc(doc(db, 'meetup_secrets', DATE), { codeWord: 'ACORN' });
    await setDoc(doc(db, 'users', ALICE), baseUser(ALICE));
    await setDoc(doc(db, 'users', BOB), baseUser(BOB));
    await setDoc(doc(db, 'users', ORGANIZER), baseUser(ORGANIZER, { role: 'organizer' }));
    await setDoc(doc(db, 'runs', 'run-1'), run);
  });
}

function checkInBatch(db, email, { codeWord = 'ACORN', bump = 1, milestone = false } = {}) {
  const user = baseUser(email);
  const updated = {
    ...user,
    totalRuns: user.totalRuns + bump,
    loggedRuns: user.loggedRuns + bump,
    runCount: user.runCount + bump,
    totalMiles: user.totalMiles + 3.1,
    lastCheckInDate: DATE,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'checkins', `${DATE}_${email}`), checkIn(email, { codeWord }));
  batch.set(doc(db, 'users', email), updated);
  batch.set(doc(db, 'members', memberKeyFor(email)), memberFromUser(updated));
  if (milestone) {
    batch.set(doc(db, 'milestone_alerts', `m${updated.totalRuns}_${email}`), {
      id: `m${updated.totalRuns}_${email}`, userEmail: email, runnerName: updated.displayName,
      shirtSize: 'M', milestoneRuns: updated.totalRuns, milestoneName: '5 Runs', reward: 'Shirt',
      perks: '', date: DATE, time: '18:05:00', fulfilled: false,
    });
  }
  return batch.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-woodchuckers',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

test('public cannot read private collections', async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'users', ALICE)));
  await assertFails(getDocs(collection(anon, 'users')));
  await assertFails(getDocs(collection(anon, 'checkins')));
  await assertFails(getDocs(collection(anon, 'milestone_alerts')));
  await assertFails(getDoc(doc(anon, 'meetup_secrets', DATE)));
  await assertSucceeds(getDoc(doc(anon, 'meetup_events', DATE)));
  await assertSucceeds(getDocs(collection(anon, 'members')));
});

test('runner reads only their own profile and check-ins', async () => {
  const alice = ctx(ALICE);
  await assertSucceeds(getDoc(doc(alice, 'users', ALICE)));
  await assertFails(getDoc(doc(alice, 'users', BOB)));
  await assertFails(getDocs(collection(alice, 'users')));
  await assertFails(getDoc(doc(alice, 'meetup_secrets', DATE)));
  await assertSucceeds(getDocs(query(collection(alice, 'checkins'), where('userEmail', '==', ALICE))));
  await assertFails(getDocs(collection(alice, 'checkins')));
});

test('organizer role on users doc grants staff access', async () => {
  const org = ctx(ORGANIZER);
  await assertSucceeds(getDocs(collection(org, 'users')));
  await assertSucceeds(getDoc(doc(org, 'meetup_secrets', DATE)));
});

test('runner cannot change their own role or legacy totals', async () => {
  const alice = ctx(ALICE);
  await assertFails(updateDoc(doc(alice, 'users', ALICE), { role: 'admin' }));
  await assertFails(updateDoc(doc(alice, 'users', ALICE), { pre2021Runs: 500 }));
  await assertSucceeds(updateDoc(doc(alice, 'users', ALICE), { shirtSize: 'L' }));
});

test('runner cannot create a profile with a staff role', async () => {
  const carol = ctx('carol@example.com');
  await assertFails(setDoc(doc(carol, 'users', 'carol@example.com'), freshUser('carol@example.com', { role: 'admin' })));
  await assertSucceeds(setDoc(doc(carol, 'users', 'carol@example.com'), freshUser('carol@example.com')));
});

test('runner cannot bump stats without a check-in', async () => {
  const alice = ctx(ALICE);
  await assertFails(updateDoc(doc(alice, 'users', ALICE), { totalRuns: 999 }));
  await assertFails(updateDoc(doc(alice, 'users', ALICE), { totalRuns: 5, loggedRuns: 5, runCount: 5, lastCheckInDate: DATE }));
});

test('check-in with the right code word inside the window succeeds', async () => {
  await assertSucceeds(checkInBatch(ctx(ALICE), ALICE));
});

test('check-in with the wrong code word fails', async () => {
  await assertFails(checkInBatch(ctx(ALICE), ALICE, { codeWord: 'WRONG' }));
});

test('check-in outside the window fails', async () => {
  await env.clearFirestore();
  await seed({ windowOpen: false });
  await assertFails(checkInBatch(ctx(ALICE), ALICE));
});

test('check-in cannot add more than one run', async () => {
  await assertFails(checkInBatch(ctx(ALICE), ALICE, { bump: 5 }));
});

test('runner cannot check in as someone else', async () => {
  const alice = ctx(ALICE);
  await assertFails(setDoc(doc(alice, 'checkins', `${DATE}_${BOB}`), checkIn(BOB)));
});

test('leaderboard row must mirror the user doc', async () => {
  const alice = ctx(ALICE);
  const fake = { ...memberFromUser(baseUser(ALICE)), totalRuns: 400 };
  await assertFails(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), fake));
  await assertSucceeds(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), memberFromUser(baseUser(ALICE))));
  await assertFails(setDoc(doc(alice, 'members', memberKeyFor(BOB)), memberFromUser(baseUser(BOB))));
});

test('milestone alert only alongside the qualifying check-in, once', async () => {
  const alice = ctx(ALICE);
  await assertFails(setDoc(doc(alice, 'milestone_alerts', `m5_${ALICE}`), {
    id: `m5_${ALICE}`, userEmail: ALICE, runnerName: 'a', shirtSize: 'M', milestoneRuns: 5,
    milestoneName: '5', reward: 'Shirt', perks: '', date: DATE, time: 'x', fulfilled: false,
  }));
  await assertSucceeds(checkInBatch(alice, ALICE, { milestone: true }));
});

test('runner can toggle only their own RSVP', async () => {
  const alice = ctx(ALICE);
  const mine = { memberId: memberKeyFor(ALICE), name: 'Alice', checkedIn: false, rsvpDate: '2026-11-10' };
  const bobs = { memberId: memberKeyFor(BOB), name: 'Bob', checkedIn: false, rsvpDate: '2026-11-10' };
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [bobs] }));
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { title: 'Hacked' }));
  await assertSucceeds(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [mine] }));
  await assertSucceeds(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [] }));
  await assertFails(setDoc(doc(alice, 'runs', 'run-2'), { ...run, id: 'run-2' }));
});

test('staff cannot put the code word on the public meetup doc', async () => {
  const org = ctx(ORGANIZER);
  await assertFails(setDoc(doc(org, 'meetup_events', DATE), { id: DATE, date: DATE, codeWord: 'ACORN' }));
  await assertSucceeds(setDoc(doc(org, 'meetup_secrets', DATE), { codeWord: 'OAK' }));
});

test('same-night edit keeps run count and needs the code word', async () => {
  const alice = ctx(ALICE);
  await assertSucceeds(checkInBatch(alice, ALICE));
  const after1 = { ...baseUser(ALICE), totalRuns: 5, loggedRuns: 5, runCount: 5, totalMiles: 15.1, lastCheckInDate: DATE };
  const edit = (codeWord, totalRuns) => {
    const b = writeBatch(alice);
    b.set(doc(alice, 'checkins', `${DATE}_${ALICE}`), checkIn(ALICE, { codeWord, actualMiles: 5.2, updatedAt: '2026-11-11T18:30:00.000Z' }));
    const u = { ...after1, totalRuns, loggedRuns: totalRuns, runCount: totalRuns, totalMiles: 17.2 };
    b.set(doc(alice, 'users', ALICE), u);
    b.set(doc(alice, 'members', memberKeyFor(ALICE)), memberFromUser(u));
    return b.commit();
  };
  await assertFails(edit('ACORN', 6));
  await assertFails(edit('WRONG', 5));
  await assertSucceeds(edit('ACORN', 5));
});

test('duplicate milestone alert is rejected', async () => {
  const alice = ctx(ALICE);
  await assertSucceeds(checkInBatch(alice, ALICE, { milestone: true }));
  await assertFails(setDoc(doc(alice, 'milestone_alerts', `m5_${ALICE}`), { fulfilled: false }, { merge: true }));
});

// ---- Roles: promote / demote ----

const ADMIN = 'admin2@example.com';
const BOOTSTRAP = 'woodlandwoodchuckers@gmail.com';

async function seedAdmin() {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'users', ADMIN), baseUser(ADMIN, { role: 'admin' }));
  });
}

test('admin can promote a runner to organizer and admin, and demote back', async () => {
  await seedAdmin();
  const admin = ctx(ADMIN);
  await assertSucceeds(updateDoc(doc(admin, 'users', ALICE), { role: 'organizer' }));
  await assertSucceeds(updateDoc(doc(admin, 'users', ALICE), { role: 'admin' }));
  await assertSucceeds(updateDoc(doc(admin, 'users', ALICE), { role: 'member' }));
  await assertSucceeds(updateDoc(doc(admin, 'users', ORGANIZER), { role: 'member' }));
});

test('bootstrap admin email can change roles without a profile role', async () => {
  const boot = ctx(BOOTSTRAP);
  await assertSucceeds(updateDoc(doc(boot, 'users', ALICE), { role: 'organizer' }));
});

test('organizer cannot change anyone\'s role, including their own', async () => {
  const org = ctx(ORGANIZER);
  await assertFails(updateDoc(doc(org, 'users', ALICE), { role: 'organizer' }));
  await assertFails(updateDoc(doc(org, 'users', ORGANIZER), { role: 'admin' }));
});

test('organizer cannot edit or delete other profiles, or write others\' leaderboard rows', async () => {
  const org = ctx(ORGANIZER);
  await assertFails(updateDoc(doc(org, 'users', ALICE), { totalRuns: 999 }));
  await assertFails(deleteDoc(doc(org, 'users', ALICE)));
  await assertFails(setDoc(doc(org, 'members', memberKeyFor(ALICE)), memberFromUser({ ...baseUser(ALICE), totalRuns: 999 })));
});

test('organizer keeps event-night powers but not badges or settings', async () => {
  const org = ctx(ORGANIZER);
  await assertSucceeds(getDoc(doc(org, 'meetup_secrets', DATE)));
  await assertSucceeds(getDocs(collection(org, 'users')));
  await assertSucceeds(updateDoc(doc(org, 'runs', 'run-1'), { title: 'Renamed' }));
  await assertFails(setDoc(doc(org, 'badges', 'b1'), { name: 'x' }));
  await assertFails(setDoc(doc(org, 'settings', 's1'), { x: 1 }));
});

test('admin cannot change their own role or delete themselves', async () => {
  await seedAdmin();
  const admin = ctx(ADMIN);
  await assertFails(updateDoc(doc(admin, 'users', ADMIN), { role: 'member' }));
  await assertFails(deleteDoc(doc(admin, 'users', ADMIN)));
  await assertSucceeds(updateDoc(doc(admin, 'users', ADMIN), { shirtSize: 'L' }));
});

test('demoted admin loses admin rights', async () => {
  await seedAdmin();
  await assertSucceeds(updateDoc(doc(ctx(BOOTSTRAP), 'users', ADMIN), { role: 'member' }));
  await assertFails(updateDoc(doc(ctx(ADMIN), 'users', ALICE), { role: 'organizer' }));
  await assertFails(getDocs(collection(ctx(ADMIN), 'users')));
});

test('only bootstrap emails may self-create an admin profile', async () => {
  await assertSucceeds(setDoc(doc(ctx(BOOTSTRAP), 'users', BOOTSTRAP), freshUser(BOOTSTRAP, { role: 'admin' })));
  const carol = 'carol@example.com';
  await assertFails(setDoc(doc(ctx(carol), 'users', carol), freshUser(carol, { role: 'admin' })));
});

test('a former owner email is a normal admin: demotable, and cannot self-create admin', async () => {
  const MATT = 'mattsettles@gmail.com';
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'users', MATT), baseUser(MATT, { role: 'admin' }));
  });
  // Still an admin through the profile role
  await assertSucceeds(updateDoc(doc(ctx(MATT), 'users', ALICE), { role: 'organizer' }));
  // The club owner can demote them to organizer
  await assertSucceeds(updateDoc(doc(ctx(BOOTSTRAP), 'users', MATT), { role: 'organizer' }));
  await assertFails(updateDoc(doc(ctx(MATT), 'users', ALICE), { role: 'member' }));
  await assertSucceeds(getDoc(doc(ctx(MATT), 'meetup_secrets', DATE)));
  // Without a profile, it can't sign up as admin any more
  await env.withSecurityRulesDisabled(async (c) => {
    await deleteDoc(doc(c.firestore(), 'users', MATT));
  });
  await assertFails(setDoc(doc(ctx(MATT), 'users', MATT), freshUser(MATT, { role: 'admin' })));
});

// ---- Legacy (old app) claims ----

const LP = { id: 'matt-settles', name: 'MATT SETTLES', oldCount: 124, newCount: 129, totalRuns: 253, claimedBy: null, claimedAt: null };
const LP2 = { id: 'matt-l-settles', name: 'MATT L SETTLES', oldCount: 0, newCount: 5, totalRuns: 5, claimedBy: null, claimedAt: null };

async function seedLegacy() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'legacy_index', 'pool'), { entries: [LP, LP2].map(({ id, name, oldCount, newCount }) => ({ id, name, oldCount, newCount })) });
    for (const lp of [LP, LP2]) {
      await setDoc(doc(db, 'legacy_profiles', lp.id), lp);
      await setDoc(doc(db, 'legacy_history', lp.id), { events: [{ d: '2024-11-27', t: '18:00:00', c: 'TURKEY' }] });
    }
  });
}

function claimBatch(db, email, lps, { extraRuns = 0 } = {}) {
  const u = baseUser(email);
  const updated = {
    ...u,
    linkedLegacyIds: lps.map((l) => l.id),
    linkedLegacyNames: lps.map((l) => l.name),
    pre2021Runs: u.pre2021Runs + lps.reduce((s, l) => s + l.oldCount, 0),
    legacyEventRuns: lps.reduce((s, l) => s + l.newCount, 0),
    totalRuns: u.totalRuns + lps.reduce((s, l) => s + l.totalRuns, 0) + extraRuns,
  };
  const b = writeBatch(db);
  for (const l of lps) b.update(doc(db, 'legacy_profiles', l.id), { claimedBy: memberKeyFor(email), claimedAt: '2026-11-09T00:00:00Z' });
  b.set(doc(db, 'users', email), updated);
  b.set(doc(db, 'members', memberKeyFor(email)), memberFromUser(updated));
  return b;
}

test('legacy names are readable when signed in, not anonymously', async () => {
  await seedLegacy();
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'legacy_index', 'pool')));
  await assertFails(getDoc(doc(anon, 'legacy_profiles', LP.id)));
  await assertSucceeds(getDoc(doc(ctx(ALICE), 'legacy_index', 'pool')));
  await assertSucceeds(getDoc(doc(ctx(ALICE), 'legacy_profiles', LP.id)));
});

test('runner claims an unclaimed legacy name and gains exactly its runs', async () => {
  await seedLegacy();
  await assertSucceeds(claimBatch(ctx(ALICE), ALICE, [LP]).commit());
});

test('claimed legacy name is locked to its claimer', async () => {
  await seedLegacy();
  await assertSucceeds(claimBatch(ctx(ALICE), ALICE, [LP]).commit());
  await assertFails(claimBatch(ctx(BOB), BOB, [LP]).commit());
  // claimer cannot unclaim it themselves either
  await assertFails(updateDoc(doc(ctx(ALICE), 'legacy_profiles', LP.id), { claimedBy: null, claimedAt: null }));
});

test('claim must add exactly the legacy counts, one name per write', async () => {
  await seedLegacy();
  await assertFails(claimBatch(ctx(ALICE), ALICE, [LP], { extraRuns: 10 }).commit());
  await assertFails(claimBatch(ctx(ALICE), ALICE, [LP, LP2]).commit());
});

test('legacy history is private to the claimer and staff', async () => {
  await seedLegacy();
  await assertFails(getDoc(doc(ctx(ALICE), 'legacy_history', LP.id)));
  await assertSucceeds(claimBatch(ctx(ALICE), ALICE, [LP]).commit());
  await assertSucceeds(getDoc(doc(ctx(ALICE), 'legacy_history', LP.id)));
  await assertFails(getDoc(doc(ctx(BOB), 'legacy_history', LP.id)));
  await assertSucceeds(getDoc(doc(ctx(ORGANIZER), 'legacy_history', LP.id)));
});

test('admin can unclaim or reassign a legacy name and fix totals', async () => {
  await seedLegacy();
  await assertSucceeds(claimBatch(ctx(ALICE), ALICE, [LP]).commit());
  const admin = ctx(BOOTSTRAP);
  const b = writeBatch(admin);
  b.update(doc(admin, 'legacy_profiles', LP.id), { claimedBy: memberKeyFor(BOB), claimedAt: '2026-11-10T00:00:00Z' });
  b.update(doc(admin, 'users', ALICE), { linkedLegacyIds: [], linkedLegacyNames: [], pre2021Runs: 0, legacyEventRuns: 0, totalRuns: 4 });
  b.update(doc(admin, 'users', BOB), { linkedLegacyIds: [LP.id], linkedLegacyNames: [LP.name], pre2021Runs: 124, legacyEventRuns: 129, totalRuns: 257 });
  await assertSucceeds(b.commit());
  // organizers cannot
  await assertFails(updateDoc(doc(ctx(ORGANIZER), 'legacy_profiles', LP.id), { claimedBy: null, claimedAt: null }));
  await assertFails(setDoc(doc(ctx(ORGANIZER), 'legacy_index', 'pool'), { entries: [] }));
});

test('self sign-up must start with no runs, badges or legacy claims', async () => {
  const carol = 'carol@example.com';
  await assertFails(setDoc(doc(ctx(carol), 'users', carol), baseUser(carol)));
  await assertFails(setDoc(doc(ctx(carol), 'users', carol), freshUser(carol, { pre2021Runs: 50, totalRuns: 50 })));
  await assertSucceeds(setDoc(doc(ctx(carol), 'users', carol), freshUser(carol)));
});

test('runner can refresh badges and streaks but not touch totals that way', async () => {
  await assertSucceeds(updateDoc(doc(ctx(ALICE), 'users', ALICE), { unlockedBadgeIds: ['first-chuck'], badgeCounts: { 'first-chuck': 1 }, longestStreakWeeks: 3, currentStreakWeeks: 1 }));
  await assertFails(updateDoc(doc(ctx(ALICE), 'users', ALICE), { unlockedBadgeIds: [], totalRuns: 99 }));
  await assertFails(updateDoc(doc(ctx(ALICE), 'users', ALICE), { legacyEventRuns: 99 }));
});
