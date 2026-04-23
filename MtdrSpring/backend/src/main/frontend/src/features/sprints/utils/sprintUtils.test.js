/**
 * Supporting — sprint helpers (status, ordering, default sprint selection).
 * Module under test: sprintUtils.js (pure functions; used by SprintsPage / dashboard).
 */
import { describe, expect, test } from 'vitest';
import {
  inferSprintStatus,
  inferStatusByDate,
  sortTasksForSprintTable,
  pickDefaultSelectedSprint,
} from './sprintUtils';

describe('inferStatusByDate', () => {
  function sprint(start, due) {
    return { startDate: start, dueDate: due };
  }

  // Calendar window entirely in the future → planned.
  test('future sprint → planned', () => {
    expect(inferStatusByDate(sprint('2099-01-01', '2099-01-31'))).toBe('planned');
  });

  // Calendar window entirely in the past → completed.
  test('past sprint → completed', () => {
    expect(inferStatusByDate(sprint('2000-01-01', '2000-01-31'))).toBe('completed');
  });

  // Today falls between start and end → active.
  test('current sprint → active', () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    expect(inferStatusByDate(sprint(start.toISOString(), end.toISOString()))).toBe('active');
  });
});

describe('inferSprintStatus', () => {
  const pastSprint = { id: 1, startDate: '2000-01-01', dueDate: '2000-01-31' };
  const futureSprint = { id: 2, startDate: '2099-01-01', dueDate: '2099-01-31' };

  const cases = [
    { sprint: pastSprint, tasks: [], expected: 'active', desc: 'past sprint, no tasks → active' },
    {
      sprint: pastSprint,
      tasks: [{ assignedSprint: { id: 1 }, status: 'DONE' }],
      expected: 'completed',
      desc: 'past sprint, all DONE → completed',
    },
    {
      sprint: pastSprint,
      tasks: [{ assignedSprint: { id: 1 }, status: 'IN_PROGRESS' }],
      expected: 'pending',
      desc: 'past sprint, not all done → pending',
    },
    {
      sprint: futureSprint,
      tasks: [],
      expected: 'planned',
      desc: 'future sprint, no tasks → planned',
    },
    {
      sprint: futureSprint,
      tasks: [{ assignedSprint: { id: 2 }, status: 'TODO' }],
      expected: 'planned',
      desc: 'future sprint, none done → planned',
    },
    {
      sprint: futureSprint,
      tasks: [
        { assignedSprint: { id: 2 }, status: 'DONE' },
        { assignedSprint: { id: 2 }, status: 'DONE' },
      ],
      expected: 'completed',
      desc: 'future sprint, all DONE → completed',
    },
  ];

  // Combines calendar dates with task completion to infer sprint badge status.
  test.each(cases)('$desc', ({ sprint, tasks, expected }) => {
    expect(inferSprintStatus(sprint, tasks)).toBe(expected);
  });
});

describe('sortTasksForSprintTable', () => {
  // Earlier due date sorts first when priority is equal.
  test('sorts by due date soonest first', () => {
    const tasks = [
      { id: 2, dueDate: '2026-05-01', priority: 'LOW' },
      { id: 1, dueDate: '2026-04-01', priority: 'LOW' },
    ];
    expect(sortTasksForSprintTable(tasks)[0].id).toBe(1);
  });

  test('same due date: CRITICAL before LOW', () => {
    const tasks = [
      { id: 1, dueDate: '2026-04-10', priority: 'LOW' },
      { id: 2, dueDate: '2026-04-10', priority: 'CRITICAL' },
    ];
    expect(sortTasksForSprintTable(tasks)[0].id).toBe(2);
  });

  test('handles empty array', () => {
    expect(sortTasksForSprintTable([])).toEqual([]);
  });
});

describe('pickDefaultSelectedSprint', () => {
  test('returns null for empty list', () => {
    expect(pickDefaultSelectedSprint([])).toBeNull();
  });

  // Picks the sprint whose date range contains “today” when multiple exist.
  test('returns calendar-active sprint when one exists', () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    const active = { id: 10, startDate: start.toISOString(), dueDate: end.toISOString() };
    const planned = { id: 11, startDate: '2099-01-01', dueDate: '2099-01-31' };
    expect(pickDefaultSelectedSprint([planned, active])?.id).toBe(10);
  });
});
