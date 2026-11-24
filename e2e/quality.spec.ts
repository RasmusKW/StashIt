import AxeBuilder from '@axe-core/playwright';
import { Page } from '@playwright/test';
import { addItems, crumb, expect, listRow, longPress, test, waitForOfflineReady } from './fixtures';

async function expectNoA11yViolations(page: Page, context: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations.map(
    (v) =>
      `${context}: [${v.impact}] ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
  expect(violations, 'accessibility violations').toEqual([]);
}

test.describe('quality', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`no accessibility violations (WCAG 2.1 AA) on the main screens – ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('./');
      await expectNoA11yViolations(page, 'empty home');

      await addItems(page, 'Tilføj rum', 'Kælder\nLoft');
      await listRow(page, 'Rum', /Kælder/).click();
      await addItems(page, 'Tilføj ting i Kælder', 'Reol 2 #træ\nSkruer x200 #jern');
      await page.getByRole('button', { name: 'Favorit' }).click();
      await expectNoA11yViolations(page, 'node view');

      await longPress(page, listRow(page, 'Indhold i Kælder', /Skruer/));
      await expectNoA11yViolations(page, 'selection mode');
      await page.getByRole('button', { name: 'Flyt', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Fold ud: Kælder' })).toBeVisible();
      await expectNoA11yViolations(page, 'move sheet');
      await page.keyboard.press('Escape');

      await crumb(page, 'Hjem').click();
      await page.getByRole('searchbox', { name: 'Søg i alle ting' }).fill('skru');
      await expect(listRow(page, 'Søgeresultater', /Skruer/)).toBeVisible();
      await expectNoA11yViolations(page, 'search results');

      await page.getByRole('button', { name: 'Ryd søgning' }).click();
      await expectNoA11yViolations(page, 'home with data');

      await page.getByRole('link', { name: 'Indstillinger og backup' }).click();
      await expect(page.getByRole('heading', { name: 'Indstillinger' })).toBeVisible();
      await expectNoA11yViolations(page, 'settings');
    });
  }

  test('the app is installable as a PWA', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'installability is checked via Chrome DevTools');
    await page.goto('./');
    await waitForOfflineReady(page);
    const cdp = await page.context().newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
    const manifest = await (await page.request.get('manifest.webmanifest')).json();
    expect(manifest.name).toBe('Hvor er den?');
    expect(manifest.display).toBe('standalone');
  });

  test('search stays fast with 5 000 nodes', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Hvor er den?' })).toBeVisible();
    // Seed 10 rooms × 49 boxes × 9 items straight into IndexedDB.
    await page.evaluate(async () => {
      const words = ['Skruer', 'Søm', 'Kabel', 'Lampe', 'Bog', 'Tøj', 'Værktøj', 'Legetøj', 'Pære'];
      const nodes: unknown[] = [];
      const base = { tags: [] as string[], favorite: false, createdAt: 1, updatedAt: 1 };
      for (let r = 0; r < 10; r++) {
        nodes.push({ ...base, id: `r${r}`, parentId: null, name: `Rum ${r}` });
        for (let b = 0; b < 49; b++) {
          nodes.push({ ...base, id: `r${r}b${b}`, parentId: `r${r}`, name: `Kasse ${b}` });
          for (let i = 0; i < 9; i++) {
            nodes.push({
              ...base,
              id: `r${r}b${b}i${i}`,
              parentId: `r${r}b${b}`,
              name: `${words[(r + b + i) % words.length]} ${r}-${b}-${i}`,
              tags: [words[i].toLowerCase()],
            });
          }
        }
      }
      nodes.push({ ...base, id: 'needle', parentId: 'r7b33', name: 'Skruetrækker' });
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('hvor-er-den');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('nodes', 'readwrite');
          const store = tx.objectStore('nodes');
          for (const node of nodes) store.put(node);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    await page.reload();
    await expect(listRow(page, 'Rum', /Rum 9/)).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Søg i alle ting' });
    const timeTo = async (text: string, row: RegExp) => {
      const start = Date.now();
      await search.fill(text);
      await expect(listRow(page, 'Søgeresultater', row).first()).toBeVisible();
      return Date.now() - start;
    };

    // The first search also builds the index for all 5 000 nodes.
    const first = await timeTo('skrutrækker', /Skruetrækker/);
    await expect(listRow(page, 'Søgeresultater', /Skruetrækker/)).toContainText('Rum 7 › Kasse 33');
    const second = await timeTo('lampe 3-1', /Lampe 3-1/);
    const third = await timeTo('rum 9 kasse 48 kabel', /Kabel 9-48/);
    console.log(`search latency incl. 100 ms debounce: ${first} / ${second} / ${third} ms`);
    expect(first).toBeLessThan(2000);
    expect(Math.max(second, third)).toBeLessThan(800);
  });
});
