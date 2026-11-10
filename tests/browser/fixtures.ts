import { test as base, expect } from '@playwright/test';
import { STORAGE_KEYS } from '../../src/services/store/helpers';
import type { UserProfile, RunEvent, MeetupEvent, GPXRoute } from '../../src/types';

export const email = 'browser-runner@example.test';
export const runner: UserProfile = { email, firstName: 'Browser', lastName: 'Runner', displayName: 'Browser Runner', shirtSize: 'M', pre2021Runs: 0, loggedRuns: 0, totalRuns: 0, totalMiles: 0, runCount: 0, walkCount: 0, linkedLegacyNames: [], linkedLegacyIds: [], unlockedBadgeIds: [], role: 'member', createdAt: '2026-11-01T00:00:00Z' };
export const route: GPXRoute = { id: 'browser-route', name: 'Browser Test Route', description: 'Synthetic route', distanceMiles: 3, elevationGainFt: 0, surface: 'Pavement', difficulty: 'Easy', points: [], directions: [], createdAt: '2026-11-01T00:00:00Z', isLoop: false };
export const run: RunEvent = { id: 'browser-run', title: 'Browser Test Run', date: '2026-11-11', time: '06:00 PM', locationName: 'Test Patio', address: 'Test address', distanceMiles: 3, surface: 'Pavement', elevationGainFt: 0, description: 'Synthetic browser event', routeId: route.id, routeChoices: [{ routeId: route.id }], paceGroups: [], attendees: [], organizerName: 'Test Organizer' };
export const event: MeetupEvent = { id: run.id, runId: run.id, title: run.title, date: run.date, time: run.time, codeWord: 'ACORN', codeWordSet: true, activeDistances: [route.id], routes: { [route.id]: { routeId: route.id, name: route.name, actualMiles: 3, isLoop: false } } };

export const test = base.extend({
  page: async ({ page }, use) => {
    // Freeze wall time, keeping browser timers active for React and network handling.
    await page.clock.setFixedTime(new Date('2026-11-12T02:30:00Z'));
    await page.route('**/*', (request) => {
      const url = new URL(request.request().url());
      return url.hostname === '127.0.0.1' ? request.continue() : request.abort();
    });
    await page.addInitScript(({ keys, profile, run, event, route }) => {
      if (localStorage.getItem('browser-fixture-ready')) return;
      localStorage.clear();
      for (const [key, value] of Object.entries({ [keys.USERS]: [profile], [keys.RUNS]: [run], [keys.MEETUP_EVENTS]: [event], [keys.ROUTES]: [route], [keys.CURRENT_USER_EMAIL]: profile.email, [keys.CHECKINS]: [] })) localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem('browser-fixture-ready', 'true');
    }, { keys: STORAGE_KEYS, profile: runner, run, event, route });
    await use(page);
  },
});
export { expect, STORAGE_KEYS };
