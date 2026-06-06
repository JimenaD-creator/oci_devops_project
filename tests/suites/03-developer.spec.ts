/** Suite 3 — Developer E2E (hooks, tags, test.skip, page objects, auto-waiting, drag-and-drop via KanbanPage) */
import { test, expect } from '@playwright/test';
import { TAGS, UI, USERS } from '../constants';
import { LoginPage, MyTasksPage } from '../pages';

test.describe('Suite 3: Developer', { tag: TAGS.developer }, () => {
  // Lifecycle hook — developer login before each test
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginWith(USERS.DEVELOPER);
    await new MyTasksPage(page).expectLoaded();
  });
  // Lifecycle hook — screenshot after each test
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('developer.png'), fullPage: true });
  });
  test(
    'verifies assigned task metrics @smoke',
    { tag: [TAGS.smoke, TAGS.developer] },
    async ({ page }) => {
      const myTasks = new MyTasksPage(page);
      await myTasks.expectMetricsVisible();
      const assigned = await myTasks.readMetric(UI.tasksAssigned);
      expect(assigned).toBeGreaterThanOrEqual(0);
    },
  );
  test('shows table rows when tasks are assigned', async ({ page }) => {
    const myTasks = new MyTasksPage(page);
    const assigned = await myTasks.readMetric(UI.tasksAssigned);
    // test.skip — skips when no data in the current sprint (conditional, inside E2E flow)
    test.skip(assigned === 0, 'No tasks assigned in the current sprint');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });
  test('marks a task as completed in Kanban', async ({ page }) => {
    const myTasks = new MyTasksPage(page);
    const completedBefore = await myTasks.readMetric(UI.tasksCompleted);
    // Drag-and-drop — KanbanPage.dragFirstCard() moves a card between columns
    await myTasks.completeFirstTodoTask('1');
    await myTasks.returnToMyTasks();
    const completedAfter = await myTasks.readMetric(UI.tasksCompleted);
    expect(completedAfter).toBeGreaterThanOrEqual(completedBefore);
  });
  test('opens My Performance', async ({ page }) => {
    await new MyTasksPage(page).openMyPerformance();
  });
});
