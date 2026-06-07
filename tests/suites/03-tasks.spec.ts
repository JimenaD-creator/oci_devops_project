/** Suite 3 — Task lifecycle (runs before Suite 4 Developer) */
import { test, expect } from '@playwright/test';
import {
  DEVELOPER_ASSIGNEE,
  DEVELOPER_KANBAN_TASK,
  TAGS,
  TASK_STATUSES,
  TEST_TASKS,
  TIMEOUTS,
} from '../constants';
import { captureStableScreenshot, LoginPage, TasksPage } from '../pages';
import { saveKanbanTaskRef } from '../helpers/kanbanTaskStore';
import type { Task } from '../types';

const runId = Date.now();

function tasksForRun(): Task[] {
  return TEST_TASKS.map((task, index) => ({
    ...task,
    title: `${task.title} ${runId}-${index + 1}`,
  }));
}

test.describe.configure({ mode: 'serial' });

test.describe('Suite 3: Tasks', { tag: TAGS.tasks }, () => {
  test.afterEach(async ({ page }, testInfo) => {
    await captureStableScreenshot(page, testInfo, 'tasks.png');
  });

  test(
    'creates three tasks with full information @smoke',
    { tag: [TAGS.smoke, TAGS.tasks] },
    async ({ page }) => {
      await TasksPage.openAsManager(page);
      const tasksPage = new TasksPage(page);
      const login = new LoginPage(page);
      for (const task of tasksForRun()) {
        await tasksPage.createTask(task);
        await tasksPage.expectTaskVisible(task.title);
        await expect(login.taskRowByTitle.first()).toBeAttached();
        await tasksPage.editTaskTitle(task.title, `E2E Edited ${task.title}`);
      }
    },
  );

  test('creates task assigned to developer for Kanban', async ({ page }) => {
    await TasksPage.openAsManager(page);
    const tasksPage = new TasksPage(page);
    const created = await tasksPage.createTask(DEVELOPER_KANBAN_TASK, {
      assignee: DEVELOPER_ASSIGNEE,
      sprint: /Sprint 4/i,
    });
    saveKanbanTaskRef({ id: created.id, title: DEVELOPER_KANBAN_TASK.title });
    const taskRow = page
      .getByRole('row')
      .filter({ hasText: DEVELOPER_KANBAN_TASK.title })
      .filter({ hasText: 'Jimena' })
      .last();
    await expect(taskRow).toBeVisible();
    await tasksPage.expectTaskStatus(DEVELOPER_KANBAN_TASK.title, TASK_STATUSES.TODO.label);
  });

  test('manager filters completed tasks by Done status', async ({ page }) => {
    await TasksPage.openAsManager(page);
    const tasksPage = new TasksPage(page);
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toBeVisible();
    await tasksPage.filterByStatus(TASK_STATUSES.DONE.label);
    const filteredCount = await tasksPage.taskRows.count();
    test.skip(filteredCount === 0, 'No completed tasks in the current sprint');
    await tasksPage.expectAllVisibleRowsHaveStatus(TASK_STATUSES.DONE.label);
    await expect(
      tasksPage.taskRows.filter({
        has: page.getByText(TASK_STATUSES.TODO.label, { exact: true }),
      }),
    ).toHaveCount(0);
  });
});
