import { test, expect, STORAGE_KEYS } from './fixtures';

test.use({ staff: true });

// Synthetic tracks keep CI independent of the owner's ignored data/ directory.
const csv = 'Run name,Collection name,Date created,Loop,GPX path,Garmin Link,RunGo Link,Strava Link\nThe 123,The 123,10/11/21,loop,gpx_downloads/COURSE_63577683.gpx,https://connect.garmin.com/app/course/63577683,https://routes.rungoapp.com/route/example,https://www.strava.com/routes/123\nSample 3 Mile,Sample,11/3/21,,gpx_downloads/COURSE_456.gpx,https://connect.garmin.com/app/course/456,,https://www.strava.com/routes/456\n';
const csvFile = { name: 'routes.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) };
const xml = '<gpx><trk><name>Sample</name><trkseg><trkpt lat="38.6" lon="-121.7"><ele>10</ele></trkpt><trkpt lat="38.61" lon="-121.7"><ele>15</ele></trkpt><trkpt lat="38.61" lon="-121.69"><ele>15</ele></trkpt><trkpt lat="38.6" lon="-121.7"><ele>10</ele></trkpt></trkseg></trk></gpx>';
const gpx = ['COURSE_63577683.gpx', 'COURSE_456.gpx'].map((name) => ({ name, mimeType: 'application/gpx+xml', buffer: Buffer.from(xml) }));

test('imports CSV and GPX files, preserving metadata and skipping a repeat upload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Import routes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import routes' });
  const initialCount = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]').length, STORAGE_KEYS.ROUTES);
  await dialog.getByLabel('Route CSV', { exact: true }).setInputFiles(csvFile);
  await dialog.getByLabel('GPX files (select all)', { exact: true }).setInputFiles(gpx);
  await dialog.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(dialog.getByText('2 valid routes.', { exact: false })).toBeVisible();
  await dialog.getByRole('checkbox').uncheck();
  await dialog.getByRole('button', { name: 'Import routes to library', exact: true }).click();
  await expect(dialog.getByText('2 saved · 0 already imported')).toBeVisible();
  const imported = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]').filter((route: { id: string }) => route.id.startsWith('route-garmin-')), STORAGE_KEYS.ROUTES);
  expect(imported).toHaveLength(2);
  expect(imported.find((route: { id: string }) => route.id === 'route-garmin-63577683')).toMatchObject({ name: 'The 123', collectionName: 'The 123', isLoop: true, createdAt: '2021-10-11T00:00:00.000Z' });
  expect(imported.every((route: { points: unknown[]; externalLinks: { stravaUrl?: string } }) => route.points.length > 1 && route.externalLinks.stravaUrl)).toBe(true);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Import routes', exact: true }).click();
  await dialog.getByLabel('Route CSV', { exact: true }).setInputFiles(csvFile);
  await dialog.getByLabel('GPX files (select all)', { exact: true }).setInputFiles(gpx);
  await dialog.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(dialog.getByText('2 valid routes.', { exact: false })).toBeVisible();
  await dialog.getByRole('checkbox').uncheck();
  await dialog.getByRole('button', { name: 'Import routes to library', exact: true }).click();
  await expect(dialog.getByText('0 saved · 2 already imported')).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]').length, STORAGE_KEYS.ROUTES)).toBe(initialCount + 2);
});

test('blocks saving when GPX files are missing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Import routes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import routes' });
  const initialCount = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]').length, STORAGE_KEYS.ROUTES);
  await dialog.getByLabel('Route CSV', { exact: true }).setInputFiles(csvFile);
  await dialog.getByLabel('GPX files (select all)', { exact: true }).setInputFiles(gpx[0]);
  await dialog.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('select this GPX file');
  await expect(dialog.getByRole('button', { name: 'Import routes to library', exact: true })).toBeDisabled();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]').length, STORAGE_KEYS.ROUTES)).toBe(initialCount);
});

test('generates and saves directions through the route engine', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Routes', exact: true }).first().click();
  await page.getByRole('button', { name: 'Import routes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import routes' });
  await dialog.getByLabel('Route CSV', { exact: true }).setInputFiles({ name: 'routes.csv', mimeType: 'text/csv', buffer: Buffer.from('Run name,Collection name,Date created,Loop,GPX path,Garmin Link,RunGo Link,Strava Link\nThe 123,The 123,10/11/21,loop,gpx_downloads/COURSE_63577683.gpx,https://connect.garmin.com/app/course/63577683,,\n') });
  await dialog.getByLabel('GPX files (select all)', { exact: true }).setInputFiles(gpx[0]);
  await dialog.getByRole('button', { name: 'Preview import', exact: true }).click();
  await expect(dialog.getByText('1 valid routes.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Import routes to library', exact: true }).click();
  await expect(dialog.getByText('1 saved · 0 already imported')).toBeVisible();
  const generated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]').find((route: { id: string }) => route.id === 'route-garmin-63577683'), STORAGE_KEYS.ROUTES);
  expect(generated.directions.length).toBeGreaterThan(1);
  expect(generated.geoJson.features.length).toBeGreaterThan(0);
});
