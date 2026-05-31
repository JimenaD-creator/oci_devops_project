import { expect, test } from 'vitest';
import { mapTaskToKanban } from './taskUtils';

test('mapTaskToKanban uses logged worked hours, not assigned estimate', () => {
  const task = { id: 10, title: 'New task', assignedHours: 1, status: 'DONE' };
  const assignmentRows = [{ user: { id: 2 }, task: { id: 10 }, workedHours: 0.5, status: 'COMPLETED' }];

  const row = mapTaskToKanban(task, ['Dev'], assignmentRows);

  expect(row.assignedHours).toBe(1);
  expect(row.actualHours).toBe(0.5);
});
