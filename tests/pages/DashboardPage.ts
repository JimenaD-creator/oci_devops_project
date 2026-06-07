import { expect, type Locator, type Page } from '@playwright/test';
import { SELECTORS, TIMEOUTS, UI } from '../constants';

export class DashboardPage {
  readonly page: Page;
  readonly navDashboard: Locator;
  readonly navAiInsights: Locator;
  readonly navKpiAnalytics: Locator;
  readonly navSprints: Locator;
  readonly developerFilter: Locator;
  readonly goToTasksButton: Locator;

  /** Reuse manager storageState — skip login form. */
  static async open(page: Page): Promise<DashboardPage> {
    await page.goto('/');
    const dashboard = new DashboardPage(page);
    await dashboard.expectLoaded();
    return dashboard;
  }

  constructor(page: Page) {
    this.page = page;
    this.navDashboard = page.getByRole('button', { name: UI.dashboard, exact: true });
    this.navAiInsights = page.getByRole('button', { name: UI.aiInsights, exact: true });
    this.navKpiAnalytics = page.getByRole('button', { name: UI.kpiAnalytics, exact: true });
    this.navSprints = page.getByRole('button', { name: 'Sprints', exact: true });
    this.developerFilter = page.locator(SELECTORS.dashboard.developerFilter);
    this.goToTasksButton = page.locator(SELECTORS.dashboard.goToTasksButton);
  }

  async expectLoaded(): Promise<void> {
    await this.expectDashboardVisible();
    await expect(this.page.getByRole('heading', { name: 'Scorecards', exact: true })).toBeVisible({
      timeout: TIMEOUTS.settle,
    });
  }

  async openAiInsights(): Promise<void> {
    await this.navAiInsights.click();
  }

  async openKpiAnalytics(): Promise<void> {
    await this.navKpiAnalytics.click();
  }

  async openSprintsMenu(): Promise<void> {
    await this.navSprints.click();
  }

  async filterByDeveloper(index = 1): Promise<void> {
    if (await this.developerFilter.isVisible()) {
      await this.developerFilter.click();
      const options = this.page.getByRole('option');
      if ((await options.count()) > index) {
        await options.nth(index).click();
      }
    }
  }

  async expectDashboardVisible(): Promise<void> {
    await expect(this.navDashboard).toBeVisible({ timeout: TIMEOUTS.login });
  }

  async expectScorecardsAndAveragesVisible(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: 'Scorecards', exact: true })).toBeVisible();
    await expect(this.page.getByText('Tasks Completed').first()).toBeVisible();
    await expect(this.page.getByText('Total hours worked').first()).toBeVisible();
    await expect(this.page.getByText('Average tasks per developer').first()).toBeVisible();
    await expect(this.page.getByText('Average hours per developer').first()).toBeVisible();
    await expect(this.page.getByText('Completion Rate').first()).toBeVisible();
    await expect(this.page.getByRole('heading', { name: 'Project status', exact: true })).toBeVisible();
  }
}
