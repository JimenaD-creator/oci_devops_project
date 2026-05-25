/**
 * Requirement 4: Mark a task as completed (status → Done).
 * Component under test: KanbanBoard.jsx.
 */
import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import KanbanBoard, { canDropTaskInColumn, COLUMN_STATUS_MAP } from './KanbanBoard';

function makeItem(overrides = {}) {
  return {
    id: 1,
    description: 'Default Task',
    rawStatus: 'TODO',
    developer: 'Alice',
    actualHours: 2,
    ...overrides,
  };
}

// Opens status menu on a card, chooses Done, then expects onStatusChange(id, 'DONE').
test('changing status to Done calls onStatusChange with DONE', async () => {
  const user = userEvent.setup();
  const onStatusChange = vi.fn();

  renderWithTheme(
    <KanbanBoard
      items={[makeItem({ id: 42, description: 'Create Mock-Up UI', rawStatus: 'IN_PROGRESS' })]}
      onStatusChange={onStatusChange}
    />,
  );

  const card = screen.getByText('Create Mock-Up UI').closest('.kanban-task-card');
  await user.click(within(card).getByTitle('Click to change status'));
  await user.click(screen.getByRole('menuitem', { name: 'Done' }));

  expect(onStatusChange).toHaveBeenCalledWith(42, 'DONE');
});

test('manager mode only offers Done in the status menu', async () => {
  const user = userEvent.setup();
  const onStatusChange = vi.fn();

  renderWithTheme(
    <KanbanBoard
      items={[makeItem({ id: 7, description: 'API wiring', rawStatus: 'IN_REVIEW' })]}
      onStatusChange={onStatusChange}
      statusMenuMode="doneOnly"
    />,
  );

  const card = screen.getByText('API wiring').closest('.kanban-task-card');
  await user.click(within(card).getByTitle('Mark as done'));

  expect(screen.getByRole('menuitem', { name: 'Done' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'In Progress' })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Delete task' })).not.toBeInTheDocument();
});

test('manager mode does not open status menu when task is already Done', async () => {
  const user = userEvent.setup();

  renderWithTheme(
    <KanbanBoard
      items={[makeItem({ id: 8, description: 'Shipped', rawStatus: 'DONE', done: true })]}
      statusMenuMode="doneOnly"
    />,
  );

  const card = screen.getByText('Shipped').closest('.kanban-task-card');
  const pill = within(card).getByTitle('Completed');
  expect(pill.textContent).not.toContain('▾');
  await user.click(pill);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('canDropTaskInColumn respects manager done-only mode', () => {
  expect(canDropTaskInColumn('done', 'IN_PROGRESS', 'doneOnly')).toBe(true);
  expect(canDropTaskInColumn('todo', 'IN_PROGRESS', 'doneOnly')).toBe(false);
  expect(canDropTaskInColumn('done', 'DONE', 'doneOnly')).toBe(false);
});

test('canDropTaskInColumn allows any column in full mode', () => {
  expect(canDropTaskInColumn('review', 'TODO', 'full')).toBe(true);
  expect(canDropTaskInColumn('todo', 'TODO', 'full')).toBe(false);
});

test('COLUMN_STATUS_MAP maps columns to API statuses', () => {
  expect(COLUMN_STATUS_MAP.inProgress).toBe('IN_PROGRESS');
  expect(COLUMN_STATUS_MAP.done).toBe('DONE');
});
