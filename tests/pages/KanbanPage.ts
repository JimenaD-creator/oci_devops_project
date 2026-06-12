import { expect, type Locator, type Page } from '@playwright/test';
import { SELECTORS, TASK_STATUSES, TIMEOUTS } from '../constants';
import type { DashboardPage } from './DashboardPage';

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
    await expect(this.board).toBeVisible({ timeout: TIMEOUTS.navigation });
  }

  taskCard(title: string, taskId?: number): Locator {
    const cards = this.board.locator(SELECTORS.kanban.taskCard);
    if (taskId != null) {
      return cards.filter({ hasText: `#${taskId}` });
    }
    return cards.filter({ hasText: title }).first();
  }

  async moveTaskToDone(title: string, taskId?: number): Promise<void> {
    const card = this.taskCard(title, taskId);
    await expect(card).toBeVisible({ timeout: TIMEOUTS.navigation });
    await card.locator('.kanban-task-status-pill').click();
    await this.page.getByRole('menuitem', { name: TASK_STATUSES.DONE.label, exact: true }).click();
  }

  async expectTaskInDoneColumn(title: string, taskId?: number): Promise<void> {
    const doneCards = this.page.locator(`${SELECTORS.kanban.columnDone} ${SELECTORS.kanban.taskCard}`);
    const card = taskId != null ? doneCards.filter({ hasText: `#${taskId}` }) : doneCards.filter({ hasText: title });
    await expect(card).toBeVisible({ timeout: TIMEOUTS.expect });
  }
}
