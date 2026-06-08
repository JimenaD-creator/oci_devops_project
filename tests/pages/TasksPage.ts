import { expect, type Locator, type Page } from '@playwright/test';
import {
  DEFAULT_TASK_DATES,
  SELECTORS,
  TASK_CLASSIFICATIONS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TIMEOUTS,
  UI,
} from '../constants';
import type { Task } from '../types';
import { DashboardPage } from './DashboardPage';

export class TasksPage {
  readonly page: Page;
  readonly newTaskButton: Locator;
  readonly taskRows: Locator;
  readonly taskDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTaskButton = page.getByRole('button', { name: UI.newTask });
    this.taskRows = page.locator('table').getByRole('row').filter({ has: page.getByRole('cell') });
    this.taskDialog = page.locator(SELECTORS.tasks.taskDialog);
  }

  static async openAsManager(page: Page): Promise<TasksPage> {
    const dashboard = await DashboardPage.open(page);
    const tasks = new TasksPage(page);
    await tasks.openFromDashboard(dashboard);
    return tasks;
  }

  async openFromDashboard(dashboard: DashboardPage): Promise<void> {
    const tasksNav = this.page.getByRole('button', { name: 'Tasks', exact: true });
    if (!(await tasksNav.isVisible())) {
      await dashboard.openSprintsMenu();
      await expect(tasksNav).toBeVisible({ timeout: TIMEOUTS.navigation });
    }
    await tasksNav.click();
    await expect(this.newTaskButton).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  async createTask(
    task: Task,
    options?: { assignee?: string | RegExp; sprint?: string | RegExp },
  ): Promise<{ id: number; title: string }> {
    await this.newTaskButton.click();
    await this.taskDialog.waitFor({ state: 'visible', timeout: TIMEOUTS.dialog });

    const dialog = this.taskDialog;
    await dialog.getByRole('textbox', { name: /Task title/i }).fill(task.title);

    const description = dialog.getByRole('textbox', { name: /^Description/i });
    await description.click();
    await description.fill(task.description);
    await description.blur();

    const typeLabel =
      TASK_CLASSIFICATIONS[task.classification]?.label ?? TASK_CLASSIFICATIONS.FEATURE.label;
    const priorityLabel = TASK_PRIORITIES[task.priority]?.label ?? TASK_PRIORITIES.MEDIUM.label;
    await dialog.getByRole('button', { name: typeLabel }).first().click();
    await dialog.getByRole('button', { name: priorityLabel }).first().click();

    const sprintSelect = dialog.getByLabel(/Sprint/i);
    if (await sprintSelect.isVisible()) {
      await sprintSelect.click();
      await this.page.getByRole('option', { name: options?.sprint ?? /Sprint 4/i }).click();
    }

    const hoursField = dialog.getByLabel(/Assigned hours/i);
    if (await hoursField.isVisible()) {
      await hoursField.fill('1');
    }

    const developerSelect = dialog.getByLabel(/Developer/i);
    if (await developerSelect.isVisible()) {
      await developerSelect.click();
      if (options?.assignee) {
        await this.page.getByRole('option', { name: options.assignee }).click();
      } else {
        await this.page.getByRole('option').nth(1).click();
      }
    }

    await dialog.getByLabel(/Start date/i).fill(task.startDate ?? DEFAULT_TASK_DATES.startDate);
    await dialog.getByLabel(/Due date/i).fill(task.dueDate ?? DEFAULT_TASK_DATES.dueDate);

    const createButton = dialog.getByRole('button', { name: UI.createTask });
    await expect(createButton).toBeEnabled({ timeout: TIMEOUTS.dialog });
    const response = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/api/tasks') && r.request().method() === 'POST' && r.ok(),
      ),
      createButton.click(),
    ]).then(([res]) => res);

    const created = (await response.json()) as { id: number; title: string };
    await this.taskDialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialog });
    return created;
  }

  taskRow(title: string): Locator {
    return this.taskRows.filter({ hasText: title }).last();
  }

  async expectTaskVisible(title: string): Promise<void> {
    const row = this.taskRow(title);
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible({ timeout: TIMEOUTS.expect });
  }

  async expectTaskStatus(title: string, status: string): Promise<void> {
    const row = this.taskRow(title);
    await row.scrollIntoViewIfNeeded();
    await expect(row.getByText(status, { exact: true })).toBeVisible({ timeout: TIMEOUTS.expect });
  }

  async editTaskTitle(currentTitle: string, newTitle: string): Promise<void> {
    const row = this.taskRow(currentTitle);
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await this.taskDialog.waitFor({ state: 'visible', timeout: TIMEOUTS.dialog });
    await this.page.getByRole('button', { name: 'Edit' }).click();
    await this.page.getByLabel(/Task title/i).fill(newTitle);
    await Promise.all([
      this.page.waitForResponse(
        (r) => /\/api\/tasks\/\d+/.test(r.url()) && r.request().method() === 'PUT' && r.ok(),
      ),
      this.page.getByRole('button', { name: 'Save changes' }).click(),
    ]);
    await this.taskDialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialog });
    await this.expectTaskVisible(newTitle);
  }

  async filterByStatus(statusLabel: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Status', exact: true }).click();
    await this.page.getByRole('option', { name: statusLabel, exact: true }).click();
  }

  async expectAllVisibleRowsHaveStatus(status: string): Promise<void> {
    const count = await this.taskRows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(this.taskRows.nth(i).getByText(status, { exact: true })).toBeVisible();
    }
  }

  async deleteTask(title: string): Promise<void> {
    const row = this.taskRow(title);
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await this.taskDialog.waitFor({ state: 'visible', timeout: TIMEOUTS.dialog });

    this.page.once('dialog', (dialog) => dialog.accept());
    await Promise.all([
      this.page.waitForResponse(
        (r) => /\/api\/tasks\/\d+/.test(r.url()) && r.request().method() === 'DELETE' && r.ok(),
      ),
      this.taskDialog.getByRole('button', { name: 'Delete' }).click(),
    ]);
    await this.taskDialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialog });
  }

  async expectTaskNotVisible(title: string): Promise<void> {
    await expect(this.taskRows.filter({ hasText: title })).toHaveCount(0, {
      timeout: TIMEOUTS.expect,
    });
  }
}
