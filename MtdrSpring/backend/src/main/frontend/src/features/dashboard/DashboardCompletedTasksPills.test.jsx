/**
 * Requirement 6 — team completed tasks per sprint (header pills).
 */
import React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import DashboardCompletedTasksPills from './DashboardCompletedTasksPills';

describe('DashboardCompletedTasksPills', () => {
  describe('compare mode aggregated total', () => {
    test('matches snapshot', () => {
      renderWithTheme(
        <DashboardCompletedTasksPills
          accent="#1565C0"
          pillTestId="dashboard-header-tasks-completed"
          compareBySprint={[
            { id: 1, shortLabel: 'S1', completed: 2, accentColor: '#1565C0' },
            { id: 2, shortLabel: 'S2', completed: 5, accentColor: '#26A69A' },
          ]}
        />,
      );
      expect(screen.getByTestId('dashboard-header-tasks-completed').textContent).toMatchSnapshot();
    });

    test('shows completed vs assigned', () => {
      renderWithTheme(<DashboardCompletedTasksPills completed={7} assigned={12} />);
      expect(screen.getByText('7 / 12 completed')).toBeTruthy();
    });
  });
});
