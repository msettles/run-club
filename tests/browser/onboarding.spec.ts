import { test, expect, STORAGE_KEYS } from './fixtures';
const fixture = '/tests/browser/fixtures/onboarding.html';
async function openProfile(page: import('@playwright/test').Page) {
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Set up profile' }).click();
  return page.getByRole('dialog', { name: 'Runner profile' });
}
async function enterName(dialog: import('@playwright/test').Locator) {
  await dialog.getByLabel('First Name *', { exact: true }).fill('New');
  await dialog.getByLabel('Last Name *', { exact: true }).fill('Runner');
}

test('profile requires names before submitting', async ({ page }) => {
  let requests = 0;
  await page.route('**/__test__/registration', async (route) => { requests++; await route.fulfill({ status: 200 }); });
  const dialog = await openProfile(page);
  await dialog.getByRole('button', { name: /Complete Profile/ }).click();
  expect(requests).toBe(0);
  await expect(dialog).toBeVisible();
  await enterName(dialog);
  await dialog.getByRole('button', { name: /Complete Profile/ }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved: New Runner');
  await expect(dialog).toHaveCount(0);
});

test('failed save preserves profile fields and can be retried without duplicate profiles', async ({ page }) => {
  let requests = 0;
  await page.route('**/__test__/registration', (route) => route.fulfill({ status: ++requests === 1 ? 503 : 200 }));
  const dialog = await openProfile(page);
  await enterName(dialog);
  await dialog.getByRole('button', { name: /Complete Profile/ }).click();
  await expect(dialog.getByText('Profile could not be saved. Please retry.')).toBeVisible();
  await expect(dialog.getByLabel('First Name *', { exact: true })).toHaveValue('New');
  await dialog.getByRole('button', { name: /Complete Profile/ }).click();
  await expect(page.getByRole('status')).toHaveText('Profile saved: New Runner');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), STORAGE_KEYS.USERS);
  expect(saved.filter((user: { email: string }) => user.email === 'new-runner@example.test')).toHaveLength(1);
  expect(requests).toBe(2);
});

test('pending profile save disables submission until it completes', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  await page.route('**/__test__/registration', async (route) => { requests++; await gate; await route.fulfill({ status: 200 }); });
  const dialog = await openProfile(page);
  await enterName(dialog);
  await dialog.getByRole('button', { name: /Complete Profile/ }).click();
  await expect(dialog.getByRole('button', { name: /Saving Profile/ })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  release();
  await expect(page.getByRole('status')).toHaveText('Profile saved: New Runner');
  expect(requests).toBe(1);
});

test('unavailable window exposes recovery and Escape leaves the app usable', async ({ page }) => {
  await page.goto(fixture);
  const opener = page.getByRole('button', { name: 'Open unavailable window' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Unable to open this window' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Reload app' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.getByRole('button', { name: 'Set up profile' }).click();
  await expect(page.getByRole('dialog', { name: 'Runner profile' })).toBeVisible();
});
