import { defineConfig, devices } from '@playwright/test';
import { AUTH_STORAGE } from './tests/constants';

const slowMo = Number(process.env.SLOW_MO ?? 0);
const viewport = { width: 1280, height: 720 };

export default defineConfig({
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: { animations: 'disabled' },
  },
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }],
  ],
  use: {
    baseURL: 'http://163.192.142.68',
    testIdAttribute: 'id',
    viewport,
    video: {
      mode: 'on',
      size: viewport,
      show: {
        actions: {
          duration: 500,
          position: 'top-right',
          fontSize: 14,
        },
      },
    },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'setup-manager',
      testDir: './tests/setup',
      testMatch: 'manager.auth.setup.ts',
    },
    {
      name: 'setup-developer',
      testDir: './tests/setup',
      testMatch: 'developer.auth.setup.ts',
    },
    {
      name: 'auth',
      testDir: './tests/suites',
      testMatch: '01-auth.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { slowMo },
      },
    },
    {
      name: 'mock-api',
      testDir: './tests/suites',
      testMatch: '05-mock-api.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { slowMo },
      },
    },
    {
      name: 'manager',
      testDir: './tests/suites',
      testMatch: ['02-manager.spec.ts', '03-tasks.spec.ts'],
      dependencies: ['setup-manager'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STORAGE.manager,
        launchOptions: { slowMo },
      },
    },
    {
      name: 'developer',
      testDir: './tests/suites',
      testMatch: '04-developer.spec.ts',
      dependencies: ['setup-developer', 'manager'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STORAGE.developer,
        launchOptions: { slowMo },
      },
    },
  ],
});
