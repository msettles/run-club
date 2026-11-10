import { readFile } from 'node:fs/promises';
import { test, expect, STORAGE_KEYS, email, run } from './fixtures';

test.use({ staff: true, seededAlerts: [{ id: 'browser-gear', userEmail: email, runnerName: 'Browser Runner', milestoneRuns: 5, milestoneName: 'Five runs', reward: 'Club shirt', perks: '', shirtSize: 'M', date: '2026-11-11', time: '18:00', fulfilled: false }] });

async function openAdmin(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: run.title })).toBeVisible();
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
}

test('staff roster identifies loaded scope, resolves an email and exports profiles', async ({ page }) => {
  await openAdmin(page);
  await page.getByRole('button', { name: /Runners & Claims/ }).click();
  await expect(page.getByText(/Filters and role counts apply to these rows/)).toBeVisible();
  await page.getByLabel('Find runner by exact email').fill(email);
  await page.getByRole('button', { name: 'Find runner', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Loaded Browser Runner.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  const path = await (await download).path();
  expect(path).not.toBeNull();
  expect(await readFile(path!, 'utf8')).toContain(email);
});

test('staff gear handout moves a pending reward into fulfilled history', async ({ page }) => {
  await openAdmin(page);
  await page.getByRole('button', { name: /Milestones & Gear/ }).click();
  await expect(page.getByText('Pending Gear to Deliver Tonight (1)')).toBeVisible();
  await page.getByRole('button', { name: /Mark Handed Out/ }).click();
  await expect(page.getByText('Pending Gear to Deliver Tonight (0)')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Delivered', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]')[0].fulfilled, STORAGE_KEYS.MILESTONE_ALERTS)).toBe(true);
});
