/** Suite 1 — Authentication (hooks, locators, snapshots, tags, test.slow/skip/fail, parameterized, soft/negative assertions) */
import { test, expect } from '@playwright/test';
import { ROUTES, TAGS, USERS } from '../constants';
import { LoginPage } from '../pages';

test.describe('Suite 1: Authentication', { tag: TAGS.auth }, () => {
  // Lifecycle hook — runs once before the suite
  test.beforeAll(() => {
    expect(ROUTES.login).toContain('163.192.142.68');
  });
  // Lifecycle hook — runs before each test
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).clearSession();
  });
  // Lifecycle hook — screenshot after each test (see also screenshot: 'on' in playwright.config.ts)
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('auth.png'), fullPage: true });
  });
  // Lifecycle hook — runs once after the suite
  test.afterAll(() => {
    expect(USERS.MANAGER.username.length).toBeGreaterThan(0);
  });
  // Tags (@smoke, @auth) — filter with: npx playwright test --grep @smoke
  test(
    'invalid login then valid login @smoke',
    { tag: [TAGS.smoke, TAGS.auth] },
    async ({ page, browserName }) => {
      // test.slow — triples the test timeout for this flow
      test.slow();
      // test.skip — skips when condition is true (non-Chromium browsers)
      test.skip(browserName === 'firefox', 'Auth smoke runs on Chromium only');
      const login = new LoginPage(page);
      // Page object + 7 locator strategies (getByRole, getByTestId, getByText, getByLabel, getByPlaceholder on login)
      await login.expectLoginLocatorsVisible();
      // Visual snapshot — compared against tests/suites/01-auth.spec.ts-snapshots/
      await expect(page).toHaveScreenshot('login-form.png', { maxDiffPixelRatio: 0.08 });
      // Negative assertion (non-retrying) — plain expect, not await expect()
      expect(page.url()).toBe(ROUTES.login);
      // Parameterized test data — loop over credential cases inside the E2E flow
      const loginCases = [
        { user: USERS.INVALID_USER, shouldFail: true },
        { user: USERS.MANAGER, shouldFail: false },
      ];
      for (const loginCase of loginCases) {
        if (loginCase.shouldFail) {
          await login.login(loginCase.user);
          await login.expectInvalidCredentialsError();
          // Soft assertions — continue on failure and report all at the end
          await expect.soft(login.usernameField).toBeEditable();
          await expect.soft(login.signInButton).toBeEnabled();
          // test.fail — marks expected failure when condition is true (false = test continues normally)
          test.fail(false, 'Password policy UI is not exposed on the login form yet');
        } else {
          await login.usernameField.fill(loginCase.user.username);
          await login.passwordField.fill(loginCase.user.password);
          await login.signInButton.click();
          // Auto-waiting assertion — Playwright retries until visible or timeout
          await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible({
            timeout: 45_000,
          });
        }
      }
    },
  );
});
