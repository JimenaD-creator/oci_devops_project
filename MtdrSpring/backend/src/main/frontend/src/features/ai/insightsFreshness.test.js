import { describe, expect, it } from 'vitest';
import {
  detectInsightsKpiDrift,
  formatChangedKpiMetricsList,
  normalizeLiveMetricsForSnapshotCompare,
} from './insightsFreshness';

describe('insightsFreshness', () => {
  it('detectInsightsKpiDrift flags productivity score changes', () => {
    const snapshot = {
      kpis: {
        completionRate: 100,
        onTimeDelivery: 100,
        efficiencyScore: 80,
        workloadBalance: 70,
        productivityScore: 99,
      },
      taskStatusBreakdown: { total: 10, done: 10, toDo: 0, inProgress: 0, inReview: 0 },
    };
    const live = {
      completionRate: 100,
      onTimeDelivery: 100,
      efficiencyScore: 80,
      workloadBalance: 70,
      productivityScore: 97,
    };
    const liveTasks = { total: 10, done: 10, toDo: 0, inProgress: 0, inReview: 0 };
    const drift = detectInsightsKpiDrift(snapshot, live, liveTasks);
    expect(drift.changed).toBe(true);
    expect(drift.metrics).toContain('productivityScore');
    expect(drift.labels).toContain('Productivity score');
  });

  it('detectInsightsKpiDrift returns unchanged when snapshot matches live data', () => {
    const snapshot = {
      kpis: {
        completionRate: 90,
        onTimeDelivery: 100,
        efficiencyScore: 75,
        workloadBalance: 68,
        productivityScore: 99,
      },
      taskStatusBreakdown: { total: 8, done: 7, toDo: 1, inProgress: 0, inReview: 0 },
    };
    const live = normalizeLiveMetricsForSnapshotCompare({
      completionRate: 90,
      onTimeDelivery: 100,
      teamParticipation: 75,
      workloadBalance: 68,
      productivityScore: 99,
    });
    const liveTasks = { total: 8, done: 7, toDo: 1, inProgress: 0, inReview: 0 };
    const drift = detectInsightsKpiDrift(snapshot, live, liveTasks);
    expect(drift.changed).toBe(false);
  });

  it('formatChangedKpiMetricsList joins labels naturally', () => {
    expect(formatChangedKpiMetricsList(['Productivity score'])).toBe('Productivity score');
    expect(formatChangedKpiMetricsList(['Completion rate', 'Productivity score'])).toBe(
      'Completion rate and Productivity score',
    );
  });
});
