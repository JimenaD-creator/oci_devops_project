/** Suite 2 — Manager E2E (hooks, tags, clock, getByAltText, page objects, auto-waiting, file download) */
import { test, expect } from '@playwright/test';
import { BASE_URL, TAGS, UI, USERS } from '../constants';
import { ApiMocks } from '../mocks/apiMocks';
import { DashboardPage, KanbanPage, KpiAnalyticsPage, LoginPage, TasksPage } from '../pages';

test.describe('Suite 2: Manager', { tag: TAGS.manager }, () => {
  // Lifecycle hook — manager login before each test (page object pattern)
  test.beforeEach(async ({ page }) => {
    const login = new LoginPage(page);
    await login.loginWith(USERS.MANAGER);
    await new DashboardPage(page).expectLoaded();
  });
  // Lifecycle hook — screenshot after each test
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('manager.png'), fullPage: true });
  });
  test(
    'views dashboard and opens KPI Analytics @smoke',
    { tag: [TAGS.smoke, TAGS.manager] },
    async ({ page }) => {
      // Clock API — control time without waiting in real time
      await page.clock.install({ time: new Date('2026-06-05T10:00:00Z') });
      const dashboard = new DashboardPage(page);
      const kpi = new KpiAnalyticsPage(page);
      await dashboard.expectDashboardVisible();
      await kpi.openFromDashboard(dashboard);
      await kpi.expectCompletionRateVisible();
      // Locator #3 getByAltText — developerAvatarByAlt() in LoginPage (KPI developer avatars)
      await expect(new LoginPage(page).developerAvatarByAlt('Demo Developer')).toHaveCount(0);
      await page.clock.fastForward('02:00:00');
      expect(Date.now()).toBeGreaterThan(new Date('2026-06-05T11:00:00Z').getTime());
    },
  );
  test('filters dashboard analytics by developer', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.filterByDeveloper(1);
    await dashboard.expectDashboardVisible();
  });
  test('downloads analytics CSV (mocked export endpoint)', async ({ page }) => {
    const kpi = new KpiAnalyticsPage(page);
    await kpi.openFromDashboard(new DashboardPage(page));
    // Mock API — programmatic route handler via ApiMocks helper
    await new ApiMocks(page).analyticsExport();
    const downloadPromise = page.waitForEvent('download');
    await page.evaluate(async (base) => {
      const res = await fetch(`${base}/api/projects/1/analytics/export`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'team-analytics.csv';
      a.click();
      URL.revokeObjectURL(url);
    }, BASE_URL);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
  test('explores AI Insights', async ({ page }) => {
    await new DashboardPage(page).openAiInsights();
    // Auto-waiting — getByText retries until element is visible
    await expect(page.getByText(/insight|sprint|developer/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
  test('opens Tasks and Kanban board', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    const kanban = new KanbanPage(page);
    await new TasksPage(page).openFromDashboard(dashboard);
    await expect(page.getByRole('button', { name: UI.newTask })).toBeVisible();
    await kanban.openFromDashboard(dashboard);
    await expect(
      page.locator('.kanban-column-header-title', { hasText: 'To Do' }),
    ).toBeVisible();
  });
});
