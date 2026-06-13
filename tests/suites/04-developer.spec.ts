/** Suite 4 — Developer */
import { test, expect } from '@playwright/test';
import { TAGS, UI } from '../constants';
import { installFreshDashboardBundleRoute } from '../helpers/freshDashboardBundle';
import { readKanbanTaskRef } from '../helpers/kanbanTaskStore';
import { captureAndAttachScreenshot, captureStableScreenshot, waitForPageSettled } from '../helpers/screenshots';
import { KanbanPage, MyTasksPage } from '../pages';

test.describe.configure({ mode: 'serial' });

test.describe('Suite 4: Developer', { tag: TAGS.developer }, () => {
  test.afterEach(async ({ page }, testInfo) => {
    await captureStableScreenshot(page, testInfo, 'developer.png');
  });

  test(
    'verifies assigned task metrics @smoke',
    { tag: [TAGS.smoke, TAGS.developer] },
    async ({ page }) => {
      const myTasks = await MyTasksPage.open(page);
      await myTasks.expectMetricsVisible();
      const assigned = await myTasks.readMetric(UI.tasksAssigned);
      expect(assigned).toBeGreaterThanOrEqual(0);
    },
  );

  test('shows table rows when tasks are assigned', async ({ page }) => {
    const myTasks = await MyTasksPage.open(page);
    const assigned = await myTasks.readMetric(UI.tasksAssigned);
    test.skip(assigned === 0, 'No tasks assigned in the current sprint');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('marks a task as completed in Kanban', async ({ page }, testInfo) => {
    const { id: taskId, title: taskTitle } = readKanbanTaskRef();
    const hoursWorked = '2';

    await test.step('Developer completes task in Kanban with hours worked', async () => {
      await MyTasksPage.open(page);
      await installFreshDashboardBundleRoute(page);
      const myTasks = new MyTasksPage(page);
      await myTasks.completeTaskInKanban(taskTitle, { taskId, hoursWorked });
      await captureAndAttachScreenshot(page, testInfo, 'kanban-task-in-done.png');
      await new KanbanPage(page).expectTaskInDoneColumn(taskTitle, taskId);
    });

    await test.step('My Tasks table shows Done status', async () => {
      const myTasks = new MyTasksPage(page);
      await myTasks.returnToMyTasks();
      await myTasks.expectTaskDoneInTable(taskTitle, { hoursWorked });
      await myTasks.scrollTaskRowIntoView(taskTitle, { hoursWorked });
      await waitForPageSettled(page);
      await captureAndAttachScreenshot(page, testInfo, 'my-tasks-status-done.png');
    });
  });

  test('opens My Performance', async ({ page }) => {
    const myTasks = await MyTasksPage.open(page);
    await myTasks.openMyPerformance();
  });
});
