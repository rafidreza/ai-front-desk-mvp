import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3102);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          API_BASE_URL: process.env.API_BASE_URL ?? 'http://127.0.0.1:4999',
          INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN ?? 'dev-internal-api-token-only-for-local-work',
          INTERNAL_CONSOLE_SESSION_SECRET:
            process.env.INTERNAL_CONSOLE_SESSION_SECRET ?? 'dev-internal-console-session-secret-only-for-smoke-tests',
          CLIENT_SESSION_SECRET: process.env.CLIENT_SESSION_SECRET ?? 'dev-client-session-secret-only-for-smoke-tests',
          CLIENT_AUTH_CODE_SECRET: process.env.CLIENT_AUTH_CODE_SECRET ?? 'dev-client-auth-code-secret-only-for-smoke-tests',
          WEB_APP_URL: baseURL,
        },
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
