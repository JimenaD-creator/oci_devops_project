/**
 * Requirement 7: Per-person KPIs (assigned, completed, hours) per sprint.
 * Component under test: DeveloperTable.jsx (not KPIAnalytics page shell).
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
    { name: 'Ana Ruiz', initials: 'AR', assigned: 3, completed: 2, hours: 18, workload: 100 },
    { name: 'Luis Pérez', initials: 'LP', assigned: 2, completed: 1, hours: 9, workload: 50 },
  ],
};

// Row for a developer shows assigned count, completed count, and total hours as text.
test('columns show per-person assigned, completed, and hours', () => {
  renderWithTheme(
    <DeveloperTable selectedSprints={[sprintSnapshot]} compareMode={false} suppressCardTitle />,
  );
  const anaRow = screen.getByText('Ana Ruiz').closest('tr');
  expect(anaRow).toBeTruthy();
  expect(within(anaRow).getByText('3')).toBeInTheDocument();
  expect(within(anaRow).getByText('2')).toBeInTheDocument();
  expect(within(anaRow).getByText('18h')).toBeInTheDocument();
});

// Two clicks on Total Hours toggle ascending/descending sort by visible row order.
test('clicking Total Hours sorts rows by hours asc then desc', async () => {
  const user = userEvent.setup();
  renderWithTheme(
    <DeveloperTable selectedSprints={[sprintSnapshot]} compareMode={false} suppressCardTitle />,
  );

  const hoursHeader = screen.getByText('Total Hours');
  await user.click(hoursHeader);

  const bodyRows = screen.getAllByRole('row').filter((r) => r.querySelector('.dev-name-text'));
  expect(within(bodyRows[0]).getByText('Luis Pérez')).toBeInTheDocument();

  await user.click(hoursHeader);
  const bodyRowsDesc = screen.getAllByRole('row').filter((r) => r.querySelector('.dev-name-text'));
  expect(within(bodyRowsDesc[0]).getByText('Ana Ruiz')).toBeInTheDocument();
});
