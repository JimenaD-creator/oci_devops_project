import { describe, expect, it } from 'vitest';
import {
  assigneeCompletionTimeMs,
  isAssigneeCompletionOnTime,
  multiAssigneeTaskOnTime,
  taskOnTimeDisplayForManager,
} from './assigneeOnTimeUtils';

describe('assigneeOnTimeUtils', () => {
  it('uses assignee completedAt, not task finishDate, for multi-assignee tasks', () => {
    const ut = {
      status: 'COMPLETED',
      completedAt: '2026-01-10T12:00:00.000Z',
    };
    const meta = {
      dueDate: '2026-01-15T00:00:00.000Z',
      finishDate: '2026-01-20T12:00:00.000Z',
      assigneeCount: 2,
    };
    expect(isAssigneeCompletionOnTime(ut, meta.dueDate, meta)).toBe(true);
  });

  it('counts same calendar due day as on time (due at midnight)', () => {
    const ut = {
      status: 'COMPLETED',
      completedAt: '2026-01-15T18:30:00.000Z',
    };
    const due = '2026-01-15T00:00:00.000Z';
    expect(isAssigneeCompletionOnTime(ut, due, { assigneeCount: 1 })).toBe(true);
  });

  it('falls back to task finishDate for single assignee', () => {
    const ut = { status: 'COMPLETED' };
    const meta = {
      dueDate: '2026-01-15T00:00:00.000Z',
      finishDate: '2026-01-14T12:00:00.000Z',
      assigneeCount: 1,
    };
    expect(assigneeCompletionTimeMs(ut, meta)).toBe(new Date(meta.finishDate).getTime());
  });

  it('multiAssigneeTaskOnTime is true only when all assignees completed on time', () => {
    const progress = [
      { completed: true, completedAt: '2026-01-10T12:00:00.000Z' },
      { completed: true, completedAt: '2026-01-12T12:00:00.000Z' },
    ];
    const due = '2026-01-15T00:00:00.000Z';
    expect(multiAssigneeTaskOnTime(progress, due, { assigneeCount: 2 })).toBe(true);
  });

  it('multiAssigneeTaskOnTime is null while assignees are still pending', () => {
    const progress = [
      { completed: false, status: 'TODO' },
      { completed: false, status: 'TODO' },
    ];
    expect(multiAssigneeTaskOnTime(progress, '2026-01-15T00:00:00.000Z', { assigneeCount: 2 })).toBe(
      null,
    );
  });

  it('taskOnTimeDisplayForManager shows — when multi-assignee task is still To Do', () => {
    const item = {
      dueDate: '2026-01-15T00:00:00.000Z',
      statusRaw: 'TODO',
      done: false,
      assigneeProgress: [
        { completed: false, status: 'TODO' },
        { completed: false, status: 'TODO' },
      ],
    };
    expect(taskOnTimeDisplayForManager(item)).toBe('—');
  });

  it('multiAssigneeTaskOnTime is false when any assignee is late', () => {
    const progress = [
      { completed: true, completedAt: '2026-01-10T12:00:00.000Z' },
      { completed: true, completedAt: '2026-01-20T12:00:00.000Z' },
    ];
    expect(multiAssigneeTaskOnTime(progress, '2026-01-15T00:00:00.000Z', { assigneeCount: 2 })).toBe(
      false,
    );
  });

  it('taskOnTimeDisplayForManager returns Yes when all assignees on time', () => {
    const item = {
      dueDate: '2026-01-15T00:00:00.000Z',
      completedAt: '2026-01-20T12:00:00.000Z',
      statusRaw: 'DONE',
      assigneeProgress: [
        { completed: true, completedAt: '2026-01-10T12:00:00.000Z' },
        { completed: true, completedAt: '2026-01-12T12:00:00.000Z' },
      ],
    };
    expect(taskOnTimeDisplayForManager(item)).toBe('Yes');
  });

  it('taskOnTimeDisplayForManager returns No when any assignee is late', () => {
    const item = {
      dueDate: '2026-01-15T00:00:00.000Z',
      statusRaw: 'DONE',
      assigneeProgress: [
        { completed: true, completedAt: '2026-01-10T12:00:00.000Z' },
        { completed: true, completedAt: '2026-01-20T12:00:00.000Z' },
      ],
    };
    expect(taskOnTimeDisplayForManager(item)).toBe('No');
  });
});
