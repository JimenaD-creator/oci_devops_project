/**
 * Requirement 6: Team KPIs (e.g. completion) per sprint.
 * Component under test: KPIAnalytics.jsx (team KPI section; some charts stubbed in tests).
 */
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { setupFetchMock, jsonResponse, pathIncludes } from '../../mocks/mockFetch';
import { renderWithTheme } from '../../test-utils';
import { invalidateDashboardCache } from '../dashboard/dashboardSprintData';
import KPIAnalytics from './KPIAnalytics';

jest.mock('./KpiDonutChart', () => ({
  __esModule: true,
  default: function KpiDonutChartStub({ displayValue }) {
    return <span data-testid="donut-value">{displayValue}</span>;
  },
}));

jest.mock('./DeveloperWorkloadCharts', () => ({
  __esModule: true,
  default: () => <div data-testid="workload-charts-stub" />,
}));

afterEach(() => jest.restoreAllMocks());
beforeEach(() => {
  invalidateDashboardCache();
});

const sprint = {
  id: 3,
  assignedProject: { id: 1 },
  startDate: '2026-04-01T00:00:00.000Z',
  dueDate: '2026-04-30T23:59:59.999Z',
};

// With one DONE and one TODO task in the sprint, Completion Rate shows 50% on the stubbed donut.
test('Completion Rate reflects done vs total tasks for selected sprint', async () => {
  setupFetchMock([
    {
      test: (url, init) =>
        pathIncludes(url, '/api/sprints') && String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () => jsonResponse([sprint]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/tasks') && String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () =>
        jsonResponse([
          {
            id: 1,
            title: 'A',
            status: 'DONE',
            assignedHours: 4,
            dueDate: '2026-04-20T00:00:00.000Z',
            finishDate: '2026-04-19T00:00:00.000Z',
            assignedSprint: { id: 3 },
          },
          {
            id: 2,
            title: 'B',
            status: 'TODO',
            assignedHours: 2,
            dueDate: '2026-04-22T00:00:00.000Z',
            assignedSprint: { id: 3 },
          },
        ]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/user-tasks') &&
        String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () => jsonResponse([]),
    },
  ]);

  renderWithTheme(<KPIAnalytics projectId="1" />);

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

  const completionCard = screen.getByText('Completion Rate').closest('.MuiPaper-root');
  expect(within(completionCard).getByTestId('donut-value')).toHaveTextContent('50%');
});
