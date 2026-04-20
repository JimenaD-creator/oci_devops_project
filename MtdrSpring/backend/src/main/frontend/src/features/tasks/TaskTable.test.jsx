/**
 * Requirement 3: Completed tasks list — task name, developer, estimated hrs, actual hrs.
 * Component under test: TaskTable.jsx (not the full Tasks page).
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { renderWithTheme } from '../../test-utils';
import TaskTable from './TaskTable';

const completedRowItem = {
  id: 1,
  description: 'Tarea cerrada sprint 3',
  developer: 'Carlos Ruiz',
  done: true,
  assignedHours: 8,
  actualHours: 7,
  priority: 'MEDIUM',
};

// Snapshot of a completed row HTML with MUI class hashes normalized for stable comparison.
test('snapshot: completed row (normalized MUI dynamic class names)', () => {
  const { container } = render(<TaskTable items={[completedRowItem]} />);
  const html = container.innerHTML.replace(/css-[a-z0-9]+-/g, 'css-HASH-');
  expect(html).toMatchSnapshot();
});

// Asserts the row exposes title, developer chip, assigned hours (8h), and worked hours (7h).
test('completed row shows title, developer, and hours in the row', () => {
  renderWithTheme(<TaskTable items={[completedRowItem]} />);
  const row = screen.getByRole('row', { name: /Tarea cerrada sprint 3/i });
  expect(within(row).getByText('Carlos Ruiz')).toBeInTheDocument();
  expect(within(row).getByText('8h')).toBeInTheDocument();
  expect(within(row).getByText('7h')).toBeInTheDocument();
});

// Empty state: no rows and a clear “No tasks” message.
test('empty table shows the No tasks placeholder', () => {
  renderWithTheme(<TaskTable items={[]} />);
  expect(screen.getByText('No tasks')).toBeInTheDocument();
});
