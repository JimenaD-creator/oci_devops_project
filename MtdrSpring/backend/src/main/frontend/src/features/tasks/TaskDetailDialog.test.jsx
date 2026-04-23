/**
 * Requirement 2: State changes for task data (name, hours, type, priority, delete).
 * Component under test: TaskDetailDialog.jsx.
 */
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import {
  deleteTaskById,
  fetchTaskById,
  fetchTaskDetailDevelopers,
  fetchUserTasksForTask,
  putTask,
} from './taskDetailApi';
import { TaskDetailDialog } from './TaskDetailDialog';

vi.mock('./taskDetailApi', () => ({
  fetchTaskDetailDevelopers: vi.fn(),
  fetchTaskById: vi.fn(),
  fetchUserTasksForTask: vi.fn(),
  deleteUserTasksForTask: vi.fn(),
  postUserTask: vi.fn(),
  putTask: vi.fn(),
  deleteTaskById: vi.fn(),
}));

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

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  lastPutBody = null;
  fetchTaskDetailDevelopers.mockResolvedValue([{ id: 101, name: 'Dev Uno' }]);
  fetchTaskById.mockResolvedValue(baseTask);
  fetchUserTasksForTask.mockResolvedValue([]);
  putTask.mockImplementation((_id, body) => {
    lastPutBody = body;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ...baseTask, ...body, id: 10 }),
    });
  });
});

// Edits title, hours, work item type, and priority; asserts PUT body and parent onSaved/onClose.
test('save persists title, hours, type, and priority; notifies parent', async () => {
  const user = userEvent.setup({ delay: null });
  const onSaved = vi.fn();
  const onClose = vi.fn();

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

  // MUI <Select> exposes the trigger as role="button" in this environment (not combobox).
  const taskTypeTrigger = within(dialog).getByRole('button', { name: 'Task' });
  await user.click(taskTypeTrigger);
  await user.click(await screen.findByRole('option', { name: /user story/i }));

  const priorityTrigger = within(dialog).getByRole('button', { name: 'Medium' });
  await user.click(priorityTrigger);
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
  vi.spyOn(window, 'confirm').mockReturnValue(true);

  fetchTaskDetailDevelopers.mockResolvedValue([]);
  fetchTaskById.mockResolvedValue(baseTask);
  fetchUserTasksForTask.mockResolvedValue([]);
  deleteTaskById.mockResolvedValue({ ok: true, status: 200 });

  const onDeleted = vi.fn();

  renderWithTheme(
    <TaskDetailDialog
      open
      initialTask={baseTask}
      sprints={[{ id: 1 }]}
      projectDevelopers={[]}
      activeProjectId="1"
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onDeleted={onDeleted}
    />,
  );

  await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: /delete/i }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(10));
});
