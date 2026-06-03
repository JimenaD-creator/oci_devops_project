import { describe, expect, it } from 'vitest';
import {
  buildSprintVsAllPriorComparison,
  buildSprintVsPreviousComparison,
  findAllPreviousSprints,
  findPreviousSprint,
  formatPercentPointDelta,
  sortSprintsChronologically,
} from './sprintComparisonUtils';

describe('sprintComparisonUtils', () => {
  const sprint = (id, dueDate, kpis = {}) => ({
    id,
    dueDate,
    startDate: dueDate,
    kpis: {
      completionRate: 50,
      onTimeDelivery: 80,
      teamParticipation: 60,
      workloadBalance: 70,
      ...kpis,
    },
    totalTasks: 10,
    totalCompleted: 5,
    blockedTasksTotal: 1,
  });

  it('sortSprintsChronologically orders by due date', () => {
    const sorted = sortSprintsChronologically([sprint(2, '2026-06-01'), sprint(1, '2026-05-01')]);
    expect(sorted.map((s) => s.id)).toEqual([1, 2]);
  });

  it('findPreviousSprint returns prior chronological sprint', () => {
    const sorted = sortSprintsChronologically([sprint(1, '2026-05-01'), sprint(2, '2026-06-01')]);
    expect(findPreviousSprint(sorted, 2)?.id).toBe(1);
    expect(findPreviousSprint(sorted, 1)).toBeNull();
  });

  it('buildSprintVsAllPriorComparison includes every prior sprint column', () => {
    const s1 = sprint(1, '2026-04-01', { completionRate: 40 });
    const s2 = sprint(2, '2026-05-01', { completionRate: 50 });
    const s3 = sprint(3, '2026-06-01', { completionRate: 60 });
    const ordered = sortSprintsChronologically([s1, s2, s3]);
    const out = buildSprintVsAllPriorComparison({
      currentSprint: s3,
      sortedSprints: ordered,
      currentLabel: 'Sprint 3',
      labelForSprintId: (id) => `Sprint ${id}`,
    });
    expect(out.hasPrior).toBe(true);
    expect(out.priorColumns).toHaveLength(2);
    expect(out.priorColumns.map((c) => c.label)).toEqual(['Sprint 1', 'Sprint 2']);
    const cr = out.rows.find((r) => r.key === 'completionRate');
    expect(cr.priorValues).toEqual([40, 50]);
    expect(cr.current).toBe(60);
    expect(cr.delta).toBe(10);
  });

  it('findAllPreviousSprints returns all chronological priors', () => {
    const ordered = sortSprintsChronologically([
      sprint(1, '2026-04-01'),
      sprint(2, '2026-05-01'),
      sprint(3, '2026-06-01'),
    ]);
    expect(findAllPreviousSprints(ordered, 3).map((s) => s.id)).toEqual([1, 2]);
  });

  it('buildSprintVsPreviousComparison uses single prior column only', () => {
    const prev = sprint(1, '2026-05-01', { onTimeDelivery: 60, completionRate: 40 });
    const cur = sprint(2, '2026-06-01', { onTimeDelivery: 80, completionRate: 50 });
    const out = buildSprintVsPreviousComparison({
      currentSprint: cur,
      previousSprint: prev,
      currentLabel: 'Sprint 2',
      previousLabel: 'Sprint 1',
    });
    expect(out.hasPrevious).toBe(true);
    expect(out.priorColumns).toHaveLength(1);
    expect(out.priorColumns[0].label).toBe('Sprint 1');
    const otd = out.rows.find((r) => r.key === 'onTimeDelivery');
    expect(otd.previous).toBe(60);
    expect(otd.current).toBe(80);
    expect(otd.delta).toBe(20);
    expect(otd.deltaLabel).toBe('+20');
    expect(otd.tone).toBe('up');
  });

  it('formatPercentPointDelta handles zero and negative', () => {
    expect(formatPercentPointDelta(0)).toBe('0');
    expect(formatPercentPointDelta(-15)).toBe('-15');
  });
});
