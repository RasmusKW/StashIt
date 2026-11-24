import { Locator, Page, expect, test as base } from '@playwright/test';

/**
 * `test` that fails if the page logs any console error or throws (requirement: no console
 * errors).
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Long press: a real touch on touch devices (via CDP), a held mouse button otherwise. */
export async function longPress(page: Page, target: Locator): Promise<void> {
  // Center it: the fixed quick-add bar may cover elements at the bottom edge.
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  // Wait until the element stops moving (e.g. scroll restoration after a navigation).
  let box = await target.boundingBox();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const next = await target.boundingBox();
    if (box && next && next.x === box.x && next.y === box.y) break;
    box = next;
  }
  if (!box) throw new Error('Element not visible');
  const x = box.x + Math.min(60, box.width / 2);
  const y = box.y + box.height / 2;
  const hasTouch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (hasTouch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(800);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
  }
}

/** The quick-add field at the bottom of the current view. */
export function quickAdd(page: Page, name: string | RegExp): Locator {
  return page.getByRole('textbox', { name });
}

/** Types into quick-add and presses Enter. */
export async function addItems(page: Page, field: string | RegExp, text: string): Promise<void> {
  const input = quickAdd(page, field);
  await input.fill(text);
  await input.press('Enter');
  await expect(input).toHaveValue('');
}

/** A link in the breadcrumb ("Hjem › Kælder › Reol 2"). */
export function crumb(page: Page, name: string): Locator {
  return page
    .getByRole('navigation', { name: 'Placering' })
    .getByRole('link', { name, exact: true });
}

/** Rows inside the list with the given accessible name. */
export function listRow(page: Page, list: string, row: string | RegExp): Locator {
  return page.getByRole('list', { name: list }).getByRole('link', { name: row });
}

/** Waits until the service worker controls the page and has cached the app. */
export async function waitForOfflineReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // A reload makes the page controlled and lets the Angular SW initialize its cache.
  await page.reload();
  await page.waitForFunction(
    async () => {
      if (!navigator.serviceWorker.controller) return false;
      const names = await caches.keys();
      const name = names.find((n) => n.includes(':assets:app:cache'));
      if (!name) return false;
      const urls = (await (await caches.open(name)).keys()).map((r) => r.url);
      return (
        urls.some((u) => u.endsWith('/index.html')) && urls.some((u) => /\/main-.*\.js$/.test(u))
      );
    },
    null,
    { polling: 250, timeout: 30_000 },
  );
}
