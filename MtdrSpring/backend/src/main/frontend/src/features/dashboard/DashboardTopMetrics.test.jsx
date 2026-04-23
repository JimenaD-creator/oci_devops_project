/**
 * Requirement 6 — team hours per sprint (`DashboardTopMetrics` scorecards).
 */
import React from 'react';
import { screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import DashboardTopMetrics from './DashboardTopMetrics';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="chart">{children}</div>,
  LineChart: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

vi.mock('framer-motion', () => {
  const strip = (p = {}) => {
    const { whileInView, initial, animate, viewport, transition, variants, ...rest } = p;
    return rest;
  };
  return {
    motion: {
      div: ({ children, ...p }) => <div {...strip(p)}>{children}</div>,
    },
  };
});

test('shows Total hours worked, value, helper copy, and Scorecards heading', () => {
  renderWithTheme(
    <DashboardTopMetrics
      totalTasks={10}
      totalHours={40.0}
      avgTasksPerDev={2}
      avgHoursPerDev={8}
      uniqueDevCount={5}
      showSectionHeader
      multiSprint={false}
    />,
  );
  expect(screen.getByText('Scorecards')).toBeInTheDocument();
  expect(screen.getByText('Total hours worked')).toBeInTheDocument();
  expect(screen.getByText('40.0')).toBeInTheDocument();
  expect(screen.getByText('Hours logged this sprint')).toBeInTheDocument();
});

// Hides the Scorecards label when the section header is turned off.
test('hides Scorecards header when showSectionHeader is false', () => {
  renderWithTheme(
    <DashboardTopMetrics
      totalTasks={0}
      totalHours={0}
      avgTasksPerDev={0}
      avgHoursPerDev={0}
      uniqueDevCount={0}
      showSectionHeader={false}
    />,
  );
  expect(screen.queryByText('Scorecards')).not.toBeInTheDocument();
});
