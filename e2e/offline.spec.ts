import { addItems, crumb, expect, listRow, test, waitForOfflineReady } from './fixtures';

test('the app loads and works with the network turned off after the first visit', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await addItems(page, 'Tilføj rum', 'Kælder');
  // The row appears once the write is committed to IndexedDB.
  await expect(listRow(page, 'Rum', /Kælder/)).toBeVisible();
  await waitForOfflineReady(page);

  await context.setOffline(true);
  try {
    await test.step('reload offline', async () => {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Hvor er den?' })).toBeVisible();
      await expect(listRow(page, 'Rum', /Kælder/)).toBeVisible();
    });

    await test.step('a fresh tab loads offline too', async () => {
      const fresh = await context.newPage();
      await fresh.goto('./');
      await expect(fresh.getByRole('heading', { name: 'Hvor er den?' })).toBeVisible();
      await fresh.close();
    });

    await test.step('add, open and search while offline', async () => {
      await listRow(page, 'Rum', /Kælder/).click();
      await addItems(page, 'Tilføj ting i Kælder', 'Hammer #værktøj\nSøm x100');
      await expect(listRow(page, 'Indhold i Kælder', /Hammer/)).toBeVisible();

      await crumb(page, 'Hjem').click();
      await page.getByRole('searchbox', { name: 'Søg i alle ting' }).fill('hamer');
      await expect(listRow(page, 'Søgeresultater', /Hammer/)).toContainText('Kælder');
    });

    await test.step('settings open offline', async () => {
      await page.goto('./#/indstillinger');
      await expect(page.getByRole('heading', { name: 'Indstillinger' })).toBeVisible();
      await expect(page.getByText('3 ting og 0 billeder')).toBeVisible();
    });
  } finally {
    await context.setOffline(false);
  }
});
