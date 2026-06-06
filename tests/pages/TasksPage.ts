import { expect, type Locator, type Page } from '@playwright/test';
import {
  DEFAULT_TASK_DATES,
  SELECTORS,
  TASK_CLASSIFICATIONS,
  TASK_PRIORITIES,
  TIMEOUTS,
  UI,
} from '../constants';
import type { Task } from '../types';
import { DashboardPage } from './DashboardPage';

export class TasksPage {
  readonly page: Page;
  readonly newTaskButton: Locator;
  readonly tasksTable: Locator;
  readonly taskRows: Locator;
  readonly taskDialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newTaskButton = page.getByRole('button', { name: UI.newTask });
    this.tasksTable = page.locator('table');
    this.taskRows = this.tasksTable.getByRole('row').filter({ has: page.getByRole('cell') });
    this.taskDialog = page.locator(SELECTORS.tasks.taskDialog);
  }

  async openFromDashboard(dashboard: DashboardPage): Promise<void> {
    const tasksNav = this.page.getByRole('button', { name: 'Tasks', exact: true });
    if (!(await tasksNav.isVisible())) {
      await dashboard.openSprintsMenu();
      await expect(tasksNav).toBeVisible({ timeout: TIMEOUTS.navigation });
    }
    await tasksNav.click();
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.newTaskButton).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  async openNewTaskDialog(): Promise<void> {
    await this.newTaskButton.click();
    await this.taskDialog.waitFor({ state: 'visible', timeout: TIMEOUTS.dialog });
  }

  async fillNewTaskForm(task: Task): Promise<void> {
    const dialog = this.taskDialog;
    await dialog.getByRole('textbox', { name: /Task title/i }).fill(task.title);
    await dialog.getByRole('textbox', { name: 'Description' }).fill(task.description);

    const typeLabel =
      TASK_CLASSIFICATIONS[task.classification]?.label ?? TASK_CLASSIFICATIONS.FEATURE.label;
    const priorityLabel = TASK_PRIORITIES[task.priority]?.label ?? TASK_PRIORITIES.MEDIUM.label;

    await dialog.getByRole('button', { name: typeLabel }).first().click();
    await dialog.getByRole('button', { name: priorityLabel }).first().click();

    const developerSelect = dialog.getByLabel(/Developer/i);
    if (await developerSelect.isVisible()) {
      await developerSelect.click();
      await this.page.getByRole('option').nth(1).click();
    }

    const startDate = task.startDate ?? DEFAULT_TASK_DATES.startDate;
    const dueDate = task.dueDate ?? DEFAULT_TASK_DATES.dueDate;
    await dialog.getByLabel(/Start date/i).fill(startDate);
    await dialog.getByLabel(/Due date/i).fill(dueDate);
  }

  async submitNewTask(): Promise<void> {
    await this.page.getByRole('button', { name: UI.createTask }).click();
    await this.taskDialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialog });
  }

  async createTask(task: Task): Promise<void> {
    await this.openNewTaskDialog();
    await this.fillNewTaskForm(task);
    await this.submitNewTask();
  }

  async expectTaskVisible(title: string): Promise<void> {
    await expect(this.page.getByRole('row', { name: new RegExp(title) })).toBeVisible({
      timeout: TIMEOUTS.expect,
    });
  }

  async editTaskTitleAtRow(rowIndex: number, newTitle: string): Promise<void> {
    const row = this.taskRows.nth(rowIndex);
    await expect(row).toBeVisible({ timeout: TIMEOUTS.navigation });
    await row.click();
    await this.taskDialog.waitFor({ state: 'visible' });

    await this.page.getByRole('button', { name: 'Edit' }).click();
    await this.page.getByLabel(/Task title/i).fill(newTitle);
    await this.page.getByRole('button', { name: 'Save changes' }).click();
    await this.taskDialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialog });
  }
}
