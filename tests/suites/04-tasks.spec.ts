/** Suite 4 — Task lifecycle E2E (hooks, tags, getByTitle locator, visual snapshot, page objects) */
import { test, expect } from '@playwright/test';
import { TAGS, TEST_TASKS, USERS } from '../constants';
import type { Task } from '../types';
import { DashboardPage, KanbanPage, LoginPage, TasksPage } from '../pages';

const runId = Date.now();

function tasksForRun(): Task[] {
  return TEST_TASKS.map((task, index) => ({
    ...task,
    title: `${task.title} ${runId}-${index + 1}`,
  }));
}

test.describe('Suite 4: Tasks', { tag: TAGS.tasks }, () => {
  // Lifecycle hook — manager login and navigate to Tasks before each test
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginWith(USERS.MANAGER);
    await new DashboardPage(page).expectLoaded();
    await new TasksPage(page).openFromDashboard(new DashboardPage(page));
  });
  // Lifecycle hook — screenshot after each test
  test.afterEach(async ({ page }, testInfo) => {
    await page.screenshot({ path: testInfo.outputPath('tasks.png'), fullPage: true });
  });
  test(
    'creates three tasks with full information @smoke',
    { tag: [TAGS.smoke, TAGS.tasks] },
    async ({ page }) => {
      const tasksPage = new TasksPage(page);
      const login = new LoginPage(page);
      // Parameterized data — TEST_TASKS from constants/types, unique titles per run
      for (const task of tasksForRun()) {
        await tasksPage.createTask(task);
        await tasksPage.expectTaskVisible(task.title);
        // Locator #7 getByTitle — taskRowByTitle in LoginPage (task table row tooltip)
        await expect(login.taskRowByTitle.first()).toBeAttached();
      }
    },
  );
  test('edits the title of three existing tasks', async ({ page }) => {
    const tasksPage = new TasksPage(page);
    const total = await tasksPage.taskRows.count();
    // test.skip — skips when the sprint task table is empty
    test.skip(total === 0, 'No tasks in the table');
    const limit = Math.min(3, total);
    for (let i = 0; i < limit; i++) {
      const newTitle = `E2E Edited ${runId}-${i}`;
      await tasksPage.editTaskTitleAtRow(i, newTitle);
      await tasksPage.expectTaskVisible(newTitle);
    }
  });
  test('changes Kanban ticket status: Done, In Review, In Progress', async ({ page }) => {
    const kanban = new KanbanPage(page);
    await kanban.openFromDashboard(new DashboardPage(page));
    // Drag-and-drop — move cards across Kanban columns
    await kanban.moveTodoToDone();
    await kanban.moveInProgressToInReview();
    await kanban.moveInReviewToInProgress();
    await kanban.expectLoaded();
    // Visual snapshot — captured at end of Kanban status-change flow
    await expect(page).toHaveScreenshot('kanban-board.png', { maxDiffPixelRatio: 0.1 });
  });
});
