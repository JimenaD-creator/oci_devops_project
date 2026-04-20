/**
 * Requirement 7: KPIs per PERSON — tasks assigned/completed and hours per developer.
 * Topics: User Event Testing Library, avoiding implementation details,
 *         React Testing Library.
 */
import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '../../test-utils';
import DeveloperTable from './DeveloperTable';

const sprintSnapshot = {
  id: 42,
  shortLabel: 'Sprint 42',
  dateRange: 'Apr 1 – Apr 30, 2026',
  developers: [
    { name: 'Ana Ruiz',  initials: 'AR', assigned: 3, completed: 2, hours: 18, workload: 100 },
    { name: 'Luis Pérez', initials: 'LP', assigned: 2, completed: 1, hours: 9,  workload: 50  },
  ],
};

test('sprint columns show per-person assigned tasks, completed tasks, and hours', () => {
  renderWithTheme(
    <DeveloperTable selectedSprints={[sprintSnapshot]} compareMode={false} suppressCardTitle />,
  );
  const anaRow = screen.getByText('Ana Ruiz').closest('tr');
  expect(anaRow).toBeTruthy();
  expect(within(anaRow).getByText('3')).toBeInTheDocument();
  expect(within(anaRow).getByText('2')).toBeInTheDocument();
  expect(within(anaRow).getByText('18h')).toBeInTheDocument();
});

test('SORT: clicking Total Hours sorts ascending then descending', async () => {
  const user = userEvent.setup();
  renderWithTheme(
    <DeveloperTable selectedSprints={[sprintSnapshot]} compareMode={false} suppressCardTitle />,
  );

  const hoursHeader = screen.getByText('Total Hours');
  await user.click(hoursHeader);

  // AVOIDING implementation details: we assert on visible row order, not state variables
  const bodyRows = screen
    .getAllByRole('row')
    .filter((r) => r.querySelector('.dev-name-text'));

  expect(within(bodyRows[0]).getByText('Luis Pérez')).toBeInTheDocument();

  await user.click(hoursHeader);
  const bodyRowsDesc = screen
    .getAllByRole('row')
    .filter((r) => r.querySelector('.dev-name-text'));
  expect(within(bodyRowsDesc[0]).getByText('Ana Ruiz')).toBeInTheDocument();
});