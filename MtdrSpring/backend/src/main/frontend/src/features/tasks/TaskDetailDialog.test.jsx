/**
 * Requirement 2: State changes for task data (name, hours, type, priority, delete).
 * Component under test: TaskDetailDialog.jsx.
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
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
      handle: (_url, init) => {
        lastPutBody = parseBody(init);
        return jsonResponse({ ...baseTask, ...lastPutBody, id: 10 });
      },
    },
  ]);
});

// Edits title, hours, work item type, and priority; asserts PUT body and parent onSaved/onClose.
test('save persists title, hours, type, and priority; notifies parent', async () => {
  const user = userEvent.setup({ delay: null });
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

  const dialog = screen.getByRole('dialog');

  await user.clear(within(dialog).getByLabelText('Task title'));
  await user.type(within(dialog).getByLabelText('Task title'), 'Nuevo título');

  await user.clear(within(dialog).getByLabelText('Assigned hours'));
  await user.type(within(dialog).getByLabelText('Assigned hours'), '13');

  const combo = within(dialog).getAllByRole('combobox');
  await user.click(combo[0]);
  await user.click(await screen.findByRole('option', { name: /user story/i }));

  await user.click(combo[2]);
  await user.click(await screen.findByRole('option', { name: /^high$/i }));

  await user.click(screen.getByRole('button', { name: /save changes/i }));

  await waitFor(() => {
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
  expect(lastPutBody?.title).toBe('Nuevo título');
  expect(lastPutBody?.assignedHours).toBe(13);
  expect(lastPutBody?.classification).toBe('USER_STORY');
  expect(lastPutBody?.priority).toBe('HIGH');
}, 20000);

// Confirms delete in the browser dialog, then expects DELETE success and onDeleted callback.
test('delete: after confirm, calls onDeleted', async () => {
  const user = userEvent.setup();
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
