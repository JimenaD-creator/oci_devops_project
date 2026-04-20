/**
 * Supporting — pure helpers for task list filters (used by task views).
 * Module under test: taskFilters.js.
 */
import {
  matchesDueDateRange,
  matchesStatusFilter,
  itemMatchesDeveloperFilter,
  normalizeDeveloperValue,
} from './taskFilters';

// Matrix: each case checks whether a task row matches the selected status filter.
describe('matchesStatusFilter', () => {
  const cases = [
    { filter: 'all', item: { done: false, status: 'todo' }, expected: true },
    { filter: 'completed', item: { done: true, status: 'done' }, expected: true },
    { filter: 'completed', item: { done: false, status: 'todo' }, expected: false },
    { filter: 'pending', item: { done: false, inProgress: false }, expected: true },
    { filter: 'in_progress', item: { done: false, status: 'in_progress' }, expected: true },
    { filter: 'in_progress', item: { done: false, status: 'todo' }, expected: false },
  ];

  test.each(cases)(
    'filter=$filter, item.done=$item.done → $expected',
    ({ filter, item, expected }) => {
      expect(matchesStatusFilter(item, filter)).toBe(expected);
    },
  );
});

describe('matchesDueDateRange', () => {
  // No from/to dates: any task with a due date passes.
  test('no bounds: always matches', () => {
    expect(matchesDueDateRange({ dueDate: '2026-01-15' }, '', '')).toBe(true);
  });

  test('task within window', () => {
    expect(matchesDueDateRange({ dueDate: '2026-04-10' }, '2026-04-01', '2026-04-15')).toBe(true);
  });

  test('task before window start', () => {
    expect(matchesDueDateRange({ dueDate: '2026-03-31' }, '2026-04-01', '2026-04-15')).toBe(false);
  });

  test('task after window end', () => {
    expect(matchesDueDateRange({ dueDate: '2026-04-16' }, '2026-04-01', '2026-04-15')).toBe(false);
  });

  // If the user enters end before start, the helper normalizes bounds.
  test('swapped bounds are auto-corrected', () => {
    expect(matchesDueDateRange({ dueDate: '2026-04-10' }, '2026-04-15', '2026-04-01')).toBe(true);
  });

  test('no dueDate with a bound set: no match', () => {
    expect(matchesDueDateRange({ dueDate: null }, '2026-04-01', '')).toBe(false);
  });
});

describe('normalizeDeveloperValue', () => {
  test('empty input → null', () => {
    expect(normalizeDeveloperValue('')).toBeNull();
    expect(normalizeDeveloperValue(null)).toBeNull();
  });

  test('unknown strings pass through', () => {
    expect(normalizeDeveloperValue('unknown_dev_99')).toBe('unknown_dev_99');
  });
});

describe('itemMatchesDeveloperFilter', () => {
  test('all filter always returns true', () => {
    expect(itemMatchesDeveloperFilter({ developer: 'dev1' }, 'all', 'unassigned')).toBe(true);
  });

  test('unassigned sentinel matches items with no developer', () => {
    expect(itemMatchesDeveloperFilter({ developer: null }, 'unassigned', 'unassigned')).toBe(true);
    expect(itemMatchesDeveloperFilter({ developer: 'dev1' }, 'unassigned', 'unassigned')).toBe(
      false,
    );
  });
});
