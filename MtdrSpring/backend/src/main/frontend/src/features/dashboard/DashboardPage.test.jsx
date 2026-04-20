/**
 * Requirement 5: Dashboard shows required project/context when opened.
 * Component under test: DashboardPage.jsx (integration; heavy children stubbed).
 */
import React from 'react';
import { screen } from '@testing-library/react';
import { setupFetchMock, jsonResponse, pathIncludes } from '../../mocks/mockFetch';
import { renderWithTheme } from '../../test-utils';
import { invalidateDashboardCache } from './dashboardSprintData';
import DashboardPage from './DashboardPage';

jest.mock('./DashboardDeveloperCharts', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-charts-stub" />,
}));

jest.mock('./TaskStatusDistributionChart', () => ({
  __esModule: true,
  default: () => <div data-testid="task-status-stub" />,
}));

jest.mock('./DashboardTopMetrics', () => ({
  __esModule: true,
  default: ({ totalTasks, totalHours }) => (
    <div data-testid="top-metrics-stub">
      <span>Total tasks</span>
      <span>{totalTasks}</span>
      <span>Total hours worked</span>
      <span>{Number(totalHours).toFixed(1)}</span>
    </div>
  ),
}));

jest.mock('../kpis/DeveloperTable', () => ({
  __esModule: true,
  default: () => <div data-testid="developer-table-stub" />,
}));

jest.mock('./ScrollReveal', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
  DASHBOARD_SCROLL_VIEWPORT: {},
}));

jest.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => <div {...p}>{children}</div> },
  useInView: () => true,
}));

const sprintA = {
  id: 1,
  assignedProject: { id: 1, name: 'Proyecto Demo' },
  startDate: '2026-04-01T00:00:00.000Z',
  dueDate: '2026-04-30T23:59:59.999Z',
};

const tasksPayload = [
  {
    id: 11,
    title: 'T1',
    status: 'DONE',
    assignedHours: 10,
    dueDate: '2026-04-25T00:00:00.000Z',
    finishDate: '2026-04-24T00:00:00.000Z',
    assignedSprint: { id: 1 },
  },
  {
    id: 12,
    title: 'T2',
    status: 'IN_PROGRESS',
    assignedHours: 5,
    dueDate: '2026-04-26T00:00:00.000Z',
    assignedSprint: { id: 1 },
  },
];

const userTasksPayload = [
  { task: { id: 11 }, user: { id: 1, name: 'Ana' }, status: 'COMPLETED', workedHours: 10 },
  { task: { id: 12 }, user: { id: 2, name: 'Luis' }, status: 'TODO', workedHours: 5 },
];

afterEach(() => jest.restoreAllMocks());
beforeEach(() => {
  invalidateDashboardCache();
});

function setupMocks() {
  setupFetchMock([
    {
      test: (url) => {
        try {
          return new URL(url, 'http://localhost').pathname === '/api/projects/1';
        } catch {
          return false;
        }
      },
      handle: () => jsonResponse({ id: 1, name: 'Proyecto Demo' }),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/sprints') && String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () => jsonResponse([sprintA]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/tasks') && String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () => jsonResponse(tasksPayload),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/user-tasks') &&
        String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () => jsonResponse(userTasksPayload),
    },
  ]);
}

// After loading dashboard data, the heading includes the project name from the API.
test('displays project name from API', async () => {
  setupMocks();
  renderWithTheme(<DashboardPage projectId="1" />);

  expect(await screen.findByText(/Dashboard\s*[–-]\s*Proyecto Demo/i)).toBeInTheDocument();
});
