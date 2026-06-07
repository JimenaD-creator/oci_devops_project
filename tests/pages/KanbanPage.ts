import { expect, type Locator, type Page } from '@playwright/test';
import { KANBAN_COLUMNS, SELECTORS, TASK_STATUSES, TIMEOUTS } from '../constants';
import type { KanbanColumn } from '../types';
import { DashboardPage } from './DashboardPage';

export class KanbanPage {
  readonly page: Page;
  readonly board: Locator;

  constructor(page: Page) {
    this.page = page;
    this.board = page.locator(SELECTORS.kanban.board);
  }

  async openFromDashboard(dashboard: DashboardPage): Promise<void> {
    const kanbanNav = this.page.getByRole('button', { name: 'Kanban board', exact: true });
    if (!(await kanbanNav.isVisible())) {
      await dashboard.openSprintsMenu();
      await expect(kanbanNav).toBeVisible({ timeout: TIMEOUTS.navigation });
    }
    await kanbanNav.click();
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.board).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  columnBodyFor(column: KanbanColumn): Locator {
    return this.page
      .locator('.kanban-column')
      .filter({
        has: this.page.locator(SELECTORS.kanban.columnHeader, { hasText: column }),
      })
      .locator(SELECTORS.kanban.columnBody);
  }

  taskCardByTitle(title: string): Locator {
    return this.board.locator(SELECTORS.kanban.taskCard).filter({ hasText: title });
  }

  taskCardById(taskId: number): Locator {
    return this.board.locator(SELECTORS.kanban.taskCard).filter({ hasText: `#${taskId}` });
  }

  async dragTaskToDone(title: string, taskId?: number): Promise<void> {
    const card = taskId != null ? this.taskCardById(taskId) : this.taskCardByTitle(title).first();
    await expect(card).toBeVisible({ timeout: TIMEOUTS.navigation });
    await card.locator('.kanban-task-status-pill').click();
    await this.page.getByRole('menuitem', { name: TASK_STATUSES.DONE.label, exact: true }).click();
  }

  async expectTaskInDoneColumn(title: string, taskId?: number): Promise<void> {
    const card =
      taskId != null
        ? this.page.locator(`${SELECTORS.kanban.columnDone} ${SELECTORS.kanban.taskCard}`).filter({
            hasText: `#${taskId}`,
          })
        : this.page.locator(`${SELECTORS.kanban.columnDone} ${SELECTORS.kanban.taskCard}`).filter({
            hasText: title,
          });
    await expect(card).toBeVisible({ timeout: TIMEOUTS.expect });
  }
}
