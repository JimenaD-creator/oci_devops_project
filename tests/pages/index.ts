import { type Page, type TestInfo } from '@playwright/test';
import { TIMEOUTS } from '../constants';

export { LoginPage } from './LoginPage';
export { DashboardPage } from './DashboardPage';
export { KpiAnalyticsPage } from './KpiAnalyticsPage';
export { TasksPage } from './TasksPage';
export { KanbanPage } from './KanbanPage';
export { MyTasksPage } from './MyTasksPage';

/** Wait for async UI before screenshots and the final video frame. */
export async function waitForPageSettled(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page
    .locator('.login-loading-dots:visible')
    .waitFor({ state: 'hidden', timeout: TIMEOUTS.settle })
    .catch(() => {});
  await page.waitForTimeout(TIMEOUTS.visualHold);
}

export async function captureStableScreenshot(
  page: Page,
  testInfo: TestInfo,
  filename: string,
): Promise<void> {
  await waitForPageSettled(page);
  await page.screenshot({
    path: testInfo.outputPath(filename),
    fullPage: true,
    animations: 'disabled',
  });
}

export async function captureAndAttachScreenshot(
  page: Page,
  testInfo: TestInfo,
  filename: string,
): Promise<void> {
  await captureStableScreenshot(page, testInfo, filename);
  await testInfo.attach(filename, {
    path: testInfo.outputPath(filename),
    contentType: 'image/png',
  });
}
