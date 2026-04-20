/**
 * Requirement 4: Mark a task as completed (Kanban status change).
 * Topics: React Testing Library,
 *         User Events
 */
import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '../../test-utils';
import KanbanBoard from './KanbanBoard';

// Helper: build a kanban item 
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

// Requirement 4: status → DONE 

test('changing status to Done calls onStatusChange with DONE', async () => {
  const user = userEvent.setup();
  const onStatusChange = jest.fn();

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

// Columns render correctly

test('board renders four columns: To Do, In Progress, In Review, Done', () => {
  renderWithTheme(<KanbanBoard items={[]} />);
  expect(screen.getByText('To Do')).toBeInTheDocument();
  expect(screen.getByText('In Progress')).toBeInTheDocument();
  expect(screen.getByText('In Review')).toBeInTheDocument();
  expect(screen.getByText('Done')).toBeInTheDocument();
});

test('task is placed in the correct column based on rawStatus', () => {
  renderWithTheme(
    <KanbanBoard
      items={[
        makeItem({ id: 1, description: 'Todo Task',     rawStatus: 'TODO' }),
        makeItem({ id: 2, description: 'Progress Task', rawStatus: 'IN_PROGRESS' }),
        makeItem({ id: 3, description: 'Done Task',     rawStatus: 'DONE' }),
      ]}
    />,
  );
  const todoCol     = document.querySelector('.kanban-col-todo');
  const progressCol = document.querySelector('.kanban-col-progress');
  const doneCol     = document.querySelector('.kanban-col-done');

  expect(todoCol.textContent).toContain('Todo Task');
  expect(progressCol.textContent).toContain('Progress Task');
  expect(doneCol.textContent).toContain('Done Task');
});

test('column count badge updates when tasks are provided', () => {
  const { rerender } = renderWithTheme(
    <KanbanBoard items={[makeItem({ id: 1, rawStatus: 'TODO' })]} />,
  );
  let todoHeader = document.querySelector('.kanban-col-todo .kanban-column-count');
  expect(todoHeader.textContent).toBe('1');

  rerender(
    <KanbanBoard
      items={[
        makeItem({ id: 1, rawStatus: 'TODO' }),
        makeItem({ id: 2, rawStatus: 'TODO', description: 'Task 2' }),
      ]}
    />,
  );
  todoHeader = document.querySelector('.kanban-col-todo .kanban-column-count');
  expect(todoHeader.textContent).toBe('2');
});