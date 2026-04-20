/**
 * Requirements:
 *   1  — Real-time tasks per user: developer filter.
 *   1b — Data refresh (Sync data).
 * Topics: Mock HTTP, User Events, custom hook behavior (loadData).
 */
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupFetchMock, jsonResponse, pathIncludes } from '../../mocks/mockFetch';
import { renderWithTheme } from '../../test-utils';
import TasksPage from './TasksPage';

const sprint1 = {
  id: 1,
  name: 'Sprint 1',
  assignedProject: { id: 1 },
  startDate: '2026-04-01T00:00:00.000Z',
  dueDate: '2026-04-30T23:59:59.999Z',
};

const developers = [
  { id: 1, name: 'Alice Dev' },
  { id: 2, name: 'Bob Dev'   },
];

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  try { localStorage.setItem('currentProjectId', '1'); } catch { /* ignore */ }
});

// Requirement 1: developer filter 

test('developer filter shows only tasks assigned to that developer', async () => {
  const user = userEvent.setup();
  setupFetchMock([
    { test: (url) => pathIncludes(url, '/api/sprints'),               handle: () => jsonResponse([sprint1]) },
    { test: (url) => pathIncludes(url, '/api/projects/1/developers'), handle: () => jsonResponse(developers) },
    {
      test: (url) => pathIncludes(url, '/api/tasks'),
      handle: () => jsonResponse([
        { id: 99,  title: 'Task A', status: 'TODO', priority: 'MEDIUM', assignedHours: 3, dueDate: '2026-04-20T00:00:00.000Z', assignedSprint: { id: 1 } },
        { id: 100, title: 'Task B', status: 'TODO', priority: 'MEDIUM', assignedHours: 2, dueDate: '2026-04-21T00:00:00.000Z', assignedSprint: { id: 1 } },
      ]),
    },
    {
      test: (url) => pathIncludes(url, '/api/user-tasks'),
      handle: () => jsonResponse([
        { task: { id: 99  }, user: { id: 1, name: 'Alice Dev' }, status: 'TODO' },
        { task: { id: 100 }, user: { id: 2, name: 'Bob Dev'   }, status: 'TODO' },
      ]),
    },
  ]);

  renderWithTheme(<TasksPage projectId="1" />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

  expect(screen.getByText('Task A')).toBeInTheDocument();
  expect(screen.getByText('Task B')).toBeInTheDocument();

  // MUI Select renders as role="button" with its current value as accessible name.
  // The Developer select starts with "All developers".
  await user.click(screen.getByRole('button', { name: /all developers/i }));
  await user.click(await screen.findByRole('option', { name: 'Alice Dev' }));

  await waitFor(() => expect(screen.getByText('1 shown')).toBeInTheDocument());
  expect(screen.getByText('Task A')).toBeInTheDocument();
  expect(screen.queryByText('Task B')).not.toBeInTheDocument();
});

// Requirement 1b: Sync data 

test('Sync data refetches tasks and updates visible titles', async () => {
  const user = userEvent.setup();
  let tasksPayload = [
    { id: 1, title: 'Before sync', status: 'TODO', priority: 'LOW', assignedHours: 1, dueDate: '2026-04-10T00:00:00.000Z', assignedSprint: { id: 1 } },
  ];

  setupFetchMock([
    { test: (url) => pathIncludes(url, '/api/sprints'),               handle: () => jsonResponse([sprint1]) },
    { test: (url) => pathIncludes(url, '/api/projects/1/developers'), handle: () => jsonResponse([developers[0]]) },
    { test: (url) => pathIncludes(url, '/api/tasks'),                 handle: () => jsonResponse(tasksPayload) },
    {
      test: (url) => pathIncludes(url, '/api/user-tasks'),
      handle: () => jsonResponse([{ task: { id: 1 }, user: { id: 1, name: 'Alice Dev' }, status: 'TODO' }]),
    },
  ]);

  renderWithTheme(<TasksPage projectId="1" />);
  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  expect(screen.getByText('Before sync')).toBeInTheDocument();

  tasksPayload = [
    { id: 1, title: 'After sync', status: 'TODO', priority: 'LOW', assignedHours: 1, dueDate: '2026-04-10T00:00:00.000Z', assignedSprint: { id: 1 } },
  ];

  await user.click(screen.getByRole('button', { name: /sync data/i }));
  await waitFor(() => expect(screen.getByText('After sync')).toBeInTheDocument());
  expect(screen.queryByText('Before sync')).not.toBeInTheDocument();
});