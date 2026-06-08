/** Suite 1 — Authentication */
import { test, expect } from '@playwright/test';
import { API_ENDPOINTS, LOGIN_TEST_CASES, ROUTES, TAGS, USERS } from '../constants';
import { captureAndAttachScreenshot, captureStableScreenshot } from '../helpers/screenshots';
import { DashboardPage, KpiAnalyticsPage, LoginPage } from '../pages';
import type { LoginTestCase, User } from '../types';

function asUser(loginCase: LoginTestCase): User {
  return {
    username: loginCase.user.identifier,
    password: loginCase.user.password,
    role: loginCase.shouldFail ? 'developer' : 'manager',
  };
}

test.describe('Suite 1: Authentication', { tag: TAGS.auth }, () => {
  test.beforeAll(() => {
    expect(ROUTES.login).toContain('163.192.142.68');
  });

  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).clearSession();
  });

  test.afterEach(async ({ page }, testInfo) => {
    await captureStableScreenshot(page, testInfo, 'auth.png');
  });

  test.afterAll(() => {
    expect(USERS.MANAGER.username.length).toBeGreaterThan(0);
  });

  for (const loginCase of LOGIN_TEST_CASES) {
    test(
      `login — ${loginCase.name}${loginCase.shouldFail ? ' shows error' : ' reaches dashboard'} @smoke`,
      { tag: [TAGS.smoke, TAGS.auth] },
      async ({ page, browserName }, testInfo) => {
        test.slow();
        test.skip(browserName === 'firefox', 'Auth smoke runs on Chromium only');

        const login = new LoginPage(page);
        const user = asUser(loginCase);

        if (loginCase.shouldFail) {
          await login.expectLoginFormVisible();
          await expect(page).toHaveScreenshot('login-form.png', {
            maxDiffPixelRatio: 0.08,
            animations: 'disabled',
          });
          await captureAndAttachScreenshot(page, testInfo, 'login-form-evidence.png');
          expect(page.url()).toBe(ROUTES.login);

          await test.step('Enter invalid credentials and submit', async () => {
            await login.typeCredentials(user);
            await Promise.all([
              page.waitForResponse(
                (response) =>
                  response.url().includes(API_ENDPOINTS.LOGIN) && response.status() === 401,
              ),
              login.submit(),
            ]);
          });

          await test.step('Invalid credentials error is shown', async () => {
            await expect(login.errorAlert).toBeVisible({ timeout: 15_000 });
            await login.expectInvalidCredentialsError();
            await captureAndAttachScreenshot(page, testInfo, 'invalid-login-error.png');
            await expect.soft(login.usernameField).toBeEditable();
            await expect.soft(login.signInButton).toBeEnabled();
            test.fail(false, 'Password policy UI is not exposed on the login form yet');
          });
          return;
        }

        const dashboard = new DashboardPage(page);
        const kpi = new KpiAnalyticsPage(page);

        await test.step('Enter valid manager credentials and submit', async () => {
          await login.expectLoginFormVisible();
          await login.typeCredentials(user);
          await Promise.all([
            page.waitForResponse(
              (response) => response.url().includes(API_ENDPOINTS.LOGIN) && response.ok(),
            ),
            login.submit(),
          ]);
        });

        await test.step('Manager dashboard loaded after login', async () => {
          await dashboard.expectDashboardVisible();
          await expect(page.getByRole('heading', { name: 'Scorecards', exact: true })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Project status', exact: true })).toBeVisible();
          await captureAndAttachScreenshot(page, testInfo, 'dashboard-after-login.png');
          await kpi.openFromDashboard(dashboard);
          await kpi.expectCompletionRateVisible();
          await expect(page.getByText('Productivity Score').first()).toBeVisible();
          await dashboard.navDashboard.click();
          await expect(page.getByRole('heading', { name: 'Scorecards', exact: true })).toBeVisible();
        });
      },
    );
  }
});
