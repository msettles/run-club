import { test, expect } from './fixtures';
import type { SocialPostStatus } from '../../src/utils/socialPost';
const mapTile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ede9df"/><path d="M0 64H256M0 192H256M64 0V256M192 0V256" stroke="white" stroke-width="14"/><text x="75" y="55" font-size="13" fill="#555">Test Street</text></svg>';
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: mapTile }));
});
const accounts = { facebook: 'Test Facebook Page', instagram: '@testclub' };

test('social preview creates a JPEG and editable caption; publication is a separate explicit action', async ({ page }) => {
  let sends = 0;
  let published = false;
  await page.route('**/__test__/social', async (route) => {
    const body = route.request().postDataJSON();
    if (body.post) {
      sends++; published = true;
      expect(body.post.images).toHaveLength(2);
      expect(body.post.images.map((image: { routeId: string }) => image.routeId)).toEqual(['short-route', 'long-route']);
      for (const image of body.post.images) expect(image.image).toMatch(/^data:image\/jpeg;base64,/);
      expect(body.post.caption).toContain('Come join us!');
      expect(body.post.platforms).toEqual(['facebook', 'instagram']);
    }
    const data: SocialPostStatus = { accounts, results: published ? {
      facebook: { state: 'published', message: 'Published.', url: 'https://www.facebook.com/12_34' },
      instagram: { state: 'published', message: 'Published.' },
    } : {} };
    await route.fulfill({ json: data });
  });
  await page.goto('/tests/browser/fixtures/social.html');
  await page.getByRole('button', { name: 'Prepare social post' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Post run to social media' });
  await expect(dialog.getByRole('img')).toHaveCount(2);
  await expect(dialog.getByRole('img', { name: 'Route map 1: Patio Loop' })).toBeVisible();
  await expect(dialog.getByRole('img', { name: 'Route map 2: Downtown Run' })).toBeVisible();
  await expect(dialog.getByLabel('Post caption')).toHaveValue(/November 18, 2026.*\n/);
  await dialog.screenshot({ path: test.info().outputPath('social-preview.png') });
  await dialog.getByLabel('Post caption').fill('Come join us!');
  const publish = dialog.getByRole('button', { name: 'Publish to Facebook & Instagram', exact: true });
  await expect(publish).toBeEnabled(); expect(sends).toBe(0);
  await publish.click();
  await expect(dialog.getByRole('status').filter({ hasText: 'Published.' })).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: 'Publish to selected accounts' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Refresh status' }).click();
  expect(sends).toBe(1);
});

test('missing connection leaves run saved and does not allow publication', async ({ page }) => {
  await page.route('**/__test__/social', (route) => route.fulfill({ status: 503 }));
  await page.goto('/tests/browser/fixtures/social.html');
  await page.getByRole('button', { name: 'Prepare social post' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Post run to social media' });
  await expect(dialog.getByRole('alert')).toContainText('Your run is saved');
  await expect(dialog.getByRole('button', { name: 'Publish to selected accounts' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Prepare social post' })).toBeFocused();
});

test.describe('social post after run creation', () => {
  test.use({ staff: true });
  test('saves one run before opening the separate social preview', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create run', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Schedule a run', exact: true });
    await form.getByPlaceholder('e.g. Wednesday Turkey Warmup').fill('Social Preview Test Run');
    await form.getByPlaceholder('Announced at the run, e.g. TURKEY').fill('SOCIALTEST');
    await form.getByRole('checkbox', { name: /Prepare an Instagram/ }).check();
    await form.getByRole('button', { name: 'Publish Run', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Post run to social media', exact: true });
    await expect(preview).toBeVisible();
    await expect(form).toHaveCount(0);
    await expect(preview.getByLabel('Post caption')).toHaveValue(/Social Preview Test Run/);
    await expect(preview.getByRole('alert').filter({ hasText: 'Your run is saved' })).toBeVisible();
    await preview.getByRole('button', { name: 'Close social post preview' }).click();
    await expect(page.getByRole('heading', { name: 'Social Preview Test Run', exact: true })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Social Preview Test Run', exact: true })).toHaveCount(1);
  });
});

test('a map loading failure prevents publication instead of dropping route photos', async ({ page }) => {
  let sends = 0;
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.route('**/__test__/social', async (route) => {
    if (route.request().postDataJSON().post) sends++;
    await route.fulfill({ json: { accounts, results: {} } });
  });
  await page.goto('/tests/browser/fixtures/social.html');
  await page.getByRole('button', { name: 'Prepare social post' }).click();
  const preview = page.getByRole('dialog', { name: 'Post run to social media' });
  await expect(preview.getByRole('alert')).toContainText('Map tiles could not load');
  await expect(preview.getByRole('button', { name: 'Publish to Facebook & Instagram', exact: true })).toBeDisabled();
  expect(sends).toBe(0);
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: mapTile }));
  await preview.getByRole('button', { name: 'Retry route images' }).click();
  await expect(preview.getByRole('img')).toHaveCount(2);
  await expect(preview.getByRole('button', { name: 'Publish to Facebook & Instagram', exact: true })).toBeEnabled();
  expect(sends).toBe(0);
});
