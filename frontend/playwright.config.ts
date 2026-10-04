import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const virtualenvPython = path.resolve(repositoryRoot, 'backend/.venv/bin/python');
const backendPython = existsSync(virtualenvPython) ? virtualenvPython : 'python';
// E2E_TARGET=prod serves the production build (`npm run build` first) with `vite preview`, as the
// Quality gate does; /api then goes through the preview proxy, like nginx in production. The
// default is the dev server.
const production = process.env.E2E_TARGET === 'prod';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  outputDir: '../output/playwright/test-results',
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: '../output/playwright/report', open: 'never' }]]
    : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // A 390 x 844 phone. The accessibility spec sets both widths itself, so it runs once, on
      // the desktop project.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
      testIgnore: ['accessibility.spec.ts'],
      // Two desktop-only journeys remain, for reasons unrelated to the cookie banner (the banner
      // already has its own phone coverage): the first clicks the desktop category chip row, the
      // second clicks the "Services" link in the desktop header nav, which a phone collapses into
      // the menu. Their phone equivalents are the explicit 320-430px tests in storefront.spec.ts.
      grepInvert: /catalog category query filters the product count|route navigation moves focus to the new page heading/,
    },
  ],
  webServer: [
    {
      command:
        `${backendPython} -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001`,
      cwd: repositoryRoot,
      url: 'http://127.0.0.1:8001/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        ...process.env,
        CORS_ORIGINS: 'http://127.0.0.1:4173',
        ORDERS_DATABASE_PATH: '/tmp/astar-customs-e2e-orders.db',
        REVIEWS_DATABASE_PATH: '/tmp/astar-customs-e2e-reviews.db',
        STRIPE_SECRET_KEY: '',
        STRIPE_WEBHOOK_SECRET: '',
        WEB3FORMS_ACCESS_KEY: '',
      },
    },
    {
      command: `npm run ${production ? 'preview' : 'dev'} -- --host 127.0.0.1 --port 4173 --strictPort`,
      cwd: path.resolve(repositoryRoot, 'frontend'),
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 30_000,
      env: production
        ? { ...process.env, API_PROXY_TARGET: 'http://127.0.0.1:8001' }
        : { ...process.env, VITE_API_BASE_URL: 'http://127.0.0.1:8001' },
    },
  ],
});
