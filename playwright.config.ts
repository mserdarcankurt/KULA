import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Multi-Environment Configuration
 */
const isCloud = process.env.KULA_ENV === 'cloud';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: isCloud ? 'https://gen-lang-client-0207804941.web.app' : 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'local',
      use: { 
        ...devices['Desktop Chrome'],
      },
      testMatch: /.*local.spec.ts/,
    },
    {
      name: 'mobile',
      use: { 
        ...devices['iPhone 13'],
      },
      testMatch: /.*local.spec.ts/,
    },
    {
      name: 'cloud',
      use: { 
        ...devices['Desktop Chrome'],
        navigationTimeout: 30000,
        actionTimeout: 15000,
      },
      testMatch: /.*cloud.spec.ts/,
    },
  ],

  // Run local dev server only for local tests
  webServer: !isCloud ? {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  } : undefined,
});
