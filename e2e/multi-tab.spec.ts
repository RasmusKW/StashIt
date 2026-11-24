import { addItems, expect, listRow, test } from './fixtures';

test('changes in one tab show up in another open tab', async ({ page, context }) => {
  await page.goto('./');
  await addItems(page, 'Tilføj rum', 'Kælder');
  await expect(listRow(page, 'Rum', /Kælder/)).toBeVisible();

  const other = await context.newPage();
  await other.goto('./');
  await expect(listRow(other, 'Rum', /Kælder/)).toBeVisible();

  await addItems(page, 'Tilføj rum', 'Loft');
  await expect(listRow(other, 'Rum', /Loft/)).toBeVisible();

  await other.getByRole('searchbox', { name: 'Søg i alle ting' }).fill('loft');
  await expect(listRow(other, 'Søgeresultater', /Loft/)).toBeVisible();
  await other.close();
});
