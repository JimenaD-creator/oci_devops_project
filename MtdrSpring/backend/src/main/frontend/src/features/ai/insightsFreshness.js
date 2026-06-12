import {
  normalizeEfficiencyPercent,
  resolveSprintProductivityScore,
} from '../kpis/productivityScoreUtils';

/** KPI keys stored in generationKpiSnapshot.kpis (matches backend live KPI map). */
export const INSIGHTS_KPI_SNAPSHOT_KEYS = [
  'completionRate',
  'onTimeDelivery',
  'efficiencyScore',
  'workloadBalance',
  'productivityScore',
];

export const INSIGHTS_KPI_LABELS = {
  completionRate: 'Completion rate',
  onTimeDelivery: 'On-time delivery',
  efficiencyScore: 'Efficiency score',
  workloadBalance: 'Workload balance',
  productivityScore: 'Productivity score',
  'taskStatusBreakdown.total': 'Total tasks',
  'taskStatusBreakdown.done': 'Completed tasks',
  'taskStatusBreakdown.toDo': 'To do tasks',
  'taskStatusBreakdown.inProgress': 'In progress tasks',
  'taskStatusBreakdown.inReview': 'In review tasks',
};

const TASK_BREAKDOWN_KEYS = ['total', 'done', 'toDo', 'inProgress', 'inReview'];

function roundKpi(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function normalizeLiveMetricsForSnapshotCompare(metrics = {}) {
  if (!metrics || typeof metrics !== 'object') return {};
  return {
    completionRate: roundKpi(metrics.completionRate),
    onTimeDelivery: roundKpi(metrics.onTimeDelivery),
    efficiencyScore: roundKpi(
      normalizeEfficiencyPercent(metrics.efficiencyScore ?? metrics.teamParticipation),
    ),
    workloadBalance: roundKpi(metrics.workloadBalance),
    productivityScore: roundKpi(resolveSprintProductivityScore(metrics)),
  };
}

export function taskBreakdownFromSprint(sprint) {
  if (!sprint) return null;
  if (Array.isArray(sprint.taskStatusDistribution)) {
    const byKey = Object.fromEntries(
      sprint.taskStatusDistribution.map((row) => [row.key, Number(row.count) || 0]),
    );
    const toDo = byKey.TODO ?? 0;
    const inProgress = byKey.IN_PROGRESS ?? 0;
    const inReview = byKey.IN_REVIEW ?? 0;
    const done = byKey.DONE ?? 0;
    const total =
      Number(sprint.taskStatusTotal) ||
      Number(sprint.totalTasks) ||
      toDo + inProgress + inReview + done;
    return { toDo, inProgress, inReview, done, total };
  }
  return {
    total: Number(sprint.totalTasks) || 0,
    done: Number(sprint.totalCompleted) || 0,
    toDo: null,
    inProgress: null,
    inReview: null,
  };
}

function compareTaskBreakdown(snapshotBreakdown, liveBreakdown) {
  const changed = [];
  if (!snapshotBreakdown || !liveBreakdown) return changed;
  TASK_BREAKDOWN_KEYS.forEach((key) => {
    const expected = Number(snapshotBreakdown[key]);
    const actual = Number(liveBreakdown[key]);
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) return;
    if (expected !== actual) {
      changed.push(`taskStatusBreakdown.${key}`);
    }
  });
  return changed;
}

/**
 * Compare persisted generation snapshot vs live sprint KPIs / task counts.
 * @returns {{ changed: boolean, metrics: string[], labels: string[] }}
 */
export function detectInsightsKpiDrift(generationKpiSnapshot, liveMetrics, liveTaskBreakdown) {
  if (!generationKpiSnapshot?.kpis) {
    return { changed: false, metrics: [], labels: [] };
  }
  const snapshotKpis = generationKpiSnapshot.kpis;
  const live = normalizeLiveMetricsForSnapshotCompare(liveMetrics);
  const metrics = [];

  INSIGHTS_KPI_SNAPSHOT_KEYS.forEach((key) => {
    const expected = roundKpi(snapshotKpis[key]);
    const actual = live[key];
    if (expected == null || actual == null) return;
    if (expected !== actual) {
      metrics.push(key);
    }
  });

  metrics.push(...compareTaskBreakdown(generationKpiSnapshot.taskStatusBreakdown, liveTaskBreakdown));

  const labels = metrics.map((key) => INSIGHTS_KPI_LABELS[key] || key);
  return { changed: metrics.length > 0, metrics, labels };
}

export function formatChangedKpiMetricsList(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}
