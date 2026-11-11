import { test, expect, STORAGE_KEYS, email, run, event, route } from './fixtures';

async function stored(page: import('@playwright/test').Page, key: string) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), key);
}
async function openCheckIn(page: import('@playwright/test').Page) {
  await page.goto('/?checkin=true');
  const dialog = page.getByRole('dialog', { name: 'Run check-in', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function saveCheckIn(page: import('@playwright/test').Page) {
  const dialog = await openCheckIn(page);
  await dialog.getByPlaceholder(/Enter today's code word/).fill('ACORN');
  await dialog.getByRole('button', { name: /Check In for 3/ }).click();
  await expect(dialog.getByText('Your check-in is saved.', { exact: false })).toBeVisible();
  return dialog;
}

test('QR check-in commits attendance and RSVP before the optional screens, surviving reload', async ({ page }) => {
  const dialog = await saveCheckIn(page);
  await expect.poll(async () => (await stored(page, STORAGE_KEYS.CHECKINS)).filter((item: { runId: string }) => item.runId === run.id).length).toBe(1);
  const records = await stored(page, STORAGE_KEYS.CHECKINS);
  expect(records.find((record: { userEmail: string }) => record.userEmail === email)).toMatchObject({ actualMiles: 3, activity: 'running', loops: 1 });
  const runs = await stored(page, STORAGE_KEYS.RUNS);
  expect(runs.find((item: { id: string }) => item.id === run.id).attendees).toEqual([expect.objectContaining({ checkedIn: true })]);
  await dialog.getByRole('button', { name: /Close/ }).first().click();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Run check-in' }).getByText(/Your check-in is saved/)).toBeVisible();
  expect((await stored(page, STORAGE_KEYS.USERS)).find((user: { email: string }) => user.email === email)).toMatchObject({ totalRuns: 1, totalMiles: 3 });
});

test('incorrect code word keeps choices editable and does not write attendance', async ({ page }) => {
  const dialog = await openCheckIn(page);
  await dialog.getByPlaceholder(/Enter today's code word/).fill('WRONG');
  await dialog.getByRole('button', { name: /Check In for 3/ }).click();
  await expect(dialog.getByText(/code word doesn.t match this run/)).toBeVisible();
  expect(await stored(page, STORAGE_KEYS.CHECKINS)).toEqual([]);
  await dialog.getByPlaceholder(/Enter today's code word/).fill('ACORN');
  await dialog.getByRole('button', { name: /Check In for 3/ }).click();
  await expect(dialog.getByText(/Your check-in is saved/)).toBeVisible();
});

test('fresh success can be edited without duplicating the run or RSVP', async ({ page }) => {
  const dialog = await saveCheckIn(page);
  await dialog.getByRole('button', { name: /Change Distance/ }).click();
  await dialog.getByRole('button', { name: /Walking/ }).click();
  await dialog.getByRole('button', { name: /Update Check-In/ }).click();
  await expect(dialog.getByText(/Your check-in is saved/)).toBeVisible();
  await expect.poll(async () => (await stored(page, STORAGE_KEYS.CHECKINS))[0]?.activity).toBe('walking');
  expect((await stored(page, STORAGE_KEYS.USERS)).find((user: { email: string }) => user.email === email)).toMatchObject({ totalRuns: 1, totalMiles: 3, runCount: 0, walkCount: 1 });
  expect((await stored(page, STORAGE_KEYS.RUNS)).find((item: { id: string }) => item.id === run.id).attendees).toHaveLength(1);
});

test('sign-in dialog traps keyboard focus and restores its opener with Escape', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify('')), STORAGE_KEYS.CURRENT_USER_EMAIL);
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Sign In', exact: true });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Sign in', exact: true });
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Send Magic Sign-In Link' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close window' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('a loop route offers exactly its allowed loop counts and credits the chosen one', async ({ page }) => {
  const loopEvent = { ...event, routes: { [route.id]: { ...event.routes[route.id], isLoop: true, baseMiles: 3, maxLoops: 3 } } };
  await page.addInitScript(({ key, events }) => {
    if (!localStorage.getItem('loop-fixture-ready')) localStorage.setItem(key, JSON.stringify(events));
    localStorage.setItem('loop-fixture-ready', 'true');
  }, { key: STORAGE_KEYS.MEETUP_EVENTS, events: [loopEvent] });
  const dialog = await openCheckIn(page);
  const loops = dialog.getByRole('group', { name: 'How many loops are you doing?' });
  await expect(loops.getByRole('button')).toHaveCount(3);
  await expect(dialog.getByTitle('More loops')).toHaveCount(0);
  await loops.getByRole('button', { name: /^3 loops,/ }).click();
  await expect(loops.getByRole('button', { name: /^3 loops,/ })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByPlaceholder(/Enter today's code word/).fill('ACORN');
  await dialog.getByRole('button', { name: /Check In for 3 Loops \(9\.0 mi\)/ }).click();
  await expect(dialog.getByText('Your check-in is saved.', { exact: false })).toBeVisible();
  const records = await stored(page, STORAGE_KEYS.CHECKINS);
  expect(records.find((record: { userEmail: string }) => record.userEmail === email)).toMatchObject({ actualMiles: 9, loops: 3 });
});

test('offline check-in edits keep choices and saved attendance until the runner retries online', async ({ page, context }) => {
  const dialog = await saveCheckIn(page);
  await dialog.getByRole('button', { name: /Change Distance/ }).click();
  await dialog.getByRole('button', { name: /Walk/ }).click();
  await context.setOffline(true);
  await dialog.getByRole('button', { name: /Update Check-In/ }).click();
  await expect(dialog.getByText(/You're offline/)).toBeVisible();
  expect((await stored(page, STORAGE_KEYS.CHECKINS))[0].activity).toBe('running');
  await context.setOffline(false);
  await dialog.getByRole('button', { name: /Update Check-In/ }).click();
  await expect(dialog.getByText(/Your check-in is saved/)).toBeVisible();
  expect((await stored(page, STORAGE_KEYS.CHECKINS))[0].activity).toBe('walking');
  expect(await stored(page, STORAGE_KEYS.CHECKINS)).toHaveLength(1);
});
