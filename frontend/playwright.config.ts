import{ defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 1,
  // Two workers: the demo backend serves ML inference from one process;
  // more workers only contend on it and flake data-dependent assertions.
  workers: 2,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      // Exercise the demo-gated UI (quick logins, register link) the same way judges see it
      VITE_DEMO_MODE: '1',
    },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
