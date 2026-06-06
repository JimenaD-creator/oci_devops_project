import { expect, type Locator, type Page } from '@playwright/test';
import { SELECTORS, TIMEOUTS, UI } from '../constants';

export class KpiAnalyticsPage {
  readonly page: Page;
  readonly productivityScore: Locator;
  readonly completionRate: Locator;

  constructor(page: Page) {
    this.page = page;
    this.productivityScore = page.locator(SELECTORS.dashboard.productivityScore);
    this.completionRate = page.locator(SELECTORS.dashboard.completionRate);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.productivityScore.first()).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  async expectCompletionRateVisible(): Promise<void> {
    await expect(this.completionRate.first()).toBeAttached();
  }

  async openFromDashboard(dashboard: { openKpiAnalytics: () => Promise<void> }): Promise<void> {
    await dashboard.openKpiAnalytics();
    await this.expectLoaded();
  }
}
