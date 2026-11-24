import { addItems, crumb, expect, listRow, longPress, quickAdd, test } from './fixtures';

test.describe('Hvor er den?', () => {
  test('main flow: room → multi-line add → typo search → move → delete + undo → favorite', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page).toHaveTitle('Hvor er den?');

    await test.step('create a room from the home screen', async () => {
      await addItems(page, 'Tilføj rum', 'Kælder');
      await expect(listRow(page, 'Rum', /Kælder/)).toBeVisible();
      await expect(quickAdd(page, 'Tilføj rum')).toBeFocused();
    });

    await test.step('add several items at once with multiple lines', async () => {
      await listRow(page, 'Rum', /Kælder/).click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Kælder');
      await addItems(page, 'Tilføj ting i Kælder', 'Reol 1\nReol 2');
      await expect(listRow(page, 'Indhold i Kælder', /Reol 1/)).toBeVisible();
      await expect(listRow(page, 'Indhold i Kælder', /Reol 2/)).toBeVisible();

      await listRow(page, 'Indhold i Kælder', /Reol 2/).click();
      await addItems(
        page,
        'Tilføj ting i Reol 2',
        'Kasse 1\nSkruetrækker #værktøj\n\nSkruer 4x40 x200\nSpidstang #værktøj #tang',
      );
      const contents = page.getByRole('list', { name: 'Indhold i Reol 2' });
      await expect(contents.getByRole('link')).toHaveCount(4);
      const skruer = listRow(page, 'Indhold i Reol 2', /Skruer 4x40/);
      await expect(skruer).toContainText('200 stk.');
      await expect(listRow(page, 'Indhold i Reol 2', /Spidstang/)).toContainText('#værktøj #tang');
    });

    await test.step('search with a typo finds the item and shows its path', async () => {
      await crumb(page, 'Hjem').click();
      await page.getByRole('searchbox', { name: 'Søg i alle ting' }).fill('skrutrækker');
      const result = listRow(page, 'Søgeresultater', /Skruetrækker/);
      await expect(result).toBeVisible();
      await expect(result).toContainText('Kælder › Reol 2');
      await expect(result).toContainText('#værktøj');
    });

    await test.step('move an item (multi-select → Flyt → choose target)', async () => {
      await listRow(page, 'Søgeresultater', /Skruetrækker/).click();
      await crumb(page, 'Reol 2').click();
      await longPress(page, listRow(page, 'Indhold i Reol 2', /Skruetrækker/));
      await expect(page.getByText('1 valgt')).toBeVisible();
      await page.getByRole('button', { name: 'Flyt', exact: true }).click();

      await page.getByRole('button', { name: 'Fold ud: Kælder' }).click();
      await page.getByRole('button', { name: /^Reol 1/ }).click();
      await expect(page.getByText('Flyttede «Skruetrækker» til «Reol 1»')).toBeVisible();
      await expect(listRow(page, 'Indhold i Reol 2', /Skruetrækker/)).toHaveCount(0);

      await crumb(page, 'Kælder').click();
      await listRow(page, 'Indhold i Kælder', /Reol 1/).click();
      await expect(listRow(page, 'Indhold i Reol 1', /Skruetrækker/)).toBeVisible();
    });

    await test.step('delete with undo instead of a confirmation', async () => {
      await crumb(page, 'Kælder').click();
      await listRow(page, 'Indhold i Kælder', /Reol 2/).click();
      await longPress(page, listRow(page, 'Indhold i Reol 2', /Kasse 1/));
      await page.getByRole('button', { name: 'Slet', exact: true }).click();
      await expect(page.getByText('Slettede «Kasse 1»')).toBeVisible();
      await expect(listRow(page, 'Indhold i Reol 2', /Kasse 1/)).toHaveCount(0);

      await page.getByRole('button', { name: 'Fortryd' }).click();
      await expect(listRow(page, 'Indhold i Reol 2', /Kasse 1/)).toBeVisible();
    });

    await test.step('a favorite appears on the home screen', async () => {
      await listRow(page, 'Indhold i Reol 2', /Spidstang/).click();
      const star = page.getByRole('button', { name: 'Favorit' });
      await star.click();
      await expect(star).toHaveAttribute('aria-pressed', 'true');

      await crumb(page, 'Hjem').click();
      const favorite = listRow(page, 'Favoritter', /Spidstang/);
      await expect(favorite).toBeVisible();
      await expect(favorite).toContainText('Kælder › Reol 2');
    });

    await test.step('data survives a reload', async () => {
      await page.reload();
      await expect(listRow(page, 'Favoritter', /Spidstang/)).toBeVisible();
      await expect(listRow(page, 'Rum', /Kælder/)).toBeVisible();
    });
  });

  test('moving into itself or a descendant is not possible', async ({ page }) => {
    await page.goto('./');
    await addItems(page, 'Tilføj rum', 'Kælder\nLoft');
    await listRow(page, 'Rum', /Kælder/).click();
    await addItems(page, 'Tilføj ting i Kælder', 'Reol 1');

    await page.getByRole('button', { name: 'Flere handlinger' }).click();
    await page.getByRole('menuitem', { name: 'Flyt…' }).click();
    await page.getByRole('button', { name: 'Fold ud: Kælder' }).click();
    await expect(page.getByRole('button', { name: /^Kælder/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Reol 1/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Loft/ })).toBeEnabled();

    await page.getByRole('button', { name: /^Loft/ }).click();
    await expect(page.getByRole('navigation', { name: 'Placering' })).toContainText('Loft');
  });

  test('quick-add suggests the next free number and completes tags', async ({ page }) => {
    await page.goto('./');
    await addItems(page, 'Tilføj rum', 'Loft');
    await listRow(page, 'Rum', /Loft/).click();
    await addItems(page, 'Tilføj ting i Loft', 'Kasse 1\nKasse 2\nJulepynt #jul');

    const input = quickAdd(page, 'Tilføj ting i Loft');
    await input.fill('kasse');
    await page.getByRole('button', { name: 'Opret Kasse 3' }).click();
    await expect(listRow(page, 'Indhold i Loft', /Kasse 3/)).toBeVisible();
    await expect(input).toBeFocused();

    await input.fill('Lys #j');
    await page
      .getByRole('listbox', { name: 'Forslag til tags' })
      .getByRole('option', { name: '#jul' })
      .click();
    await expect(input).toHaveValue('Lys #jul ');
    await input.press('Enter');
    await expect(listRow(page, 'Indhold i Loft', /Lys/)).toContainText('#jul');
  });

  test('search inside a node is scoped, "Søg overalt" widens it, filters work without text', async ({
    page,
  }) => {
    await page.goto('./');
    await addItems(page, 'Tilføj rum', 'Kælder\nLoft');
    await listRow(page, 'Rum', /Loft/).click();
    await addItems(page, 'Tilføj ting i Loft', 'Lampe #el');
    await crumb(page, 'Hjem').click();
    await listRow(page, 'Rum', /Kælder/).click();
    await addItems(page, 'Tilføj ting i Kælder', 'Lommelygte #el\nSav');

    await page.getByRole('searchbox', { name: 'Søg i Kælder' }).fill('l');
    await expect(listRow(page, 'Søgeresultater', /Lommelygte/)).toBeVisible();
    await expect(listRow(page, 'Søgeresultater', /Lampe/)).toHaveCount(0);

    await page
      .getByRole('listbox', { name: 'Filtre' })
      .getByRole('option', { name: 'Søg overalt' })
      .click();
    await expect(listRow(page, 'Søgeresultater', /Lampe/)).toBeVisible();

    await page.getByRole('button', { name: 'Ryd søgning' }).click();
    await page
      .getByRole('listbox', { name: 'Filtre' })
      .getByRole('option', { name: '#el' })
      .click();
    await expect(page.getByRole('list', { name: 'Søgeresultater' }).getByRole('link')).toHaveCount(
      1,
    );
    await expect(listRow(page, 'Søgeresultater', /Lommelygte/)).toBeVisible();
  });

  test('photos are compressed, shown and can be deleted with undo', async ({ page }) => {
    await page.goto('./');
    await addItems(page, 'Tilføj rum', 'Kælder');
    await listRow(page, 'Rum', /Kælder/).click();
    await page
      .locator('app-photo-strip input[type=file]')
      .setInputFiles(['public/icons/icon-512x512.png', 'public/icons/maskable-512x512.png']);
    await expect(page.getByRole('button', { name: 'Vis billede 2 af 2' })).toBeVisible();

    await page.getByRole('button', { name: 'Vis billede 1 af 2' }).click();
    await expect(page.getByRole('img', { name: 'Billede 1 af 2' })).toBeVisible();
    await page.getByRole('button', { name: 'Slet billede' }).click();
    await expect(page.getByText('Billedet er slettet')).toBeVisible();
    await page.getByRole('button', { name: 'Fortryd' }).click();
    await page.getByRole('button', { name: 'Luk' }).click();
    await expect(page.getByRole('button', { name: 'Vis billede 2 af 2' })).toBeVisible();
  });

  test('"/" focuses the search field on desktop', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut is for desktop');
    await page.goto('./');
    await page.getByRole('heading', { name: 'Hvor er den?' }).click();
    await page.keyboard.press('/');
    await expect(page.getByRole('searchbox', { name: 'Søg i alle ting' })).toBeFocused();
  });
});
