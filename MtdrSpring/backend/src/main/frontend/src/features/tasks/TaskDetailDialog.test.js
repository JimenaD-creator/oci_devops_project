/**
 * Requirement 2: State changes for task data (title, developer, Story Points, hours).
 * Topics: Form Testing, Mock HTTP requests, Mock modules, mock functions (spy).
 */
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupFetchMock, jsonResponse, pathIncludes } from '../../mocks/mockFetch';
import { renderWithTheme } from '../../test-utils';
import { TaskDetailDialog } from './TaskDetailDialog';

const baseTask = {
  id: 10,
  title: 'Original',
  description: 'Desc',
  classification: 'TASK',
  status: 'TODO',
  priority: 'MEDIUM',
  assignedHours: 5,
  startDate: '2026-01-01T00:00:00.000Z',
  dueDate: '2026-01-15T00:00:00.000Z',
  assignedSprint: { id: 1 },
};

let lastPutBody;

function parseBody(init) {
  const raw = init?.body;
  if (raw == null) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  lastPutBody = null;
  setupFetchMock([
    {
      test: (url) => pathIncludes(url, '/api/projects/1/developers'),
      handle: () => jsonResponse([{ id: 101, name: 'Dev Uno' }]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/tasks/10') && String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () => jsonResponse(baseTask),
    },
    {
      test: (url) => pathIncludes(url, '/api/user-tasks/task/10'),
      handle: () => jsonResponse([]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/tasks/10') && String(init?.method || '').toUpperCase() === 'PUT',
      handle: (url, init) => {
        lastPutBody = parseBody(init);
        return jsonResponse({ ...baseTask, ...lastPutBody, id: 10 });
      },
    },
  ]);
});

// Requirement 2a: title change 

test('save updates title and notifies parent', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();
  const onClose = jest.fn();

  renderWithTheme(
    <TaskDetailDialog
      open
      initialTask={baseTask}
      sprints={[{ id: 1, name: 'Sprint 1' }]}
      projectDevelopers={[]}
      activeProjectId="1"
      onClose={onClose}
      onSaved={onSaved}
    />,
  );

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /edit/i }));
  await user.clear(screen.getByLabelText('Task title'));
  await user.type(screen.getByLabelText('Task title'), 'Nuevo título');
  await user.click(screen.getByRole('button', { name: /save changes/i }));

  await waitFor(() => {
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
  expect(lastPutBody?.title).toBe('Nuevo título');
});

// Requirement 2b: hours, type, priority 

test('save persists assigned hours, work item type (User Story), and priority (High)', async () => {
  const user = userEvent.setup();
  const onSaved = jest.fn();

  renderWithTheme(
    <TaskDetailDialog
      open
      initialTask={baseTask}
      sprints={[{ id: 1, name: 'Sprint 1' }]}
      projectDevelopers={[]}
      activeProjectId="1"
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  );

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /edit/i }));

  const dialog = screen.getByRole('dialog');

  await user.clear(within(dialog).getByLabelText('Assigned hours'));
  await user.type(within(dialog).getByLabelText('Assigned hours'), '13');

  const comboboxes = within(dialog).getAllByRole('combobox');
  await user.click(comboboxes[0]); // Work item type
  await user.click(await screen.findByRole('option', { name: /user story/i }));
 
  // Priority
  await user.click(comboboxes[2]);
  await user.click(await screen.findByRole('option', { name: /^high$/i }));

  await user.click(screen.getByRole('button', { name: /save changes/i }));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(lastPutBody?.assignedHours).toBe(13);
  expect(lastPutBody?.classification).toBe('USER_STORY');
  expect(lastPutBody?.priority).toBe('HIGH');
});

// MOCK MODULE: window.confirm for delete

test('MOCK MODULE: delete task calls onDeleted after confirm', async () => {
  const user = userEvent.setup();
  // Spy on window.confirm and return true (user clicks OK)
  jest.spyOn(window, 'confirm').mockReturnValue(true);

  setupFetchMock([
    {
      test: (url) => pathIncludes(url, '/api/projects/1/developers'),
      handle: () => jsonResponse([]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/tasks/10') && String(init?.method || 'GET').toUpperCase() === 'GET',
      handle: () => jsonResponse(baseTask),
    },
    {
      test: (url) => pathIncludes(url, '/api/user-tasks/task/10'),
      handle: () => jsonResponse([]),
    },
    {
      test: (url, init) =>
        pathIncludes(url, '/api/tasks/10') && String(init?.method || '').toUpperCase() === 'DELETE',
      handle: () => new Response(null, { status: 200 }),
    },
  ]);

  const onDeleted = jest.fn();

  renderWithTheme(
    <TaskDetailDialog
      open
      initialTask={baseTask}
      sprints={[{ id: 1 }]}
      projectDevelopers={[]}
      activeProjectId="1"
      onClose={jest.fn()}
      onSaved={jest.fn()}
      onDeleted={onDeleted}
    />,
  );

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(10));
});