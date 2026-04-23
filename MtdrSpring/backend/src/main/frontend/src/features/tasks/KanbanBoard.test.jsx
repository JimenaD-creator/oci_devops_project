/**
 * Requirement 4: Mark a task as completed (status → Done).
 * Component under test: KanbanBoard.jsx.
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

