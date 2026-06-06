import { expect, type Locator, type Page } from '@playwright/test';
import { KANBAN_COLUMNS, SELECTORS, TIMEOUTS, UI } from '../constants';
import { KanbanPage } from './KanbanPage';

export class MyTasksPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly tasksAssigned: Locator;
  readonly tasksCompleted: Locator;
  readonly kanbanBoardButton: Locator;
  readonly myPerformanceButton: Locator;

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
    await this.kanbanBoardButton.click();
    await expect(this.page.locator(SELECTORS.kanban.board)).toBeVisible({
      timeout: TIMEOUTS.navigation,
    });
  }

  async completeFirstTodoTask(hoursWorked = '1'): Promise<void> {
    await this.openKanbanBoard();

    const todoCard = this.page
      .locator(`${SELECTORS.kanban.columnTodo} ${SELECTORS.kanban.taskCard}`)
      .first();
    if ((await todoCard.count()) === 0) return;

    const kanbanPage = new KanbanPage(this.page);
    await kanbanPage.dragFirstCard(SELECTORS.kanban.columnTodo, KANBAN_COLUMNS.DONE);

    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible().catch(() => false)) {
      await this.page.locator(SELECTORS.developer.hoursWorkedInput).fill(hoursWorked);
      await this.page.getByRole('button', { name: 'Mark done' }).click();
    }
  }

  async openMyPerformance(): Promise<void> {
    await this.myPerformanceButton.click();
    await expect(this.page.getByRole('heading', { name: /Performance/i })).toBeVisible({
      timeout: TIMEOUTS.navigation,
    });
  }

  async returnToMyTasks(): Promise<void> {
    await this.page.getByRole('button', { name: UI.myTasks }).click();
    await this.expectLoaded();
  }
}
