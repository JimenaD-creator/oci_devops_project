/** Suite 2 — Manager */
import { test, expect } from '@playwright/test';
import { TAGS, TIMEOUTS, UI } from '../constants';
import { captureStableScreenshot } from '../helpers/screenshots';
import { DashboardPage, KanbanPage, KpiAnalyticsPage, LoginPage, TasksPage } from '../pages';

test.describe('Suite 2: Manager', { tag: TAGS.manager }, () => {
  test.afterEach(async ({ page }, testInfo) => {
    await captureStableScreenshot(page, testInfo, 'manager.png');
  });

  test(
    'views dashboard and opens KPI Analytics @smoke',
    { tag: [TAGS.smoke, TAGS.manager] },
    async ({ page }) => {
      await DashboardPage.open(page);
      await page.clock.install({ time: new Date('2026-06-05T10:00:00Z') });
      const dashboard = new DashboardPage(page);
      const kpi = new KpiAnalyticsPage(page);
      await dashboard.expectDashboardVisible();
      await kpi.openFromDashboard(dashboard);
      await kpi.expectCompletionRateVisible();
      await expect(new LoginPage(page).developerAvatar('Demo Developer')).toHaveCount(0);
      await page.clock.fastForward('02:00:00');
      expect(Date.now()).toBeGreaterThan(new Date('2026-06-05T11:00:00Z').getTime());
    },
  );
  test('filters dashboard analytics by developer', async ({ page }) => {
    await DashboardPage.open(page);
    const dashboard = new DashboardPage(page);
    await dashboard.filterByDeveloper(1);
    await dashboard.expectDashboardVisible();
  });
  test('views dashboard scorecards and completion metrics', async ({ page }) => {
    await DashboardPage.open(page);
    await new DashboardPage(page).expectScorecardsVisible();
  });
  test('explores AI Insights', async ({ page }) => {
    await DashboardPage.open(page);
    await new DashboardPage(page).openAiInsights();
    await expect(page.getByText(/insight|sprint|developer/i).first()).toBeVisible({
      timeout: TIMEOUTS.settle,
    });
  });
  test('opens Tasks and Kanban board', async ({ page }) => {
    await DashboardPage.open(page);
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
