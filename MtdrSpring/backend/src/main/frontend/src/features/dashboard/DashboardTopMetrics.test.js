/**
 * Topics: Snapshots, Mock modules, Component isolation.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardTopMetrics from '../dashboard/DashboardTopMetrics';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="chart">{children}</div>,
  LineChart: () => null, Line: () => null, XAxis: () => null,
  YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
}));

jest.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => <div {...p}>{children}</div> },
}));
let originalError;
beforeAll(() => {
  originalError = console.error.bind(console.error);
  console.error = (...args) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('whileInView') ||
      msg.includes('whileinview') ||
      msg.includes('framer') ||
      // General "unknown prop on DOM element" that comes from motion mock
      (msg.includes('React does not recognize') && msg.includes('prop on a DOM element'))
    ) {
      return;
    }
    originalError(...args);
  };
});
 
afterAll(() => {
  console.error = originalError;
});

// Snapshot

test('SNAPSHOT: scorecards render consistently for team totals', () => {
  const { container } = render(
    <DashboardTopMetrics
      totalTasks={6}
      totalHours={24.5}
      avgTasksPerDev={2}
      avgHoursPerDev={8.2}
      uniqueDevCount={3}
      showSectionHeader={false}
    />,
  );
  expect(container.firstChild).toMatchSnapshot();
});

// Value rendering 

test('renders totalTasks and totalHours with correct values', () => {
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
});

// Section header visibility 

test('section header "Scorecards" visible when showSectionHeader=true', () => {
  render(
    <DashboardTopMetrics
      totalTasks={0} totalHours={0}
      avgTasksPerDev={0} avgHoursPerDev={0}
      uniqueDevCount={0}
      showSectionHeader
    />,
  );
  expect(screen.getByText('Scorecards')).toBeInTheDocument();
});

test('section header hidden when showSectionHeader=false', () => {
  render(
    <DashboardTopMetrics
      totalTasks={0} totalHours={0}
      avgTasksPerDev={0} avgHoursPerDev={0}
      uniqueDevCount={0}
      showSectionHeader={false}
    />,
  );
  expect(screen.queryByText('Scorecards')).not.toBeInTheDocument();
});