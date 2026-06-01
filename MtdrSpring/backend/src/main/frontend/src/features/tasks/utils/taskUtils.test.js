import { expect, test } from 'vitest';
import {
  mapTaskToKanban,
  shouldPromptWorkedHoursForAssigneeDone,
  shouldPromptWorkedHoursOnKanbanDone,
} from './taskUtils';

test('mapTaskToKanban uses logged worked hours, not assigned estimate', () => {
  const task = { id: 10, title: 'New task', assignedHours: 1, status: 'DONE' };
  const assignmentRows = [{ user: { id: 2 }, task: { id: 10 }, workedHours: 0.5, status: 'COMPLETED' }];

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
