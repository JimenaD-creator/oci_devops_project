/**
 * Requirement 5 — project name in the dashboard title (from API).
 * Requirement 6 — completed-task header pills when two sprints are selected (hours: `DashboardTopMetrics.test.jsx`; mocked below).
 */
import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import { invalidateDashboardCache, fetchDashboardSprints } from './dashboardSprintData';
import { fetchProjectById } from './projectApi';
import DashboardPage from './DashboardPage';

vi.mock('./projectApi', () => ({
  fetchProjectById: vi.fn(),
}));

vi.mock('./dashboardSprintData', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchDashboardSprints: vi.fn(),
  };
});

vi.mock('./DashboardDeveloperCharts', () => ({
  __esModule: true,
  default: () => <div data-testid="dev-charts-stub" />,
}));

vi.mock('./TaskStatusDistributionChart', () => ({
  __esModule: true,
  default: () => <div data-testid="task-status-stub" />,
}));

vi.mock('./DashboardTopMetrics', () => ({
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

vi.mock('../kpis/DeveloperTable', () => ({
  __esModule: true,
  default: () => <div data-testid="developer-table-stub" />,
}));

vi.mock('./ScrollReveal', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
  DASHBOARD_SCROLL_VIEWPORT: {},
}));

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => <div {...p}>{children}</div> },
  useInView: () => true,
}));

afterEach(() => {
  vi.restoreAllMocks();
});
beforeEach(() => {
  invalidateDashboardCache();
});

describe('project name in dashboard header', () => {
  test('heading includes the project name from fetchProjectById', async () => {
    fetchProjectById.mockResolvedValue({ id: 1, name: 'Proyecto Demo' });
    fetchDashboardSprints.mockResolvedValue([]);
    renderWithTheme(<DashboardPage projectId="1" />);

    expect(await screen.findByText(/Dashboard\s*[–-]\s*Proyecto Demo/i)).toBeInTheDocument();
  });
});

describe('header completed-task pills', () => {
  describe('compare mode (two sprints selected)', () => {
    test('renders two chips with test id dashboard-header-tasks-completed', async () => {
      const user = userEvent.setup();
      fetchProjectById.mockResolvedValue({ id: 1, name: 'Proyecto Demo' });
      fetchDashboardSprints.mockResolvedValue([
        {
          id: 1,
          name: 'Sprint A',
          shortLabel: 'S0',
          accentColor: '#1565C0',
          startDate: '2026-04-01T00:00:00.000Z',
          dueDate: '2026-04-14T23:59:59.999Z',
          totalCompleted: 13,
          totalTasks: 18,
          totalHours: 40,
          taskStatusDistribution: [
            { key: 'TODO', name: 'To Do', count: 5 },
            { key: 'IN_PROGRESS', name: 'In Progress', count: 0 },
            { key: 'IN_REVIEW', name: 'In Review', count: 0 },
            { key: 'DONE', name: 'Done', count: 13 },
          ],
          developers: [],
        },
        {
          id: 2,
          name: 'Sprint B',
          shortLabel: 'S1',
          accentColor: '#C62828',
          startDate: '2026-05-01T00:00:00.000Z',
          dueDate: '2026-05-31T23:59:59.999Z',
          totalCompleted: 7,
          totalTasks: 11,
          totalHours: 22,
          taskStatusDistribution: [
            { key: 'TODO', name: 'To Do', count: 4 },
            { key: 'IN_PROGRESS', name: 'In Progress', count: 0 },
            { key: 'IN_REVIEW', name: 'In Review', count: 0 },
            { key: 'DONE', name: 'Done', count: 7 },
          ],
          developers: [],
        },
      ]);

      renderWithTheme(<DashboardPage projectId="1" />);
      await screen.findByText(/Dashboard\s*[–-]\s*Proyecto Demo/i);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(2);
      const toAdd = checkboxes.find((cb) => !cb.checked);
      expect(toAdd).toBeTruthy();
      await user.click(toAdd);

      expect(screen.getAllByTestId('dashboard-header-tasks-completed')).toHaveLength(2);
    });
  });
});
