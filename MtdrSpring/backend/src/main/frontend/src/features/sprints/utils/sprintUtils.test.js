/**
 * Topics: Testing custom hooks (pure logic), Dynamic test data, Edge cases.
 */
import {
  inferSprintStatus,
  inferStatusByDate,
  sortTasksForSprintTable,
  pickDefaultSelectedSprint,
} from './sprintUtils';

// inferStatusByDate 

describe('inferStatusByDate', () => {
  function sprint(start, due) {
    return { startDate: start, dueDate: due };
  }

  test('future sprint → planned', () => {
    expect(inferStatusByDate(sprint('2099-01-01', '2099-01-31'))).toBe('planned');
  });

  test('past sprint → completed', () => {
    expect(inferStatusByDate(sprint('2000-01-01', '2000-01-31'))).toBe('completed');
  });

  test('current sprint → active', () => {
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 1);
    const end   = new Date(now); end.setDate(end.getDate() + 1);
    expect(inferStatusByDate(sprint(start.toISOString(), end.toISOString()))).toBe('active');
  });
});

// inferSprintStatus 

describe('inferSprintStatus (DYNAMIC test data)', () => {
  const pastSprint = { id: 1, startDate: '2000-01-01', dueDate: '2000-01-31' };
  const futureSprint = { id: 2, startDate: '2099-01-01', dueDate: '2099-01-31' };

  const cases = [
    { sprint: pastSprint, tasks: [],                                                                                   expected: 'active',    desc: 'past sprint, no tasks → active' },
    { sprint: pastSprint, tasks: [{ assignedSprint: { id: 1 }, status: 'DONE' }],                                     expected: 'completed', desc: 'past sprint, all DONE → completed' },
    { sprint: pastSprint, tasks: [{ assignedSprint: { id: 1 }, status: 'IN_PROGRESS' }],                              expected: 'pending',   desc: 'past sprint, not all done → pending' },
    { sprint: futureSprint, tasks: [],                                                                                 expected: 'planned',   desc: 'future sprint, no tasks → planned' },
    { sprint: futureSprint, tasks: [{ assignedSprint: { id: 2 }, status: 'TODO' }],                                   expected: 'planned',   desc: 'future sprint, none done → planned' },
    { sprint: futureSprint, tasks: [{ assignedSprint: { id: 2 }, status: 'DONE' }, { assignedSprint: { id: 2 }, status: 'DONE' }], expected: 'completed', desc: 'future sprint, all DONE → completed' },
  ];

  test.each(cases)('$desc', ({ sprint, tasks, expected }) => {
    expect(inferSprintStatus(sprint, tasks)).toBe(expected);
  });
});

// sortTasksForSprintTable

describe('sortTasksForSprintTable', () => {
  test('sorts by due date soonest first', () => {
    const tasks = [
      { id: 2, dueDate: '2026-05-01', priority: 'LOW' },
      { id: 1, dueDate: '2026-04-01', priority: 'LOW' },
    ];
    const result = sortTasksForSprintTable(tasks);
    expect(result[0].id).toBe(1);
  });

  test('same due date: CRITICAL before LOW', () => {
    const tasks = [
      { id: 1, dueDate: '2026-04-10', priority: 'LOW' },
      { id: 2, dueDate: '2026-04-10', priority: 'CRITICAL' },
    ];
    const result = sortTasksForSprintTable(tasks);
    expect(result[0].id).toBe(2);
  });

  test('handles empty array', () => {
    expect(sortTasksForSprintTable([])).toEqual([]);
  });
});

// pickDefaultSelectedSprint

describe('pickDefaultSelectedSprint', () => {
  test('returns null for empty list', () => {
    expect(pickDefaultSelectedSprint([])).toBeNull();
  });

  test('returns the calendar-active sprint when one exists', () => {
    const now = new Date();
    const start = new Date(now); start.setDate(start.getDate() - 1);
    const end   = new Date(now); end.setDate(end.getDate() + 1);
    const active = { id: 10, startDate: start.toISOString(), dueDate: end.toISOString() };
    const planned = { id: 11, startDate: '2099-01-01', dueDate: '2099-01-31' };
    expect(pickDefaultSelectedSprint([planned, active])?.id).toBe(10);
  });
});