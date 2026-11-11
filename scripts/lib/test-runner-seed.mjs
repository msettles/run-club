/**
 * Test data for the gear-handout flow: one runner who has reached 5 runs but has NOT been handed the 5-run shirt.
 *
 * Everything is identifiable as test data (an @example.test email and `test-shirt-` ids) so it can be removed again,
 * and nothing in it uses fields the Firestore rules don't allow (so an admin can still edit these records in the app).
 * Pure data: callers supply `ts(date)` to build Firestore Timestamps. The runs are in the past, so they have no code words.
 */
import { createHash } from 'node:crypto';

export const TEST_EMAIL = 'test.runner.shirt@example.test';
export const memberKeyFor = (email) => createHash('sha256').update(`woodchuckers:${email.toLowerCase()}`).digest('hex');

const ymd = (d) => d.toISOString().slice(0, 10);

/** The most recent `count` Wednesdays strictly before `now`, oldest first. */
export function pastWednesdays(now, count) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - 1);
  while (day.getUTCDay() !== 3) day.setUTCDate(day.getUTCDate() - 1);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(day);
    d.setUTCDate(d.getUTCDate() - 7 * (count - 1 - i));
    return ymd(d);
  });
}

export const TEST2_EMAIL = 'test.runner.fifty@example.test';

/** Everything for one test runner: profile, public leaderboard row, and one check-in per run attended. */
function runnerDocs({ email, firstName, lastName, shirtSize, pre2021Runs, attended, runIds, dates, miles, key }) {
  const name = `${firstName} ${lastName}`;
  const logged = attended.length;
  const total = pre2021Runs + logged;
  const totalMiles = Math.round(logged * miles * 100) / 100;
  const lastIndex = attended[logged - 1];
  const firstIndex = attended[0];
  return [
    {
      path: `users/${email}`,
      data: {
        email, firstName, lastName, displayName: name, shirtSize,
        birthday: '1990-01-01', age: 36, city: 'Woodland', zipCode: '95695', preferredPace: '9:30 - 11:00 /mi',
        emergencyContact: { name: 'Test Contact', phone: '555-0100' },
        pre2021Runs, legacyEventRuns: 0, loggedRuns: logged, totalRuns: total, totalMiles,
        runCount: logged, walkCount: 0, petRunCount: 0, distanceCounts: { '3': logged, '3.1': logged, '3.1 mi': logged },
        firstRunDate: dates[firstIndex], lastCheckInDate: dates[lastIndex], lastCheckInRunId: runIds[lastIndex], lastCheckInUpdatedAt: `${dates[lastIndex]}T18:30:00.000Z`,
        currentStreakWeeks: logged, longestStreakWeeks: logged,
        linkedLegacyNames: [], linkedLegacyIds: [], unlockedBadgeIds: [], badgeCounts: {}, role: 'member',
        createdAt: `${dates[firstIndex]}T12:00:00.000Z`,
      },
    },
    {
      path: `members/${key}`,
      data: {
        id: key, name, totalRuns: total, totalMiles, runCount: logged, walkCount: 0, petRunCount: 0,
        streak: logged, favoritePace: '9:30 - 11:00 /mi', unlockedBadgeIds: [], badgeCounts: {}, joinedDate: dates[firstIndex], lastCheckInDate: dates[lastIndex],
      },
    },
    ...attended.map((i) => ({
      path: `checkins/${runIds[i]}_${email}`,
      data: {
        id: `${runIds[i]}_${email}`, runId: runIds[i], date: dates[i], time: '18:35:00', userEmail: email, runnerName: name, activity: 'running', distanceChoice: 'route-test',
        actualMiles: miles, routeName: 'Test 3.1 mi', loops: 1, withPet: false, source: 'admin', createdAt: `${dates[i]}T18:30:00.000Z`, updatedAt: `${dates[i]}T18:30:00.000Z`,
        eventTitle: `[TEST] Shirt test run ${i + 1}`, eventSpecial: 'none',
      },
    })),
  ];
}

/**
 * @param {{ now?: Date, ts: (iso: string) => unknown, sixthRun?: boolean, test2?: 49 | 50 | 51 }} options
 *   sixthRun: Test Runner (5 runs, shirt owed) also attended a 6th run, to see the owed shirt raised again.
 *   test2: also create "Test Runner 2" at 49, 50 or 51 total runs. 44 are earlier undated runs plus 5, 6 or 7 recent check-ins;
 *   at 50 or more the 50-run hat alert is pending (hat not handed out yet).
 * @returns {{ docs: { path: string, data: object }[], runIds: string[], alertId: string }}
 */
export function buildTestRunnerSeed({ now = new Date(), ts, sixthRun = false, test2 }) {
  const first = { email: TEST_EMAIL, key: memberKeyFor(TEST_EMAIL) };
  const miles = 3.1;
  const firstRuns = sixthRun ? 6 : 5;
  const second2 = test2 ? test2 - 44 : 0; // recent check-ins for Test Runner 2
  const runCount = Math.max(firstRuns, second2);
  const dates = pastWednesdays(now, runCount);
  const runIds = dates.map((_, i) => `test-shirt-run-${i + 1}`);
  const lastN = (n) => Array.from({ length: n }, (_, i) => runCount - n + i);
  const docs = [];

  // The runs (and their public check-in events) that the test runners attended; all in the past, so no code words.
  const used = new Set([...lastN(firstRuns), ...(second2 ? lastN(second2) : [])]);
  dates.forEach((date, i) => {
    if (!used.has(i)) return;
    const runId = runIds[i];
    const who = [];
    if (lastN(firstRuns).includes(i)) who.push(first.key);
    if (second2 && lastN(second2).includes(i)) who.push(memberKeyFor(TEST2_EMAIL));
    const names = { [first.key]: 'Test Runner', [memberKeyFor(TEST2_EMAIL)]: 'Test Runner 2' };
    const startsAt = `${date}T18:30:00.000Z`;
    docs.push({
      path: `runs/${runId}`,
      data: {
        id: runId, title: `[TEST] Shirt test run ${i + 1}`, date, time: '06:30 PM', locationName: 'Blue Note Brewing Company',
        address: 'Woodland, CA', distanceMiles: miles, surface: 'Pavement', elevationGainFt: 0, description: 'Test data for the gear handout flow. Safe to delete.',
        paceGroups: [], organizerName: 'Test Organizer',
        attendees: who.map((memberId) => ({ memberId, name: names[memberId], checkedIn: true, checkedInAt: startsAt, rsvpDate: startsAt })), attendeeIds: who,
      },
    });
    docs.push({
      path: `meetup_events/${runId}`,
      data: {
        id: runId, runId, date, time: '06:30 PM', title: `[TEST] Shirt test run ${i + 1}`, codeWordSet: true,
        activeDistances: ['route-test'], routes: { 'route-test': { name: 'Test 3.1 mi', actualMiles: miles, isLoop: false } },
        checkInOpensAt: ts(`${date}T23:30:00.000Z`), checkInClosesAt: ts(`${date}T23:59:59.000Z`),
      },
    });
  });

  // Test Runner: 5 runs, shirt not handed out.
  const attendedFirst = lastN(firstRuns);
  docs.push(...runnerDocs({ email: first.email, firstName: 'Test', lastName: 'Runner', shirtSize: 'M', pre2021Runs: 0, attended: attendedFirst, runIds, dates, miles, key: first.key }));
  const alertId = `m5_${first.email}`;
  docs.push({
    path: `milestone_alerts/${alertId}`,
    data: {
      id: alertId, userEmail: first.email, runnerName: 'Test Runner', shirtSize: 'M', milestoneRuns: 5, milestoneName: '5 Runs Milestone',
      reward: 'Official Woodchucker Member Shirt', perks: '$1 off all draft beers at Blue Note Brewing on run nights', hasGear: true,
      date: dates[attendedFirst[4]], time: '18:35:00', runId: runIds[attendedFirst[4]], fulfilled: false,
    },
  });

  // Test Runner 2: 49, 50 or 51 runs.
  if (test2) {
    const attended2 = lastN(second2);
    const key2 = memberKeyFor(TEST2_EMAIL);
    docs.push(...runnerDocs({ email: TEST2_EMAIL, firstName: 'Test', lastName: 'Runner 2', shirtSize: 'L', pre2021Runs: 44, attended: attended2, runIds, dates, miles, key: key2 }));
    if (test2 >= 50) {
      const hatRun = attended2[5]; // their 6th recent check-in is run number 50 overall
      docs.push({
        path: `milestone_alerts/m50_${TEST2_EMAIL}`,
        data: {
          id: `m50_${TEST2_EMAIL}`, userEmail: TEST2_EMAIL, runnerName: 'Test Runner 2', shirtSize: 'L', milestoneRuns: 50, milestoneName: '50 Runs Milestone',
          reward: 'Woodchucker Running Hat', perks: 'Official Club Headwear & Honor Roll', hasGear: true,
          date: dates[hatRun], time: '18:35:00', runId: runIds[hatRun], fulfilled: false,
        },
      });
    }
  }
  return { docs, runIds, alertId };
}
