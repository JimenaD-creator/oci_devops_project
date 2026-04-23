/**
 * Requirement 6 — team completed tasks per sprint (header pills).
 */
import React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import DashboardCompletedTasksPills from './DashboardCompletedTasksPills';

describe('DashboardCompletedTasksPills', () => {
  describe('chip labels from sprint totals', () => {
    test('single sprint: shows "{count} tasks completed"', () => {
      renderWithTheme(
        <DashboardCompletedTasksPills
          accent="#1565C0"
          count={13}
          pillTestId="dashboard-header-tasks-completed"
        />,
      );
      expect(screen.getByTestId('dashboard-header-tasks-completed')).toHaveTextContent(
        '13 tasks completed',
      );
    });

    test('compare: one chip per sprint with "{label}: {count} tasks completed"', () => {
      renderWithTheme(
        <DashboardCompletedTasksPills
          accent="#1565C0"
          pillTestId="dashboard-header-tasks-completed"
          compareBySprint={[
            { id: 1, shortLabel: 'S1', completed: 2, accentColor: '#1565C0' },
            { id: 2, shortLabel: 'S2', completed: 5, accentColor: '#C62828' },
          ]}
        />,
      );
      const pills = screen.getAllByTestId('dashboard-header-tasks-completed');
      expect(pills).toHaveLength(2);
      expect(pills[0]).toHaveTextContent('S1: 2 tasks completed');
      expect(pills[1]).toHaveTextContent('S2: 5 tasks completed');
    });
  });

  describe('compare mode label list', () => {
    // Snapshot testing: stable list of visible pill labels in compare-by-sprint mode.
    test('matches snapshot', () => {
      renderWithTheme(
        <DashboardCompletedTasksPills
          accent="#1565C0"
          pillTestId="dashboard-header-tasks-completed"
          compareBySprint={[
            { id: 1, shortLabel: 'S1', completed: 2, accentColor: '#1565C0' },
            { id: 2, shortLabel: 'S2', completed: 5, accentColor: '#C62828' },
          ]}
        />,
      );
      const labels = screen
        .getAllByTestId('dashboard-header-tasks-completed')
        .map((el) => el.textContent);
      expect(labels).toMatchSnapshot();
    });
  });
});
