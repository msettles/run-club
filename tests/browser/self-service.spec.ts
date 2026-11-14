import { test, expect, STORAGE_KEYS, email, run, event, runner } from './fixtures';

async function profileMenu(page: import('@playwright/test').Page) {
  await page.getByTitle('Runner Profile & Menu').click();
}

test('My Runs shows only the signed-in runner, separates undated credits and pages without deleting history', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ keys, email, runner }) => {
    const profile = { ...runner, pre2021Runs: 3, loggedRuns: 26, totalRuns: 29, totalMiles: 78, runCount: 26 };
    localStorage.setItem(keys.USERS, JSON.stringify([profile]));
    const own = Array.from({ length: 26 }, (_, i) => ({ id: `history-${i}_${email}`, runId: `history-${i}`, date: `2026-10-${String(i + 1).padStart(2, '0')}`, time: '18:30:00', userEmail: email, runnerName: profile.displayName, eventTitle: `Personal History Run ${i}`, routeName: 'Recorded route', activity: 'running', distanceChoice: 'route', actualMiles: 3, withPet: i === 25, loops: 1, source: 'pwa', createdAt: '2026-10-01T18:30:00Z' }));
    localStorage.setItem(keys.CHECKINS, JSON.stringify([...own, { ...own[0], id: 'private-other', userEmail: 'other@example.test', eventTitle: 'Do not reveal other history' }]));
  }, { keys: STORAGE_KEYS, email, runner });
  await page.reload(); await profileMenu(page);
  await page.getByRole('button', { name: 'My Runs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My Runs', exact: true })).toBeVisible();
  await expect(page.getByText('3 undated historical credits', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Personal History Run 25', exact: true })).toBeVisible();
  await expect(page.getByText('Do not reveal other history', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('my-runs.png'), fullPage: false });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Personal History Run 0', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).length, STORAGE_KEYS.CHECKINS)).toBe(27);
});

test('a signed-in member can claim an additional historical name once from the profile', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((keys) => localStorage.setItem(keys.LEGACY_MEMBERS, JSON.stringify([{ id: 'browser-old-name', name: 'BROWSER FORMER NAME', oldCount: 2, newCount: 0, totalRuns: 2, claimedBy: null, claimedByEmail: null, claimedAt: null }])), STORAGE_KEYS);
  await page.reload(); await profileMenu(page);
  await page.getByRole('button', { name: 'Claim historical runs', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Claim historical runs', exact: true });
  await dialog.getByRole('searchbox', { name: 'Search historical names' }).fill('BROWSER FORMER');
  await dialog.getByRole('button', { name: /BROWSER FORMER NAME/ }).click();
  await expect(dialog.getByText(/Shared dated runs already in your history count once/)).toBeVisible();
  await dialog.screenshot({ path: test.info().outputPath('claim-history.png') });
  await dialog.getByRole('button', { name: 'Confirm this is my history', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Your total is 2 runs');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload(); await profileMenu(page);
  await page.getByRole('button', { name: 'Claim historical runs', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('BROWSER FORMER NAME', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('searchbox').fill('BROWSER FORMER');
  await expect(page.getByRole('dialog').getByRole('button', { name: /BROWSER FORMER NAME/ })).toHaveCount(0);
});

test.describe('Run Night', () => {
  test.use({ staff: true });
  test('assisted check-in updates live counts and gear once, with a retained staff audit', async ({ page }) => {
    const target = { ...runner, email: 'table-runner@example.test', displayName: 'Table Runner', firstName: 'Table', lastName: 'Runner', totalRuns: 4, loggedRuns: 4, totalMiles: 12, runCount: 4 };
    await page.goto('/');
    await page.evaluate(({ keys, target }) => {
      const users = JSON.parse(localStorage.getItem(keys.USERS)!); users.push(target); localStorage.setItem(keys.USERS, JSON.stringify(users));
    }, { keys: STORAGE_KEYS, target });
    await page.reload();
    await page.getByRole('button', { name: 'Run Night / Table Mode', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Run Night / Table Mode', exact: true })).toBeVisible();
    await expect(page.getByText('ACORN', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Assist check-in', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Assist a runner check-in' });
    await dialog.getByRole('searchbox', { name: 'Find a registered runner' }).fill('Table Runner');
    await dialog.getByRole('button', { name: /Table Runner table-runner@example.test/ }).click();
    await dialog.getByLabel('Activity', { exact: true }).selectOption('walking');
    await dialog.getByRole('checkbox', { name: 'With a pet', exact: true }).check();
    await dialog.getByRole('button', { name: 'Confirm assisted check-in', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('Checked in successfully');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Live check-in feed', exact: true })).toBeVisible();
    await expect(page.getByText('Table Runner 🐕', { exact: true })).toBeVisible();
    await expect(page.getByText(/3.00 miles · walking/)).toBeVisible();
    await expect(page.locator('dl > div').filter({ hasText: 'Checked in' }).getByRole('definition')).toHaveText('1');
    await expect(page.locator('dl > div').filter({ hasText: 'Walking' }).getByRole('definition')).toHaveText('1');
    await expect(page.locator('dl > div').filter({ hasText: 'With a pet' }).getByRole('definition')).toHaveText('1');
    await page.screenshot({ path: test.info().outputPath('run-night.png'), fullPage: false });
    await page.getByRole('button', { name: 'Mark delivered', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mark delivered', exact: true })).toHaveCount(0);
    const audit = await page.evaluate(() => JSON.parse(localStorage.getItem('woodchuckers-assisted-checkins') || '{}'));
    expect(audit[`${run.id}_${target.email}`].assistedBy).toBe(email);
    const checkins = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEYS.CHECKINS);
    expect(checkins.filter((c: { userEmail: string }) => c.userEmail === target.email)).toHaveLength(1);
  });

  test('closed windows disable assistance and preserve the code-word lock', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(({ keys, event }) => localStorage.setItem(keys.MEETUP_EVENTS, JSON.stringify([{ ...event, date: '2026-11-18', time: '06:30 PM' }])) , { keys: STORAGE_KEYS, event });
    await page.evaluate(({ keys, run }) => localStorage.setItem(keys.RUNS, JSON.stringify([{ ...run, date: '2026-11-18' }])) , { keys: STORAGE_KEYS, run });
    await page.reload();
    await page.getByRole('button', { name: 'Run Night / Table Mode', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Assist check-in', exact: true })).toBeDisabled();
    await expect(page.getByText(/Check-in opens/)).toBeVisible();
  });
});
