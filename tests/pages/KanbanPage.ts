import { expect, type Locator, type Page } from '@playwright/test';
import { KANBAN_COLUMNS, SELECTORS, TIMEOUTS } from '../constants';
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

  columnBody(columnClass: string): Locator {
    return this.page.locator(columnClass).locator(SELECTORS.kanban.columnBody);
  }

  firstCardInColumn(columnClass: string): Locator {
    return this.page.locator(`${columnClass} ${SELECTORS.kanban.taskCard}`).first();
  }

  async dragFirstCard(fromColumnClass: string, toColumn: KanbanColumn): Promise<void> {
    const card = this.firstCardInColumn(fromColumnClass);
    const target = this.page
      .locator('.kanban-column')
      .filter({
        has: this.page.locator(SELECTORS.kanban.columnHeader, { hasText: toColumn }),
      })
      .locator(SELECTORS.kanban.columnBody);
    await card.dragTo(target);
  }

  async moveTodoToDone(): Promise<void> {
    if (await this.firstCardInColumn(SELECTORS.kanban.columnTodo).count()) {
      await this.dragFirstCard(SELECTORS.kanban.columnTodo, KANBAN_COLUMNS.DONE);
    }
  }

  async moveInProgressToInReview(): Promise<void> {
    if (await this.firstCardInColumn(SELECTORS.kanban.columnInProgress).count()) {
      await this.dragFirstCard(SELECTORS.kanban.columnInProgress, KANBAN_COLUMNS.IN_REVIEW);
    }
  }

  async moveInReviewToInProgress(): Promise<void> {
    if (await this.firstCardInColumn(SELECTORS.kanban.columnInReview).count()) {
      await this.dragFirstCard(SELECTORS.kanban.columnInReview, KANBAN_COLUMNS.IN_PROGRESS);
    }
  }
}
