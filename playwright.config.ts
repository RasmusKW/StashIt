import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against a production build served from a sub folder
 * (`/hvor-er-den/`), which also verifies that the configurable base-href works
 * and that the service worker can take the app offline.
 *
 * Build first: `npm run build:e2e` (done automatically by `npm run e2e`).
 */
const PORT = 4300;
const BASE_PATH = '/hvor-er-den/';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'off',
    locale: 'da-DK',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node scripts/serve.mjs --dir dist/e2e/browser --base ${BASE_PATH} --port ${PORT}`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env['CI'],
    stdout: 'ignore',
  },
});
