/**
 * Requirement 1: Real-time display of tasks assigned to each user.
 * Component under test: SprintsPage.jsx (integration: sprint view + per-user task columns).
 */
import React from 'react';
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import {
  fetchSprintsProjectDevelopers,
  fetchSprintsProjectSummary,
  fetchSprintsTasksAndAssignments,
} from './sprintsPageApi';
import SprintsPage from './SprintsPage';

vi.mock('./sprintsPageApi', () => ({
  fetchSprintsProjectDevelopers: vi.fn(),
  fetchSprintsProjectSummary: vi.fn(),
  fetchSprintsTasksAndAssignments: vi.fn(),
}));

const activeSprint = {
  id: 1,
  name: 'Sprint 1',
  assignedProject: { id: 1 },
  startDate: '2026-04-01T00:00:00.000Z',
  dueDate: '2026-04-30T23:59:59.999Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  try {
    localStorage.setItem('currentProjectId', '1');
  } catch {
    /* ignore */
  }
});

// After API data loads, renders task titles that reflect user–task assignments.
test('after load, lists tasks assigned to developers', async () => {
  fetchSprintsProjectDevelopers.mockResolvedValue([
    { id: 1, name: 'Ana Ríos' },
    { id: 2, name: 'Bruno Díaz' },
  ]);
  fetchSprintsProjectSummary.mockResolvedValue({ id: 1, name: 'Proyecto Demo' });
  fetchSprintsTasksAndAssignments.mockResolvedValue({
    pid: 1,
    sprintsList: [activeSprint],
    tasksList: [
      {
        id: 10,
        title: 'Tarea de Ana',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assignedHours: 5,
        dueDate: '2026-04-20T00:00:00.000Z',
        assignedSprint: { id: 1 },
      },
      {
        id: 11,
        title: 'Tarea de Bruno',
        status: 'TODO',
        priority: 'MEDIUM',
        assignedHours: 3,
        dueDate: '2026-04-22T00:00:00.000Z',
        assignedSprint: { id: 1 },
      },
    ],
    userTasksList: [
      { task: { id: 10 }, user: { id: 1, name: 'Ana Ríos' }, status: 'TODO', workedHours: 2 },
      { task: { id: 11 }, user: { id: 2, name: 'Bruno Díaz' }, status: 'TODO', workedHours: 0 },
    ],
  });

  renderWithTheme(<SprintsPage projectId="1" />);

  // Task names (already present)
  expect(await screen.findByText('Tarea de Ana')).toBeInTheDocument();
  expect(await screen.findByText('Tarea de Bruno')).toBeInTheDocument();

  // Developer names
  expect(await screen.findByText('Ana Ríos')).toBeInTheDocument();
  expect(await screen.findByText('Bruno Díaz')).toBeInTheDocument();
});
