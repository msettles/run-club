import { test, expect, run, route } from './fixtures';

for (const role of ['guest', 'member', 'organizer', 'admin'] as const) {
  test.describe(role, () => {
    test.use({ viewerRole: role });
    test(`${role}: runner actions stay separate from staff tools`, async ({ page }) => {
      await page.goto('/');
      const staff = role === 'organizer' || role === 'admin';
      const runnerActions = page.getByRole('group', { name: `Runner actions for ${run.title}`, exact: true });
      const tools = page.getByRole('group', { name: `Organizer tools for ${run.title}`, exact: true });
      await expect(runnerActions.getByRole('button', { name: 'Share Browser Test Run' })).toBeVisible();
      await expect(runnerActions.getByRole('button', { name: 'Check In', exact: true })).toBeVisible();
      await expect(runnerActions.getByRole('button', { name: 'RSVP', exact: true })).toHaveCount(role === 'guest' ? 0 : 1);
      await expect(runnerActions.getByRole('button', { name: /Check-ins|Edit|Instagram/ })).toHaveCount(0);
      await expect(tools).toHaveCount(staff ? 1 : 0);
      if (staff) {
        await expect(tools.getByRole('button', { name: `Check-ins for ${run.title}` })).toBeVisible();
        await expect(tools.getByRole('button', { name: `Edit ${run.title}` })).toBeVisible();
        await expect(tools.getByRole('button', { name: 'Create Instagram / Facebook post' })).toBeVisible();
        const runnerBox = await runnerActions.boundingBox();
        const staffBox = await tools.boundingBox();
        expect(staffBox!.y).toBeGreaterThanOrEqual(runnerBox!.y + runnerBox!.height);
        await tools.screenshot({ path: test.info().outputPath('organizer-actions.png') });
      } else {
        await expect(page.getByRole('button', { name: `Check-ins for ${run.title}` })).toHaveCount(0);
        await expect(page.getByRole('button', { name: `Edit ${run.title}` })).toHaveCount(0);
      }
      if (role !== 'guest') {
        await page.getByTitle('Runner Profile & Menu').click();
        const menuTools = page.getByRole('group', { name: 'Profile organizer tools', exact: true });
        await expect(menuTools).toHaveCount(staff ? 1 : 0);
        if (staff) {
          await expect(menuTools.getByRole('button', { name: 'Run Night / Table Mode' })).toBeVisible();
          await expect(menuTools.getByRole('button', { name: 'Admin Portal' })).toHaveCount(role === 'admin' ? 1 : 0);
        }
        await page.getByTitle('Runner Profile & Menu').click();
      }
      await page.getByRole('button', { name: 'Routes', exact: true }).click();
      const libraryTools = page.getByRole('group', { name: `Organizer tools for library route ${route.name}`, exact: true });
      await expect(libraryTools).toHaveCount(staff ? 1 : 0);
      if (staff) await expect(libraryTools.getByRole('button', { name: 'Edit route', exact: true })).toBeVisible();
      await page.getByRole('button', { name: route.name, exact: true }).click();
      const mapTools = page.getByRole('group', { name: `Organizer tools for route ${route.name}`, exact: true });
      await expect(mapTools).toHaveCount(staff ? 1 : 0);
      if (staff) await expect(mapTools.getByRole('button', { name: 'Edit Route', exact: true })).toBeVisible();
    });
  });
}
