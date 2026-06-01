import { expect, test } from 'vitest';
import {
  filterTasksForKpiSprints,
  pickProjectSprintsForKpi,
  taskSprintIdForKpi,
} from './kpiAnalyticsProjectData';

test('pickProjectSprintsForKpi prefers snapshot enriched sprints over empty context', () => {
  const snap = [{ id: 1, assignedProject: { id: 5 }, shortLabel: 'Sprint 0' }];
  const context = [];
  const out = pickProjectSprintsForKpi(snap, context, 5);
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe(1);
});

test('pickProjectSprintsForKpi falls back to context when snapshot empty', () => {
  const context = [{ id: 2, assignedProjectId: 5, name: 'Sprint 1' }];
  const out = pickProjectSprintsForKpi([], context, 5);
  expect(out).toHaveLength(1);
  expect(out[0].id).toBe(2);
});

test('filterTasksForKpiSprints keeps tasks in project sprints only', () => {
  const sprints = [{ id: 10 }, { id: 11 }];
  const tasks = [
    { id: 1, assignedSprint: { id: 10 } },
    { id: 2, sprintId: 99 },
  ];
  const out = filterTasksForKpiSprints(tasks, sprints);
  expect(out).toHaveLength(1);
  expect(taskSprintIdForKpi(out[0])).toBe(10);
});
