/** Suite 5 — API mocking within login flows (page.route, mock helpers, HAR replay) */
import { test, expect } from '@playwright/test';
import { TAGS, USERS } from '../constants';
import { captureStableScreenshot, DashboardPage, LoginPage } from '../pages';
import {
  mockAllForManager,
  mockLoginFailedFromHar,
  mockLoginUnauthorized,
  mockManagerSessionFromHar,
} from '../mocks/apiMocks';

test.describe('Suite 5: Mock API', { tag: TAGS.mock }, () => {
  test.afterEach(async ({ page }, testInfo) => {
    await captureStableScreenshot(page, testInfo, 'mock.png');
  });

  test('rejects invalid login via page.route @mock', async ({ page }) => {
    await new LoginPage(page).clearSession();
    let intercepted = false;
    // Mock API — inline page.route() intercepts POST /api/auth/login without hitting the real server
    await page.route('**/api/auth/login', async (route) => {
      intercepted = true;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials.' }),
      });
    });
    const login = new LoginPage(page);
    await login.goto();
    await login.login(USERS.MANAGER);
    await login.expectInvalidCredentialsError();
    expect(intercepted).toBe(true);
  });
  test('rejects invalid login via mock helper @mock', async ({ page }) => {
    await new LoginPage(page).clearSession();
    // Mock API — reusable handler from tests/mocks/apiMocks.ts
    await mockLoginUnauthorized(page);
    const login = new LoginPage(page);
    await login.loginWith(USERS.MANAGER);
    await login.expectInvalidCredentialsError();
  });
  test('logs in with programmatic mocks @mock', async ({ page }) => {
    await new LoginPage(page).clearSession();
    // Mock API — full manager session via page.route handlers (no real API)
    await mockAllForManager(page);
    const login = new LoginPage(page);
    await login.loginWith(USERS.MANAGER);
    await new DashboardPage(page).expectLoaded();
  });
  test('replays failed login from HAR @mock', async ({ page }) => {
    await new LoginPage(page).clearSession();
    // HAR mocking — replays auth-login-failed.har via routeFromHAR
    await mockLoginFailedFromHar(page);
    const login = new LoginPage(page);
    await login.loginWith(USERS.MANAGER);
    await login.expectInvalidCredentialsError();
  });
  test('logs in with full manager session from HAR @mock', async ({ page }) => {
    await new LoginPage(page).clearSession();
    // HAR mocking — replays manager-session.har (login + dashboard API chain)
    await mockManagerSessionFromHar(page);
    const login = new LoginPage(page);
    await login.loginWith(USERS.MANAGER);
    await new DashboardPage(page).expectLoaded();
  });
});
