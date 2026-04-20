/**
 * Supporting — DashboardTopMetrics scorecard (not tied to a single numbered requirement).
 * Component under test: DashboardTopMetrics.jsx.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardTopMetrics from './DashboardTopMetrics';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="chart">{children}</div>,
  LineChart: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}));

jest.mock('framer-motion', () => {
  const React = require('react');
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

// Renders aggregate totals and the “Scorecards” section title when enabled.
test('shows totals and Scorecards header when showSectionHeader is true', () => {
  render(
    <DashboardTopMetrics
      totalTasks={10}
      totalHours={40.0}
      avgTasksPerDev={2}
      avgHoursPerDev={8}
      uniqueDevCount={5}
      showSectionHeader
    />,
  );
  expect(screen.getByText('10')).toBeInTheDocument();
  expect(screen.getByText('40.0')).toBeInTheDocument();
  expect(screen.getByText('Scorecards')).toBeInTheDocument();
});

// Hides the Scorecards label when the section header is turned off.
test('hides Scorecards header when showSectionHeader is false', () => {
  render(
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
