/**
 * Requirement: Real-time task assignment filtering by developer.
 * Topics: Dynamic test data, pure function testing, edge cases.
 */
import {
  matchesDueDateRange,
  matchesStatusFilter,
  itemMatchesDeveloperFilter,
  normalizeDeveloperValue,
} from './taskFilters';

// matchesStatusFilter

describe('matchesStatusFilter', () => {
  const cases = [
    { filter: 'all',         item: { done: false, status: 'todo' },        expected: true },
    { filter: 'completed',   item: { done: true,  status: 'done' },        expected: true },
    { filter: 'completed',   item: { done: false, status: 'todo' },        expected: false },
    { filter: 'pending',     item: { done: false, inProgress: false },     expected: true },
    { filter: 'in_progress', item: { done: false, status: 'in_progress' }, expected: true },
    { filter: 'in_progress', item: { done: false, status: 'todo' },        expected: false },
  ];

  // DYNAMIC test data: generate one it() per case
  test.each(cases)(
    'filter=$filter, item.done=$item.done → $expected',
    ({ filter, item, expected }) => {
      expect(matchesStatusFilter(item, filter)).toBe(expected);
    },
  );
});

// matchesDueDateRange (extended)

describe('matchesDueDateRange (dynamic date boundaries)', () => {
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

  test('swapped bounds are auto-corrected', () => {
    expect(matchesDueDateRange({ dueDate: '2026-04-10' }, '2026-04-15', '2026-04-01')).toBe(true);
  });

  test('task with no dueDate is excluded when a bound is set', () => {
    expect(matchesDueDateRange({ dueDate: null }, '2026-04-01', '')).toBe(false);
  });
});

// normalizeDeveloperValue 

describe('normalizeDeveloperValue', () => {
  test('returns null for empty input', () => {
    expect(normalizeDeveloperValue('')).toBeNull();
    expect(normalizeDeveloperValue(null)).toBeNull();
  });

  test('passes through unknown strings unchanged', () => {
    expect(normalizeDeveloperValue('unknown_dev_99')).toBe('unknown_dev_99');
  });
});

// itemMatchesDeveloperFilter 

describe('itemMatchesDeveloperFilter', () => {
  test('all filter always returns true', () => {
    expect(itemMatchesDeveloperFilter({ developer: 'dev1' }, 'all', 'unassigned')).toBe(true);
  });

  test('unassigned sentinel matches items with no developer', () => {
    expect(itemMatchesDeveloperFilter({ developer: null }, 'unassigned', 'unassigned')).toBe(true);
    expect(itemMatchesDeveloperFilter({ developer: 'dev1' }, 'unassigned', 'unassigned')).toBe(false);
  });
});