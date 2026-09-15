import { defineConfig, devices } from '@playwright/test';

const PORT = 3999;
const BASE_URL = `http://127.0.0.1:${PORT}`;
/* Event-driven waits everywhere; this ceiling only bounds a genuinely stuck
   step and can be raised on slow machines. */
const WAIT_CEILING_MS = Number(process.env['E2E_WAIT_CEILING_MS'] ?? '10000');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: process.env['CI'] === undefined ? undefined : 4,
  retries: 0,
  reporter: process.env['CI'] === undefined ? 'list' : 'github',
  timeout: WAIT_CEILING_MS * 3,
  expect: { timeout: WAIT_CEILING_MS },
  use: {
    baseURL: BASE_URL,
    actionTimeout: WAIT_CEILING_MS,
    navigationTimeout: WAIT_CEILING_MS,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'bun run src/dev-web.ts',
    url: `${BASE_URL}/api/auth/config`,
    reuseExistingServer: false,
    env: { PORT: String(PORT), DATABASE_PATH: ':memory:', BASE_URL, DEV_LOGIN_USER_ID: '1' },
  },
});
