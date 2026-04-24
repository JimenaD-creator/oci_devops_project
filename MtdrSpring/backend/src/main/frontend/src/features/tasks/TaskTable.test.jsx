/**
 * Requirement 3: Completed tasks list — task name, developer, estimated hrs, actual hrs.
 */
import React from 'react';
import { screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import TaskTable from './TaskTable';

const completedRowItem = {
  id: 1,
  description: 'Closed task sprint 3',
  developer: 'Carlos Ruiz',
  done: true,
  assignedHours: 8,
  actualHours: 7,
  priority: 'MEDIUM',
};

// Asserts the row exposes title, developer chip, assigned hours (8h), and worked hours (7h).
test('completed row shows title, developer, estimated hours and real hours in the row', () => {
  renderWithTheme(<TaskTable items={[completedRowItem]} />);
  const row = screen.getByRole('row', { name: /Closed task sprint 3/i });
  expect(within(row).getByText('Carlos Ruiz')).toBeInTheDocument();
  expect(within(row).getByText('8h')).toBeInTheDocument();
  expect(within(row).getByText('7h')).toBeInTheDocument();
});
