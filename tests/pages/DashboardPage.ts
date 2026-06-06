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
}
