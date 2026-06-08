import { expect, type Locator, type Page } from '@playwright/test';
import { SELECTORS, TASK_STATUSES, TIMEOUTS, UI } from '../constants';
import { KanbanPage } from './KanbanPage';

export class MyTasksPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly kanbanBoardButton: Locator;
  readonly myPerformanceButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: UI.myTasks });
    this.kanbanBoardButton = page.getByRole('button', { name: 'Kanban Board' });
    this.myPerformanceButton = page.getByRole('button', { name: UI.myPerformance });
  }

  static async open(page: Page): Promise<MyTasksPage> {
    await page.goto('/');
    const myTasks = new MyTasksPage(page);
    await myTasks.expectLoaded();
    return myTasks;
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
    await expect(this.page.getByText(UI.tasksAssigned, { exact: true })).toBeVisible();
    await expect(this.page.getByText(UI.tasksCompleted, { exact: true })).toBeVisible();
  }

  async openKanbanBoard(): Promise<void> {
    const board = this.page.locator(SELECTORS.kanban.board);
    if (!(await board.isVisible())) {
      await this.kanbanBoardButton.click();
    }
    await expect(board).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  async completeTaskInKanban(
    taskTitle: string,
    options?: { taskId?: number; hoursWorked?: string },
  ): Promise<void> {
    const hoursWorked = options?.hoursWorked ?? '2';
    const kanban = new KanbanPage(this.page);

    await this.page.evaluate(() => sessionStorage.removeItem('dashboardBundle:v1:1'));
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.expectLoaded();
    await this.openKanbanBoard();

    await kanban.moveTaskToDone(taskTitle, options?.taskId);

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: TIMEOUTS.dialog });
    await dialog.getByRole('spinbutton', { name: 'Hours worked' }).fill(hoursWorked);
    await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('/api/user-tasks') && r.request().method() === 'POST' && r.ok(),
      ),
      dialog.getByRole('button', { name: UI.markDone }).click(),
    ]);
    await dialog.waitFor({ state: 'hidden', timeout: TIMEOUTS.dialog });
    await kanban.expectTaskInDoneColumn(taskTitle, options?.taskId);
  }

  taskRow(title: string, hoursWorked?: string): Locator {
    let row = this.page.getByRole('row').filter({ hasText: title });
    if (hoursWorked) {
      row = row.filter({ hasText: `${hoursWorked}h` });
    }
    return row.first();
  }

  async expectTaskDoneInTable(taskTitle: string, options?: { hoursWorked?: string }): Promise<void> {
    const row = this.taskRow(taskTitle, options?.hoursWorked);
    await expect(row).toBeVisible({ timeout: TIMEOUTS.expect });
    await expect(row.getByText(TASK_STATUSES.DONE.label, { exact: true })).toBeVisible({
      timeout: TIMEOUTS.expect,
    });
  }

  async scrollTaskRowIntoView(taskTitle: string, options?: { hoursWorked?: string }): Promise<void> {
    const row = this.taskRow(taskTitle, options?.hoursWorked);
    await expect(row).toBeVisible({ timeout: TIMEOUTS.expect });
    await row.scrollIntoViewIfNeeded();
  }

  async returnToMyTasks(): Promise<void> {
    await this.page.getByRole('button', { name: UI.myTasks }).click();
    await this.expectLoaded();
    await this.page.evaluate(() => sessionStorage.removeItem('dashboardBundle:v1:1'));
    await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes('dashboard-bundle') && r.ok(),
        { timeout: TIMEOUTS.settle },
      ),
      this.page.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    await this.expectLoaded();
  }

  async openMyPerformance(): Promise<void> {
    await this.myPerformanceButton.click();
    await expect(this.page.getByRole('heading', { name: /Performance/i })).toBeVisible({
      timeout: TIMEOUTS.navigation,
    });
  }
}
