import { expect, type Locator, type Page } from '@playwright/test';
import { SELECTORS, TASK_STATUSES, TIMEOUTS, UI } from '../constants';
import { KanbanPage } from './KanbanPage';

const BUNDLE_CACHE_PREFIX = 'dashboardBundle:v1:';

export class MyTasksPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tasksAssigned: Locator;
  readonly tasksCompleted: Locator;
  readonly kanbanBoardButton: Locator;
  readonly myPerformanceButton: Locator;

  /** Reuse developer storageState — skip login form. */
  static async open(page: Page): Promise<MyTasksPage> {
    await page.goto('/');
    const myTasks = new MyTasksPage(page);
    await myTasks.expectLoaded();
    return myTasks;
  }

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: UI.myTasks });
    this.tasksAssigned = page.getByText(UI.tasksAssigned, { exact: true });
    this.tasksCompleted = page.getByText(UI.tasksCompleted, { exact: true });
    this.kanbanBoardButton = page.getByRole('button', { name: 'Kanban Board' });
    this.myPerformanceButton = page.getByRole('button', { name: UI.myPerformance });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: TIMEOUTS.login });
  }

  async readMetric(label: string): Promise<number> {
    const card = this.page
      .getByText(label, { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"MuiPaper-root")]');
    const text = await card.textContent();
    return Number(text?.match(/(\d+)/)?.[1] ?? 0);
  }

  async expectMetricsVisible(): Promise<void> {
    await expect(this.tasksAssigned).toBeVisible();
    await expect(this.tasksCompleted).toBeVisible();
  }

  async openKanbanBoard(): Promise<void> {
    const board = this.page.locator(SELECTORS.kanban.board);
    if (!(await board.isVisible())) {
      await this.kanbanBoardButton.click();
    }
    await expect(board).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  async submitHoursWorked(hoursWorked: string): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.dialog });
    await dialog.getByRole('spinbutton', { name: 'Hours worked' }).fill(hoursWorked);
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes('/api/user-tasks') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      this.page
        .waitForResponse(
          (response) =>
            /\/api\/tasks\/\d+/.test(response.url()) &&
            response.request().method() === 'PUT' &&
            response.ok(),
        )
        .catch(() => {}),
      dialog.getByRole('button', { name: UI.markDone }).click(),
    ]);
    await dialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialog });
  }

  async completeTaskInKanban(
    taskTitle: string,
    options?: { taskId?: number; hoursWorked?: string },
  ): Promise<void> {
    const taskId = options?.taskId;
    const hoursWorked = options?.hoursWorked ?? '2';
    const kanban = new KanbanPage(this.page);

    await this.clearBundleCache();
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
    await this.openKanbanBoard();
    const card =
      taskId != null ? kanban.taskCardById(taskId) : kanban.taskCardByTitle(taskTitle).first();
    await expect(card).toBeVisible({ timeout: TIMEOUTS.navigation });

    await kanban.dragTaskToDone(taskTitle, taskId);
    await this.submitHoursWorked(hoursWorked);
    await kanban.expectTaskInDoneColumn(taskTitle, taskId);
  }

  async expectTaskStatusInTable(
    taskTitle: string,
    status: string,
    options?: { hoursWorked?: string },
  ): Promise<void> {
    let row = this.page.getByRole('row').filter({ hasText: taskTitle });
    if (options?.hoursWorked) {
      row = row.filter({ hasText: `${options.hoursWorked}h` });
    }
    const target = row.first();
    await expect(target).toBeVisible({ timeout: TIMEOUTS.expect });
    await expect(target.getByText(status, { exact: true })).toBeVisible({ timeout: TIMEOUTS.expect });
  }

  async expectTaskDoneInTable(taskTitle: string, options?: { hoursWorked?: string }): Promise<void> {
    await this.expectTaskStatusInTable(taskTitle, TASK_STATUSES.DONE.label, options);
  }

  taskRowInTable(taskTitle: string, options?: { hoursWorked?: string }): Locator {
    let row = this.page.getByRole('row').filter({ hasText: taskTitle });
    if (options?.hoursWorked) {
      row = row.filter({ hasText: `${options.hoursWorked}h` });
    }
    return row.first();
  }

  async scrollTaskRowIntoView(taskTitle: string, options?: { hoursWorked?: string }): Promise<void> {
    const row = this.taskRowInTable(taskTitle, options);
    await expect(row).toBeVisible({ timeout: TIMEOUTS.expect });
    await row.scrollIntoViewIfNeeded();
  }

  async openMyPerformance(): Promise<void> {
    await this.myPerformanceButton.click();
    await expect(this.page.getByRole('heading', { name: /Performance/i })).toBeVisible({
      timeout: TIMEOUTS.navigation,
    });
  }

  /** Kanban keeps My Tasks mounted with stale bundle — clear cache and reload the table. */
  async returnToMyTasks(): Promise<void> {
    await this.page.getByRole('button', { name: UI.myTasks }).click();
    await this.expectLoaded();
    await this.clearBundleCache();
    await Promise.all([
      this.page.waitForResponse(
        (response) => response.url().includes('dashboard-bundle') && response.ok(),
        { timeout: TIMEOUTS.settle },
      ),
      this.page.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    await this.expectLoaded();
  }

  private async clearBundleCache(projectId = 1): Promise<void> {
    await this.page.evaluate(
      ([prefix, pid]) => {
        sessionStorage.removeItem(`${prefix}${pid}`);
      },
      [BUNDLE_CACHE_PREFIX, String(projectId)] as const,
    );
  }
}
