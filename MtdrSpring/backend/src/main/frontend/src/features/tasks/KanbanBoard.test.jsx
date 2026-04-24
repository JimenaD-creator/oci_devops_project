/**
 * Requirement 4: Mark a task as completed (status → Done).
 */
import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import KanbanBoard from './KanbanBoard';

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

// Tasks appear in the column for their `rawStatus`; column badges show per-column counts; rerender updates counts.
test('columns, placement by status, and per-column counts', () => {
  const { rerender } = renderWithTheme(
    <KanbanBoard
      items={[
        makeItem({ id: 1, description: 'Todo Task', rawStatus: 'TODO' }),
        makeItem({ id: 2, description: 'Progress Task', rawStatus: 'IN_PROGRESS' }),
        makeItem({ id: 3, description: 'Done Task', rawStatus: 'DONE' }),
      ]}
    />,
  );

  for (const name of ['To Do', 'In Progress', 'In Review', 'Done']) {
    expect(screen.getByText(name)).toBeInTheDocument();
  }

  const todoCol = screen.getByText('To Do').closest('.kanban-column');
  const progressCol = screen.getByText('In Progress').closest('.kanban-column');
  const doneCol = screen.getByText('Done').closest('.kanban-column');

  expect(within(todoCol).getByText('Todo Task')).toBeInTheDocument();
  expect(within(progressCol).getByText('Progress Task')).toBeInTheDocument();
  expect(within(doneCol).getByText('Done Task')).toBeInTheDocument();

  expect(within(todoCol).getByText('1')).toBeInTheDocument();

  rerender(
    <KanbanBoard
      items={[
        makeItem({ id: 1, rawStatus: 'TODO' }),
        makeItem({ id: 2, rawStatus: 'TODO', description: 'Task 2' }),
      ]}
    />,
  );
  const todoAfter = screen.getByText('To Do').closest('.kanban-column');
  expect(within(todoAfter).getByText('2')).toBeInTheDocument();
});
