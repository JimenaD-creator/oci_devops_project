import { expect, test } from 'vitest';
import {
  dateInputToEndOfLocalDayIso,
  dateInputToStartOfLocalDayIso,
  isoToDateInputValue,
  isDateInputOnOrBefore,
  mapTaskToKanban,
  deriveDeveloperKanbanStatus,
  patchUserTasksAfterTaskSave,
  shouldPromptWorkedHoursForAssigneeDone,
  shouldPromptWorkedHoursOnKanbanDone,
} from './taskUtils';

test('dateInputToEndOfLocalDayIso uses 23:59:59.999 on selected day', () => {
  expect(dateInputToEndOfLocalDayIso('2026-06-15')).toBe('2026-06-15T23:59:59.999');
});

test('dateInputToStartOfLocalDayIso uses midnight on selected day', () => {
  expect(dateInputToStartOfLocalDayIso('2026-06-15')).toBe('2026-06-15T00:00:00.000');
});

test('isoToDateInputValue keeps calendar day from API datetime', () => {
  expect(isoToDateInputValue('2026-06-15T23:59:59.999')).toBe('2026-06-15');
  expect(isoToDateInputValue('2026-06-15T00:00:00.000Z')).toBe('2026-06-15');
});

test('isDateInputOnOrBefore compares YYYY-MM-DD strings', () => {
  expect(isDateInputOnOrBefore('2026-06-01', '2026-06-15')).toBe(true);
  expect(isDateInputOnOrBefore('2026-06-16', '2026-06-15')).toBe(false);
});

test('mapTaskToKanban uses logged worked hours, not assigned estimate', () => {
  const task = { id: 10, title: 'New task', assignedHours: 1, status: 'DONE' };
  const assignmentRows = [
    { user: { id: 2 }, task: { id: 10 }, workedHours: 0.5, status: 'COMPLETED' },
  ];

  const row = mapTaskToKanban(task, ['Dev'], assignmentRows);

  expect(row.assignedHours).toBe(1);
  expect(row.actualHours).toBe(0.5);
});

test('shouldPromptWorkedHoursOnKanbanDone when developer is sole incomplete assignee', () => {
  const assignees = [{ user: { id: 7 }, task: { id: 1 }, status: 'IN_PROGRESS' }];

  expect(
    shouldPromptWorkedHoursOnKanbanDone({
      developerMode: true,
      currentUserId: 7,
      normalizedStatus: 'DONE',
      assignees,
    }),
  ).toBe(true);
});

test('shouldPromptWorkedHoursOnKanbanDone is false for manager or multi-assignee', () => {
  const oneAssignee = [{ user: { id: 7 }, task: { id: 1 }, status: 'TODO' }];

  expect(
    shouldPromptWorkedHoursOnKanbanDone({
      developerMode: false,
      currentUserId: 7,
      normalizedStatus: 'DONE',
      assignees: oneAssignee,
    }),
  ).toBe(false);

  expect(
    shouldPromptWorkedHoursOnKanbanDone({
      developerMode: true,
      currentUserId: 7,
      normalizedStatus: 'DONE',
      assignees: [
        { user: { id: 7 }, status: 'TODO' },
        { user: { id: 8 }, status: 'TODO' },
      ],
    }),
  ).toBe(false);
});

test('shouldPromptWorkedHoursOnKanbanDone is false when assignment already complete', () => {
  expect(
    shouldPromptWorkedHoursOnKanbanDone({
      developerMode: true,
      currentUserId: 7,
      normalizedStatus: 'DONE',
      assignees: [{ user: { id: 7 }, status: 'COMPLETED', workedHours: 2 }],
    }),
  ).toBe(false);
});

test('deriveDeveloperKanbanStatus shows Done when TASK is Done even if assignment row is stale', () => {
  expect(
    deriveDeveloperKanbanStatus('DONE', [{ user: { id: 7 }, status: 'IN_PROGRESS' }]),
  ).toBe('DONE');
});

test('deriveDeveloperKanbanStatus shows Done when developer assignment is COMPLETED', () => {
  expect(
    deriveDeveloperKanbanStatus('IN_PROGRESS', [{ user: { id: 7 }, status: 'COMPLETED' }]),
  ).toBe('DONE');
});

test('patchUserTasksAfterTaskSave preserves worked hours when completing assignment', () => {
  const prev = [
    { user: { id: 7 }, task: { id: 10 }, status: 'IN_PROGRESS', workedHours: 0 },
    { user: { id: 8 }, task: { id: 10 }, status: 'IN_PROGRESS', workedHours: 0 },
  ];
  const next = patchUserTasksAfterTaskSave(
    prev,
    { id: 10, status: 'DONE' },
    {
      syncAssignmentStatuses: true,
      assignmentStatus: 'COMPLETED',
      userId: 7,
      workedHours: 4.5,
    },
  );
  const mine = next.find((ut) => ut.user.id === 7);
  const other = next.find((ut) => ut.user.id === 8);
  expect(mine.status).toBe('COMPLETED');
  expect(mine.workedHours).toBe(4.5);
  expect(other.status).toBe('IN_PROGRESS');
  expect(other.workedHours).toBe(0);
});

test('shouldPromptWorkedHoursForAssigneeDone only for current developer', () => {
  expect(
    shouldPromptWorkedHoursForAssigneeDone({
      developerMode: true,
      currentUserId: 7,
      assigneeUserId: 7,
    }),
  ).toBe(true);

  expect(
    shouldPromptWorkedHoursForAssigneeDone({
      developerMode: true,
      currentUserId: 7,
      assigneeUserId: 9,
    }),
  ).toBe(false);

  expect(
    shouldPromptWorkedHoursForAssigneeDone({
      developerMode: false,
      currentUserId: 7,
      assigneeUserId: 7,
    }),
  ).toBe(false);
});
