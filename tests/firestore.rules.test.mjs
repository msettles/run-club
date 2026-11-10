import assert from 'node:assert/strict';
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
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, writeBatch, Timestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';

const memberKeyFor = (email) =>
  createHash('sha256').update(`woodchuckers:${email.toLowerCase()}`).digest('hex');

const DATE = '2026-11-11';
const RUN = 'run-1';
const codeKey = (date, word) => createHash('sha256').update(`${date}:${word.trim().toUpperCase()}`).digest('hex');
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
  streak: u.currentStreakWeeks || 0,
  favoritePace: 'Any',
  unlockedBadgeIds: u.unlockedBadgeIds,
  ...(u.badgeCounts ? { badgeCounts: u.badgeCounts } : {}),
  ...(u.petRunCount ? { petRunCount: u.petRunCount } : {}),
  joinedDate: '2026-01-01',
  ...(u.lastCheckInDate ? { lastCheckInDate: u.lastCheckInDate } : {}),
});

const checkIn = (email, extra = {}) => ({
  id: `${RUN}_${email}`,
  runId: RUN,
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
    await setDoc(doc(db, 'meetup_events', RUN), {
      id: RUN, runId: RUN, date: DATE, title: 'Wed', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } },
      checkInOpensAt: Timestamp.fromMillis(windowOpen ? now - 3600e3 : now + 3600e3),
      checkInClosesAt: Timestamp.fromMillis(now + 7200e3),
    });
    await setDoc(doc(db, 'meetup_secrets', RUN), { codeWord: 'ACORN' });
    await setDoc(doc(db, 'meetup_codes', codeKey(DATE, 'ACORN')), { runId: RUN, date: DATE });
    await setDoc(doc(db, 'users', ALICE), baseUser(ALICE));
    await setDoc(doc(db, 'users', BOB), baseUser(BOB));
    await setDoc(doc(db, 'users', ORGANIZER), baseUser(ORGANIZER, { role: 'organizer' }));
    await setDoc(doc(db, 'runs', 'run-1'), run);
  });
}

function checkInBatch(db, email, { codeWord = 'ACORN', bump = 1, milestone = false, rsvp = false } = {}) {
  const user = baseUser(email);
  const updated = {
    ...user,
    totalRuns: user.totalRuns + bump,
    loggedRuns: user.loggedRuns + bump,
    runCount: user.runCount + bump,
    totalMiles: user.totalMiles + 3.1,
    distanceCounts: { '3': 1, '3.1': 1, '3.1 mi': 1 },
    lastCheckInUpdatedAt: '2026-11-11T18:05:00.000Z',
    lastCheckInDate: DATE,
    lastCheckInRunId: RUN,
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'checkins', `${RUN}_${email}`), checkIn(email, { codeWord }));
  batch.set(doc(db, 'users', email), updated);
  batch.set(doc(db, 'members', memberKeyFor(email)), memberFromUser(updated));
  if (rsvp) {
    batch.update(doc(db, 'runs', RUN), { attendees: arrayUnion({
      memberId: memberKeyFor(email), name: user.displayName,
      checkedIn: false, rsvpDate: '2026-11-11T18:05:00.000Z',
    }), attendeeIds: arrayUnion(memberKeyFor(email)) });
  }
  if (milestone) {
    batch.set(doc(db, 'milestone_alerts', `m${updated.totalRuns}_${email}`), {
      id: `m${updated.totalRuns}_${email}`, userEmail: email, runnerName: updated.displayName,
      shirtSize: 'M', milestoneRuns: updated.totalRuns, milestoneName: '5 Runs', reward: 'Shirt',
      perks: '', date: DATE, time: '18:05:00', fulfilled: false, runId: RUN,
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
  await assertFails(getDoc(doc(anon, 'meetup_secrets', RUN)));
  await assertSucceeds(getDoc(doc(anon, 'meetup_events', RUN)));
  await assertSucceeds(getDocs(collection(anon, 'members')));
});

test('runner reads only their own profile and check-ins', async () => {
  const alice = ctx(ALICE);
  await assertSucceeds(getDoc(doc(alice, 'users', ALICE)));
  await assertFails(getDoc(doc(alice, 'users', BOB)));
  await assertFails(getDocs(collection(alice, 'users')));
  await assertFails(getDoc(doc(alice, 'meetup_secrets', RUN)));
  await assertSucceeds(getDocs(query(collection(alice, 'checkins'), where('userEmail', '==', ALICE))));
  await assertFails(getDocs(collection(alice, 'checkins')));
});

test('organizer role on users doc grants staff access', async () => {
  const org = ctx(ORGANIZER);
  await assertSucceeds(getDocs(collection(org, 'users')));
  await assertSucceeds(getDoc(doc(org, 'meetup_secrets', RUN)));
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
  await assertFails(updateDoc(doc(alice, 'users', ALICE), { totalRuns: 5, loggedRuns: 5, runCount: 5, lastCheckInDate: DATE, lastCheckInRunId: RUN }));
});

test('check-in with the right code word inside the window succeeds', async () => {
  await assertSucceeds(checkInBatch(ctx(ALICE), ALICE));
});

test('check-in and automatic RSVP save together and preserve other attendees', async () => {
  const bob = { memberId: memberKeyFor(BOB), name: 'Bob', checkedIn: false, rsvpDate: '2026-11-10' };
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'runs', RUN), { attendees: [bob] });
  });
  const alice = ctx(ALICE);
  await assertSucceeds(checkInBatch(alice, ALICE, { rsvp: true }));
  const saved = (await getDoc(doc(alice, 'runs', RUN))).data();
  assert.equal(saved.attendees.length, 2);
  assert.deepEqual(saved.attendees[0], bob);
  assert.equal(saved.attendees[1].memberId, memberKeyFor(ALICE));
  assert.equal((await getDoc(doc(alice, 'checkins', `${RUN}_${ALICE}`))).exists(), true);
});

test('a rejected check-in does not leave an automatic RSVP behind', async () => {
  const alice = ctx(ALICE);
  await assertFails(checkInBatch(alice, ALICE, { codeWord: 'WRONG', rsvp: true }));
  assert.deepEqual((await getDoc(doc(alice, 'runs', RUN))).data().attendees, []);
  await env.withSecurityRulesDisabled(async (c) => {
    assert.equal((await getDoc(doc(c.firestore(), 'checkins', `${RUN}_${ALICE}`))).exists(), false);
  });
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
  await assertFails(setDoc(doc(alice, 'checkins', `${RUN}_${BOB}`), checkIn(BOB)));
});

test('leaderboard row must mirror the user doc', async () => {
  const alice = ctx(ALICE);
  const fake = { ...memberFromUser(baseUser(ALICE)), totalRuns: 400 };
  await assertFails(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), fake));
  await assertSucceeds(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), memberFromUser(baseUser(ALICE))));
  await assertFails(setDoc(doc(alice, 'members', memberKeyFor(BOB)), memberFromUser(baseUser(BOB))));
});

test('leaderboard row may carry the last check-in date (for lapsed streaks), and only as a short string', async () => {
  const alice = ctx(ALICE);
  const row = memberFromUser(baseUser(ALICE));
  await assertFails(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), { ...row, lastCheckInDate: DATE }));
  await assertSucceeds(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), row));
  await assertFails(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), { ...row, lastCheckInDate: 20261111 }));
  await assertFails(setDoc(doc(alice, 'members', memberKeyFor(ALICE)), { ...row, lastCheckInDate: 'x'.repeat(31) }));
});

test('milestone alert only alongside the qualifying check-in, once', async () => {
  const alice = ctx(ALICE);
  await assertFails(setDoc(doc(alice, 'milestone_alerts', `m5_${ALICE}`), {
    id: `m5_${ALICE}`, userEmail: ALICE, runnerName: 'a', shirtSize: 'M', milestoneRuns: 5,
    milestoneName: '5', reward: 'Shirt', perks: '', date: DATE, time: 'x', fulfilled: false, runId: RUN,
  }));
  await assertSucceeds(checkInBatch(alice, ALICE, { milestone: true }));
});

test('runner can toggle only their own RSVP', async () => {
  const alice = ctx(ALICE);
  const mine = { memberId: memberKeyFor(ALICE), name: 'Alice', checkedIn: false, rsvpDate: '2026-11-10' };
  const bobs = { memberId: memberKeyFor(BOB), name: 'Bob', checkedIn: false, rsvpDate: '2026-11-10' };
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [bobs] }));
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { title: 'Hacked' }));
  const key = memberKeyFor(ALICE);
  // An RSVP must also record the runner in attendeeIds...
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [mine] }));
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [mine], attendeeIds: [memberKeyFor(BOB)] }));
  await assertSucceeds(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [mine], attendeeIds: [key] }));
  // ...so a second entry for the same runner is refused, however it is dressed up.
  const again = { ...mine, rsvpDate: '2026-11-11' };
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [mine, again] }));
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [mine, again], attendeeIds: [key, key] }));
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [mine, again], attendeeIds: [] }));
  // Leaving must clear the record too, and then the runner can RSVP again.
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [] }));
  await assertSucceeds(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: [], attendeeIds: [] }));
  await assertSucceeds(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: arrayUnion(again), attendeeIds: arrayUnion(key) }));
  // Bob's RSVP is independent of Alice's.
  await assertSucceeds(updateDoc(doc(ctx(BOB), 'runs', 'run-1'), { attendees: arrayUnion(bobs), attendeeIds: arrayUnion(memberKeyFor(BOB)) }));
  await assertFails(updateDoc(doc(alice, 'runs', 'run-1'), { attendees: arrayRemove(bobs), attendeeIds: arrayRemove(memberKeyFor(BOB)) }));
  await assertFails(setDoc(doc(alice, 'runs', 'run-2'), { ...run, id: 'run-2' }));
});

test('staff cannot put the code word on the public meetup doc', async () => {
  const org = ctx(ORGANIZER);
  await assertFails(setDoc(doc(org, 'meetup_events', RUN), { id: RUN, date: DATE, codeWord: 'ACORN' }));
  // Tonight's check-in is open, so its code word is locked (see the code word lock test)
  await assertFails(setDoc(doc(org, 'meetup_secrets', RUN), { codeWord: 'OAK' }));
});

test('same-night edit keeps run count and needs the code word', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'meetup_events', RUN), {
      activeDistances: ['route-3', 'route-5'],
      'routes.route-5': { actualMiles: 5.2, isLoop: false },
    });
  });
  const alice = ctx(ALICE);
  await assertSucceeds(checkInBatch(alice, ALICE));
  const after1 = { ...baseUser(ALICE), totalRuns: 5, loggedRuns: 5, runCount: 5, totalMiles: 15.1, distanceCounts: { '3': 1, '3.1': 1, '3.1 mi': 1 }, lastCheckInDate: DATE, lastCheckInRunId: RUN };
  const edit = (codeWord, totalRuns) => {
    const b = writeBatch(alice);
    b.set(doc(alice, 'checkins', `${RUN}_${ALICE}`), checkIn(ALICE, { codeWord, distanceChoice: 'route-5', actualMiles: 5.2, updatedAt: '2026-11-11T18:30:00.000Z' }));
    const u = { ...after1, lastCheckInUpdatedAt: '2026-11-11T18:30:00.000Z', totalRuns, loggedRuns: totalRuns, runCount: totalRuns, totalMiles: 17.2, distanceCounts: { '3': 0, '3.1': 0, '3.1 mi': 0, '5': 1, '5.2': 1, '5.2 mi': 1 } };
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
  await assertSucceeds(getDoc(doc(org, 'meetup_secrets', RUN)));
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
  await assertSucceeds(getDoc(doc(ctx(MATT), 'meetup_secrets', RUN)));
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

test('runner cannot award badges or streaks without attendance evidence', async () => {
  await assertFails(updateDoc(doc(ctx(ALICE), 'users', ALICE), { unlockedBadgeIds: ['first-chuck'], badgeCounts: { 'first-chuck': 1 }, longestStreakWeeks: 3, currentStreakWeeks: 1 }));
  await assertFails(updateDoc(doc(ctx(ALICE), 'users', ALICE), { unlockedBadgeIds: [], totalRuns: 99 }));
  await assertFails(updateDoc(doc(ctx(ALICE), 'users', ALICE), { legacyEventRuns: 99 }));
});

test('admin can delete a runner with their check-ins, row and claims; organizer cannot', async () => {
  await seedLegacy();
  await assertSucceeds(claimBatch(ctx(ALICE), ALICE, [LP]).commit());
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'checkins', `${RUN}_${ALICE}`), checkIn(ALICE));
  });
  await assertFails(deleteDoc(doc(ctx(ORGANIZER), 'users', ALICE)));
  await assertFails(deleteDoc(doc(ctx(ORGANIZER), 'members', memberKeyFor(ALICE))));

  const admin = ctx(BOOTSTRAP);
  const b = writeBatch(admin);
  b.delete(doc(admin, 'checkins', `${RUN}_${ALICE}`));
  b.update(doc(admin, 'legacy_profiles', LP.id), { claimedBy: null, claimedAt: null });
  b.delete(doc(admin, 'members', memberKeyFor(ALICE)));
  b.delete(doc(admin, 'users', ALICE));
  await assertSucceeds(b.commit());
  // The freed legacy name can be claimed by someone else
  await assertSucceeds(claimBatch(ctx(BOB), BOB, [LP]).commit());
});

// ---- Code word lock ----

test('code word can change before check-in opens, and is locked after', async () => {
  const FUTURE = '2099-01-07';
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'meetup_events', FUTURE), {
      id: FUTURE, date: FUTURE, title: 'Later', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } },
      checkInOpensAt: Timestamp.fromMillis(Date.now() + 86400e3),
      checkInClosesAt: Timestamp.fromMillis(Date.now() + 2 * 86400e3),
    });
    await setDoc(doc(db, 'meetup_secrets', FUTURE), { codeWord: 'ACORN' });
  });
  const org = ctx(ORGANIZER);
  // Not open yet: can change
  await assertSucceeds(setDoc(doc(org, 'meetup_secrets', FUTURE), { codeWord: 'PINECONE' }));
  // Tonight's event (seeded with an open window): locked, but re-saving the same word is fine
  await assertFails(setDoc(doc(org, 'meetup_secrets', RUN), { codeWord: 'CHANGED' }));
  await assertSucceeds(setDoc(doc(org, 'meetup_secrets', RUN), { codeWord: 'ACORN' }));
  await assertFails(setDoc(doc(ctx(BOOTSTRAP), 'meetup_secrets', RUN), { codeWord: 'CHANGED' }));
  // Runners can't touch it at all
  await assertFails(setDoc(doc(ctx(ALICE), 'meetup_secrets', FUTURE), { codeWord: 'X' }));
});

test('organizers can remove a run\'s code word only before its check-in opens', async () => {
  const FUTURE = '2099-01-07';
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'meetup_events', FUTURE), {
      id: FUTURE, date: FUTURE, title: 'Later', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } },
      checkInOpensAt: Timestamp.fromMillis(Date.now() + 86400e3),
      checkInClosesAt: Timestamp.fromMillis(Date.now() + 2 * 86400e3),
    });
    await setDoc(doc(db, 'meetup_secrets', FUTURE), { codeWord: 'ACORN' });
  });
  const org = ctx(ORGANIZER);
  await assertFails(deleteDoc(doc(ctx(ALICE), 'meetup_secrets', FUTURE)));
  // Tonight's check-in is open: only an admin may remove its code word.
  await assertFails(deleteDoc(doc(org, 'meetup_secrets', RUN)));
  // Deleting a run that has not opened removes the event and its code word together.
  const batch = writeBatch(org);
  batch.delete(doc(org, 'meetup_events', FUTURE));
  batch.delete(doc(org, 'meetup_secrets', FUTURE));
  await assertSucceeds(batch.commit());
  await assertSucceeds(deleteDoc(doc(ctx(BOOTSTRAP), 'meetup_secrets', RUN)));
});

// ---- One check-in per runner per run; the code word picks the run ----

async function seedSecondRun(word = 'PINECONE') {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const now = Date.now();
    await setDoc(doc(db, 'runs', 'run-2'), { ...run, id: 'run-2', time: '07:00 AM' });
    await setDoc(doc(db, 'meetup_events', 'run-2'), {
      id: 'run-2', runId: 'run-2', date: DATE, title: 'Morning', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } },
      checkInOpensAt: Timestamp.fromMillis(now - 3600e3),
      checkInClosesAt: Timestamp.fromMillis(now + 7200e3),
    });
    await setDoc(doc(db, 'meetup_secrets', 'run-2'), { codeWord: word });
    await setDoc(doc(db, 'meetup_codes', codeKey(DATE, word)), { runId: 'run-2', date: DATE });
  });
}

function checkInToRun(db, email, runId, codeWord, prev = baseUser(email)) {
  const updated = { ...prev, totalRuns: prev.totalRuns + 1, loggedRuns: prev.loggedRuns + 1, runCount: prev.runCount + 1, totalMiles: prev.totalMiles + 3.1, distanceCounts: Object.fromEntries(['3', '3.1', '3.1 mi'].map((k) => [k, (prev.distanceCounts?.[k] || 0) + 1])), lastCheckInDate: DATE, lastCheckInRunId: runId, lastCheckInUpdatedAt: `${runId}-updated` };
  const b = writeBatch(db);
  b.set(doc(db, 'checkins', `${runId}_${email}`), checkIn(email, { id: `${runId}_${email}`, runId, codeWord, updatedAt: `${runId}-updated` }));
  b.set(doc(db, 'users', email), updated);
  b.set(doc(db, 'members', memberKeyFor(email)), memberFromUser(updated));
  return { batch: b, updated };
}

test('the code word picks the run: another run\'s word is rejected', async () => {
  await seedSecondRun();
  const alice = ctx(ALICE);
  await assertFails(checkInToRun(alice, ALICE, 'run-2', 'ACORN').batch.commit());
  await assertSucceeds(checkInToRun(alice, ALICE, 'run-2', 'PINECONE').batch.commit());
});

test('two runs on one day: one check-in per run, each counts', async () => {
  await seedSecondRun();
  const alice = ctx(ALICE);
  const first = checkInToRun(alice, ALICE, RUN, 'ACORN');
  await assertSucceeds(first.batch.commit());
  await assertSucceeds(checkInToRun(alice, ALICE, 'run-2', 'PINECONE', first.updated).batch.commit());
});

test('a code word can only be used once per day', async () => {
  await seedSecondRun();
  const org = ctx(ORGANIZER);
  // ACORN is already run-1's word today
  await assertFails(setDoc(doc(org, 'meetup_codes', codeKey(DATE, 'ACORN')), { runId: 'run-2', date: DATE }));
  // A fresh word for a run that hasn't opened yet is fine
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'meetup_events', 'run-3'), {
      id: 'run-3', runId: 'run-3', date: '2099-01-07', title: 'Later', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } },
      checkInOpensAt: Timestamp.fromMillis(Date.now() + 86400e3), checkInClosesAt: Timestamp.fromMillis(Date.now() + 2 * 86400e3),
    });
  });
  await assertSucceeds(setDoc(doc(org, 'meetup_codes', codeKey('2099-01-07', 'ACORN')), { runId: 'run-3', date: '2099-01-07' }));
  // ...but not once that run's check-in is open
  await assertFails(deleteDoc(doc(org, 'meetup_codes', codeKey(DATE, 'ACORN'))));
});

test('runners can look up a code word key but not list them', async () => {
  const alice = ctx(ALICE);
  await assertSucceeds(getDoc(doc(alice, 'meetup_codes', codeKey(DATE, 'ACORN'))));
  await assertFails(getDocs(collection(alice, 'meetup_codes')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'meetup_codes', codeKey(DATE, 'ACORN'))));
  await assertFails(setDoc(doc(alice, 'meetup_codes', codeKey(DATE, 'MINE')), { runId: RUN, date: DATE }));
});

test('deleting a run with check-ins: admin rolls back runners; organizer cannot', async () => {
  // Alice checked into run-1 (check-in open, so the code word key is locked for organizers)
  const first = checkInToRun(ctx(ALICE), ALICE, RUN, 'ACORN');
  await assertSucceeds(first.batch.commit());

  // Organizer can't rewrite Alice's stats
  const org = ctx(ORGANIZER);
  // ...and can't remove the check-in on its own either (that would skip the rollback)
  await assertFails(deleteDoc(doc(org, 'checkins', `${RUN}_${ALICE}`)));
  await assertFails(deleteDoc(doc(ctx(ALICE), 'checkins', `${RUN}_${ALICE}`)));
  const ob = writeBatch(org);
  ob.delete(doc(org, 'checkins', `${RUN}_${ALICE}`));
  ob.set(doc(org, 'users', ALICE), baseUser(ALICE));
  await assertFails(ob.commit());

  // Admin: per-runner rollback, then the run, its event, code key and secret
  const admin = ctx(BOOTSTRAP);
  const b = writeBatch(admin);
  b.delete(doc(admin, 'checkins', `${RUN}_${ALICE}`));
  b.set(doc(admin, 'users', ALICE), baseUser(ALICE));
  b.set(doc(admin, 'members', memberKeyFor(ALICE)), memberFromUser(baseUser(ALICE)));
  await assertSucceeds(b.commit());
  const b2 = writeBatch(admin);
  b2.delete(doc(admin, 'runs', RUN));
  b2.delete(doc(admin, 'meetup_events', RUN));
  b2.delete(doc(admin, 'meetup_codes', codeKey(DATE, 'ACORN')));
  b2.delete(doc(admin, 'meetup_secrets', RUN));
  await assertSucceeds(b2.commit());
});

test('creating a run with a code word already used that day saves nothing', async () => {
  const org = ctx(ORGANIZER);
  const later = { opens: Timestamp.fromMillis(Date.now() + 3600e3), closes: Timestamp.fromMillis(Date.now() + 7200e3) };
  const create = (id, word) => {
    const b = writeBatch(org);
    b.set(doc(org, 'runs', id), { ...run, id, attendees: [] });
    b.set(doc(org, 'meetup_events', id), { id, runId: id, date: DATE, title: 'X', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } }, codeWordSet: true, checkInOpensAt: later.opens, checkInClosesAt: later.closes });
    b.set(doc(org, 'meetup_secrets', id), { codeWord: word });
    b.set(doc(org, 'meetup_codes', codeKey(DATE, word)), { runId: id, date: DATE });
    return b.commit();
  };
  await assertFails(create('run-dup', 'ACORN')); // ACORN is run-1's word today
  await env.withSecurityRulesDisabled(async (c) => {
    const snap = await getDoc(doc(c.firestore(), 'runs', 'run-dup'));
    if (snap.exists()) throw new Error('run was saved despite the duplicate code word');
  });
  await assertSucceeds(create('run-ok', 'WALNUT'));
});

test('a run that is not live has no open check-in and no code word lock', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'runs', 'run-draft'), { ...run, id: 'run-draft' });
  });
  const org = ctx(ORGANIZER);
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'meetup_events', 'run-draft'), {
      id: 'run-draft', runId: 'run-draft', date: DATE, title: 'Draft', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } }, codeWordSet: false,
      checkInOpensAt: Timestamp.fromMillis(Date.now() - 3600e3), checkInClosesAt: Timestamp.fromMillis(Date.now() + 7200e3),
    });
  });
  // Not live, inside its window: setting the code word is allowed
  await assertSucceeds(setDoc(doc(org, 'meetup_codes', codeKey(DATE, 'HOME')), { runId: 'run-draft', date: DATE }));
  await assertSucceeds(setDoc(doc(org, 'meetup_secrets', 'run-draft'), { codeWord: 'HOME' }));
  // ...but nobody can check in while it's not live, even with the right word
  await assertFails(checkInToRun(ctx(ALICE), ALICE, 'run-draft', 'HOME').batch.commit());
  // Go live: check-in works, the word is locked, and it can't be switched back to not live
  await assertSucceeds(updateDoc(doc(org, 'meetup_events', 'run-draft'), { codeWordSet: true }));
  await assertSucceeds(checkInToRun(ctx(ALICE), ALICE, 'run-draft', 'HOME').batch.commit());
  await assertFails(setDoc(doc(org, 'meetup_codes', codeKey(DATE, 'AWAY')), { runId: 'run-draft', date: DATE }));
  await assertFails(setDoc(doc(org, 'meetup_secrets', 'run-draft'), { codeWord: 'AWAY' }));
  await assertFails(updateDoc(doc(org, 'meetup_events', 'run-draft'), { codeWordSet: false }));
});

test('past runs can\'t be edited; RSVP clean-up and admin delete still work', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'runs', 'run-past'), { ...run, id: 'run-past', attendees: [{ memberId: memberKeyFor(ALICE), name: 'Alice', checkedIn: false, rsvpDate: 'x' }] });
    await setDoc(doc(db, 'meetup_events', 'run-past'), {
      id: 'run-past', runId: 'run-past', date: '2026-01-07', title: 'Past', activeDistances: ['route-3'], routes: { 'route-3': { actualMiles: 3.1, isLoop: false } },
      checkInOpensAt: Timestamp.fromMillis(Date.now() - 3 * 86400e3), checkInClosesAt: Timestamp.fromMillis(Date.now() - 2 * 86400e3),
    });
  });
  const org = ctx(ORGANIZER);
  await assertFails(updateDoc(doc(org, 'runs', 'run-past'), { title: 'Renamed' }));
  await assertFails(updateDoc(doc(org, 'meetup_events', 'run-past'), { title: 'Renamed' }));
  await assertSucceeds(updateDoc(doc(org, 'runs', 'run-past'), { attendees: [] }));
  // Upcoming/open runs are still editable
  await assertSucceeds(updateDoc(doc(org, 'runs', RUN), { title: 'Renamed' }));
  // Admin can delete the past run and its event
  const admin = ctx(BOOTSTRAP);
  await assertSucceeds(deleteDoc(doc(admin, 'meetup_events', 'run-past')));
  await assertSucceeds(deleteDoc(doc(admin, 'runs', 'run-past')));
});

// ---- Push devices ----

test('runners record their own push device; only admins can read the list', async () => {
  const { serverTimestamp } = await import('firebase/firestore');
  const token = 'fcm-token-abc123';
  const id = createHash('sha256').update(token).digest('hex');
  const device = (email) => ({ token, userEmail: email, memberKey: memberKeyFor(email), platform: 'android', updatedAt: serverTimestamp() });
  const alice = ctx(ALICE);
  await assertSucceeds(setDoc(doc(alice, 'push_devices', id), device(ALICE)));
  // Wrong doc ID for the token, or someone else's email: refused
  await assertFails(setDoc(doc(alice, 'push_devices', 'not-the-hash'), device(ALICE)));
  await assertFails(setDoc(doc(alice, 'push_devices', id), device(BOB)));
  // Shared phone: Bob, holding the same token, can take it over
  await assertSucceeds(setDoc(doc(ctx(BOB), 'push_devices', id), device(BOB)));
  // Runners and organizers can't list devices; admins can
  await assertFails(getDocs(collection(alice, 'push_devices')));
  await assertFails(getDocs(collection(ctx(ORGANIZER), 'push_devices')));
  await assertSucceeds(getDocs(collection(ctx(BOOTSTRAP), 'push_devices')));
  // Owner can remove it; anonymous can't write
  await assertSucceeds(deleteDoc(doc(ctx(BOB), 'push_devices', id)));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'push_devices', id), device(ALICE)));
});

test('announcements: public read, admins post and delete, no edits', async () => {
  const a = { id: 'notif-1', title: 'Run tonight', body: 'Meet at 6', timestamp: '2026-11-11T18:00:00.000Z', sender: 'Club' };
  await assertFails(setDoc(doc(ctx(ORGANIZER), 'announcements', a.id), a));
  await assertFails(setDoc(doc(ctx(ALICE), 'announcements', a.id), a));
  await assertFails(setDoc(doc(ctx(BOOTSTRAP), 'announcements', a.id), { ...a, targetRunId: null }));
  await assertSucceeds(setDoc(doc(ctx(BOOTSTRAP), 'announcements', a.id), a));
  await assertSucceeds(getDocs(collection(env.unauthenticatedContext().firestore(), 'announcements')));
  await assertFails(updateDoc(doc(ctx(BOOTSTRAP), 'announcements', a.id), { title: 'Edited' }));
  await assertFails(deleteDoc(doc(ctx(ALICE), 'announcements', a.id)));
  await assertSucceeds(deleteDoc(doc(ctx(BOOTSTRAP), 'announcements', a.id)));
});

test('a locked code-word change rolls back the entire run edit', async () => {
  const db = ctx(ORGANIZER);
  const batch = writeBatch(db);
  batch.update(doc(db, 'runs', RUN), { title: 'Should not save' });
  batch.update(doc(db, 'meetup_events', RUN), { title: 'Should not save' });
  batch.set(doc(db, 'meetup_secrets', RUN), { codeWord: 'CHANGED' });
  await assertFails(batch.commit());
  assert.equal((await getDoc(doc(db, 'runs', RUN))).data().title, run.title);
  assert.equal((await getDoc(doc(db, 'meetup_secrets', RUN))).data().codeWord, 'ACORN');
});

test('a pre-window run edit saves its code word atomically and preserves RSVPs', async () => {
  await env.clearFirestore();
  await seed({ windowOpen: false });
  const attendee = { memberId: memberKeyFor(BOB), name: 'Bob', checkedIn: false, rsvpDate: 'original' };
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'runs', RUN), { attendees: [attendee] });
  });
  const db = ctx(ORGANIZER);
  const batch = writeBatch(db);
  batch.update(doc(db, 'runs', RUN), { title: 'New title' });
  batch.update(doc(db, 'meetup_events', RUN), { title: 'New title', codeWordSet: true });
  batch.set(doc(db, 'meetup_secrets', RUN), { codeWord: 'LEAF' });
  batch.set(doc(db, 'meetup_codes', codeKey(DATE, 'LEAF')), { runId: RUN, date: DATE });
  batch.delete(doc(db, 'meetup_codes', codeKey(DATE, 'ACORN')));
  await assertSucceeds(batch.commit());
  const saved = (await getDoc(doc(db, 'runs', RUN))).data();
  assert.equal(saved.title, 'New title');
  assert.deepEqual(saved.attendees, [attendee]);
  assert.equal((await getDoc(doc(db, 'meetup_secrets', RUN))).data().codeWord, 'LEAF');
  assert.equal((await getDoc(doc(db, 'meetup_codes', codeKey(DATE, 'ACORN')))).exists(), false);
});


test('mileage must match an active route and edits apply only the mileage delta', async () => {
  const alice = ctx(ALICE);
  await assertFails(setDoc(doc(alice, 'checkins', `${RUN}_${ALICE}`), checkIn(ALICE, { distanceChoice: 'unknown', actualMiles: 50 })));
  await assertFails(setDoc(doc(alice, 'checkins', `${RUN}_${ALICE}`), checkIn(ALICE, { actualMiles: 50 })));
  await assertSucceeds(checkInBatch(alice, ALICE));
  const batch = writeBatch(alice);
  batch.update(doc(alice, 'checkins', `${RUN}_${ALICE}`), { updatedAt: '2026-11-11T18:45:00.000Z' });
  batch.update(doc(alice, 'users', ALICE), { totalMiles: 18.2 });
  await assertFails(batch.commit());
});

test('deletion fences reject new check-ins', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'runs', RUN), { deleting: true });
  });
  await assertFails(checkInBatch(ctx(ALICE), ALICE));
});

test('an opened event cannot be rescheduled to unlock its code word', async () => {
  await assertFails(updateDoc(doc(ctx(ORGANIZER), 'meetup_events', RUN), {
    checkInOpensAt: Timestamp.fromMillis(Date.now() + 3600000),
  }));
});

test('a loop route can credit up to its loop limit, but fractional-cent mileage cannot accumulate', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'meetup_events', RUN), { 'routes.route-3.isLoop': true, 'routes.route-3.maxLoops': 20 });
  });
  const alice = ctx(ALICE);
  const c = checkIn(ALICE, { actualMiles: 62, loops: 20 });
  const u = { ...baseUser(ALICE), totalRuns: 5, loggedRuns: 5, runCount: 5, totalMiles: 74,
    lastCheckInDate: DATE, lastCheckInRunId: RUN, lastCheckInUpdatedAt: c.updatedAt,
    distanceCounts: { '5': 1, '62.0': 1, '62.0 mi': 1 } };
  const batch = writeBatch(alice);
  batch.set(doc(alice, 'checkins', c.id), c);
  batch.set(doc(alice, 'users', ALICE), u);
  await assertSucceeds(batch.commit());
  const edit = writeBatch(alice);
  edit.update(doc(alice, 'checkins', c.id), { actualMiles: 62.004, updatedAt: '2026-11-11T19:00:00Z' });
  edit.update(doc(alice, 'users', ALICE), { totalMiles: 74.004, lastCheckInUpdatedAt: '2026-11-11T19:00:00Z' });
  await assertFails(edit.commit());
});

test('the loop setting on a loop route caps what a runner can log', async () => {
  const attempt = async (loops, maxLoops) => {
    await env.clearFirestore();
    await seed();
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(doc(c.firestore(), 'meetup_events', RUN), { 'routes.route-3.isLoop': true, ...(maxLoops ? { 'routes.route-3.maxLoops': maxLoops } : {}) });
    });
    const alice = ctx(ALICE);
    const miles = Math.round(3.1 * loops * 100) / 100;
    const c = checkIn(ALICE, { actualMiles: miles, loops });
    const label = miles.toFixed(1);
    const u = { ...baseUser(ALICE), totalRuns: 5, loggedRuns: 5, runCount: 5, totalMiles: 12 + miles,
      lastCheckInDate: DATE, lastCheckInRunId: RUN, lastCheckInUpdatedAt: c.updatedAt,
      distanceCounts: { [miles <= 2 ? '1' : miles <= 4 ? '3' : '5']: 1, [label]: 1, [`${label} mi`]: 1 } };
    const batch = writeBatch(alice);
    batch.set(doc(alice, 'checkins', c.id), c);
    batch.set(doc(alice, 'users', ALICE), u);
    return batch.commit();
  };
  await assertSucceeds(attempt(3, 3));
  await assertFails(attempt(4, 3));
  await assertSucceeds(attempt(6, 6));
  await assertFails(attempt(7, 6));
  // A route saved without a setting allows the default of 4.
  await assertSucceeds(attempt(4));
  await assertFails(attempt(5));
});
