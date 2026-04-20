/**
 * Requirements:
 *   3 — Completed task list: name, developer, estimated hrs, actual hrs.
 * Topics: Snapshots, React Testing Library, User Events, mock functions.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { renderWithTheme } from '../../test-utils';
import TaskTable from './TaskTable';

// Snapshot

test('SNAPSHOT: completed row renders consistently', () => {
  const { container } = render(
    <TaskTable
      items={[
        {
          id: 1,
          description: 'Tarea cerrada sprint 3',
          developer: 'Carlos Ruiz',
          done: true,
          assignedHours: 8,
          actualHours: 7,
          priority: 'MEDIUM',
        },
      ]}
    />,
  );
  // Normalize MUI dynamic CSS class hashes before snapshot comparison
  const html = container.innerHTML.replace(/css-[a-z0-9]+-/g, 'css-HASH-');
  expect(html).toMatchSnapshot();
});

// Requirement 3: completed row shows all required columns 

test('completed task row shows title, developer, estimated and actual hours', () => {
  renderWithTheme(
    <TaskTable
      items={[
        {
          id: 1,
          description: 'Tarea cerrada sprint 3',
          developer: 'Carlos Ruiz',
          done: true,
          assignedHours: 8,
          actualHours: 7,
          priority: 'MEDIUM',
        },
      ]}
    />,
  );
  
  const row = screen.getByRole('row', { name: /Tarea cerrada sprint 3/i });
  expect(within(row).getByText('Tarea cerrada sprint 3')).toBeInTheDocument();
  expect(within(row).getByText('Carlos Ruiz')).toBeInTheDocument();
  expect(within(row).getByText('8h')).toBeInTheDocument();
  expect(within(row).getByText('7h')).toBeInTheDocument();
});
test('empty table renders "No tasks" placeholder', () => {
  renderWithTheme(<TaskTable items={[]} />);
  expect(screen.getByText('No tasks')).toBeInTheDocument();
});
