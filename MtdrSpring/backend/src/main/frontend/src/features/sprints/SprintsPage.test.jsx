/**
 * Requirement 1: Real-time display of tasks assigned to each user.
 * Component under test: SprintsPage.jsx (integration: sprint view + per-user task columns).
 */
import React from 'react';
import { screen } from '@testing-library/react';
import { setupFetchMock, jsonResponse, pathIncludes } from '../../mocks/mockFetch';
import { renderWithTheme } from '../../test-utils';
import SprintsPage from './SprintsPage';

const activeSprint = {
  id: 1,
  name: 'Sprint 1',
  assignedProject: { id: 1 },
  startDate: '2026-04-01T00:00:00.000Z',
  dueDate: '2026-04-30T23:59:59.999Z',
};

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  try {
    localStorage.setItem('currentProjectId', '1');
  } catch {
    /* ignore */
  }
});

// After API data loads, renders task titles that reflect user–task assignments.
test('after load, lists tasks assigned to developers', async () => {
  setupFetchMock([
    {
      test: (url) => pathIncludes(url, '/api/projects/1/developers'),
      handle: () =>
        jsonResponse([
          { id: 1, name: 'Ana Ríos' },
          { id: 2, name: 'Bruno Díaz' },
        ]),
    },
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
      test: (url) => pathIncludes(url, '/api/sprints'),
      handle: () => jsonResponse([activeSprint]),
    },
    {
      test: (url) => pathIncludes(url, '/api/tasks'),
      handle: () =>
        jsonResponse([
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
        ]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/user-tasks') &&
        String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () =>
        jsonResponse([
          { task: { id: 10 }, user: { id: 1, name: 'Ana Ríos' }, status: 'TODO', workedHours: 2 },
          { task: { id: 11 }, user: { id: 2, name: 'Bruno Díaz' }, status: 'TODO', workedHours: 0 },
        ]),
    },
  ]);

  renderWithTheme(<SprintsPage projectId="1" />);

  expect(await screen.findByText('Tarea de Ana')).toBeInTheDocument();
  expect(await screen.findByText('Tarea de Bruno')).toBeInTheDocument();
});
