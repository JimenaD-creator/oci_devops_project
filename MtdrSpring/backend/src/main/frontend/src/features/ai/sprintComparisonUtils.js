import {
  normalizeKpiComponentPercent,
  normalizeWorkloadBalancePercent,
  productivityScoreFromSprintKpis,
} from '../kpis/productivityScoreUtils';
import { KPI_LABELS } from './aiInsightsConstants';

/** KPI rows shown in the vs-previous-sprint table (deterministic facts). */
export const SPRINT_COMPARISON_KPI_KEYS = [
  'completionRate',
  'onTimeDelivery',
  'teamParticipation',
  'workloadBalance',
  'productivityScore',
];

export function sortSprintsChronologically(sprints) {
  if (!Array.isArray(sprints) || sprints.length === 0) return [];
  return [...sprints].sort((a, b) => {
    const endA = new Date(a.dueDate ?? 0).getTime();
    const endB = new Date(b.dueDate ?? 0).getTime();
    if (endA !== endB) return endA - endB;
    const startA = new Date(a.startDate ?? 0).getTime();
    const startB = new Date(b.startDate ?? 0).getTime();
    if (startA !== startB) return startA - startB;
    return Number(a.id) - Number(b.id);
  });
}

export function findPreviousSprint(sortedSprints, currentSprintId) {
  const all = findAllPreviousSprints(sortedSprints, currentSprintId);
  return all.length > 0 ? all[all.length - 1] : null;
}

/** All sprints chronologically before the current one (oldest first). */
export function findAllPreviousSprints(sortedSprints, currentSprintId) {
  if (!sortedSprints?.length || currentSprintId == null) return [];
  const idx = sortedSprints.findIndex((s) => Number(s.id) === Number(currentSprintId));
  if (idx <= 0) return [];
  return sortedSprints.slice(0, idx);
}

export function extractSprintMetricBundle(sprint) {
  if (!sprint) {
    return {
      completionRate: 0,
      onTimeDelivery: 0,
      teamParticipation: 0,
      workloadBalance: 0,
      productivityScore: 0,
      tasksDone: 0,
      totalTasks: 0,
      blockedCount: 0,
    };
  }
  const kpis = sprint.kpis ?? {};
  const totalTasks = Number(sprint.totalTasks);
  const totalCompleted = Number(sprint.totalCompleted);
  let blockedCount = Number(sprint.blockedTasksTotal);
  if (!Number.isFinite(blockedCount) || blockedCount < 0) {
    blockedCount = Array.isArray(sprint.blockedDevelopers)
      ? sprint.blockedDevelopers.reduce((sum, d) => sum + (Number(d?.blockedCount) || 0), 0)
      : 0;
  }
  return {
    completionRate: normalizeKpiComponentPercent(kpis.completionRate),
    onTimeDelivery: normalizeKpiComponentPercent(kpis.onTimeDelivery),
    teamParticipation: normalizeKpiComponentPercent(kpis.teamParticipation),
    workloadBalance: normalizeWorkloadBalancePercent(kpis.workloadBalance),
    productivityScore: productivityScoreFromSprintKpis(kpis),
    tasksDone: Number.isFinite(totalCompleted) ? totalCompleted : 0,
    totalTasks: Number.isFinite(totalTasks) ? totalTasks : 0,
    blockedCount: Math.max(0, blockedCount),
  };
}

/**
 * @returns {'up'|'down'|'neutral'}
 */
export function deltaTone(delta) {
  if (!Number.isFinite(delta) || delta === 0) return 'neutral';
  return delta > 0 ? 'up' : 'down';
}

/** Display delta for 0–100 metrics (percentage points). */
export function formatPercentPointDelta(delta) {
  if (!Number.isFinite(delta)) return '—';
  if (delta === 0) return '0';
  const n = Math.round(delta);
  return n > 0 ? `+${n}` : `${n}`;
}

export function formatCountDelta(delta) {
  if (!Number.isFinite(delta)) return '—';
  if (delta === 0) return '0';
  const n = Math.round(delta);
  return n > 0 ? `+${n}` : `${n}`;
}

function buildMetricRow(key, label, previous, current) {
  const delta = current - previous;
  return {
    key,
    label,
    previous,
    current,
    delta,
    deltaLabel: formatPercentPointDelta(delta),
    tone: deltaTone(delta),
    isPercent: true,
  };
}

function buildMultiPriorMetricRow(key, label, priorBundles, currentBundle) {
  const priorValues = priorBundles.map((p) => p[key]);
  const current = currentBundle[key];
  const lastPrior = priorValues.length > 0 ? priorValues[priorValues.length - 1] : null;
  const deltaVsLastPrior = lastPrior != null ? current - lastPrior : null;
  return {
    key,
    label,
    priorValues,
    previous: lastPrior,
    current,
    delta: deltaVsLastPrior,
    deltaLabel:
      deltaVsLastPrior == null ? '—' : formatPercentPointDelta(deltaVsLastPrior),
    tone: deltaVsLastPrior == null ? 'neutral' : deltaTone(deltaVsLastPrior),
    isPercent: true,
  };
}

/**
 * Compare current sprint KPIs against every prior sprint (chronological columns + delta vs last prior).
 * @param {{ currentSprint: object, sortedSprints: object[], currentLabel: string, labelForSprintId: (id: number) => string }} params
 */
export function buildSprintVsAllPriorComparison({
  currentSprint,
  sortedSprints,
  currentLabel,
  labelForSprintId,
}) {
  if (!currentSprint) {
    return {
      hasPrior: false,
      hasPrevious: false,
      currentLabel,
      priorColumns: [],
      previousLabel: null,
      rows: [],
      extras: [],
    };
  }
  const ordered = sortSprintsChronologically(sortedSprints ?? []);
  const priorSprints = findAllPreviousSprints(ordered, currentSprint.id);
  const priorColumns = priorSprints.map((s) => ({
    sprintId: s.id,
    label: labelForSprintId(s.id),
    metrics: extractSprintMetricBundle(s),
  }));
  const priorBundles = priorColumns.map((c) => c.metrics);
  const current = extractSprintMetricBundle(currentSprint);
  const hasPrior = priorColumns.length > 0;
  const lastPriorBundle = hasPrior ? priorBundles[priorBundles.length - 1] : null;
  const previousLabel = hasPrior ? priorColumns[priorColumns.length - 1].label : null;

  const rows = SPRINT_COMPARISON_KPI_KEYS.map((key) =>
    buildMultiPriorMetricRow(key, KPI_LABELS[key] ?? key, priorBundles, current),
  );

  const extras = [
    (() => {
      const priorValues = priorBundles.map((p) => p.tasksDone);
      const priorDisplays = priorBundles.map(
        (p) => `${p.tasksDone}${p.totalTasks > 0 ? ` / ${p.totalTasks}` : ''}`,
      );
      const currentDisplay = `${current.tasksDone}${current.totalTasks > 0 ? ` / ${current.totalTasks}` : ''}`;
      const lastPrior = lastPriorBundle?.tasksDone ?? null;
      const delta = lastPrior != null ? current.tasksDone - lastPrior : null;
      return {
        key: 'tasksDone',
        label: 'Tasks done',
        priorValues,
        priorDisplays,
        previous: lastPrior,
        previousDisplay: priorDisplays.length ? priorDisplays[priorDisplays.length - 1] : null,
        current: current.tasksDone,
        currentDisplay,
        delta,
        deltaLabel: formatCountDelta(delta),
        tone: deltaTone(delta),
        isPercent: false,
      };
    })(),
    (() => {
      const priorValues = priorBundles.map((p) => p.blockedCount);
      const lastPrior = lastPriorBundle?.blockedCount ?? null;
      const delta = lastPrior != null ? current.blockedCount - lastPrior : null;
      return {
        key: 'blockedCount',
        label: 'Blocked assignments',
        priorValues,
        previous: lastPrior,
        current: current.blockedCount,
        delta,
        deltaLabel: formatCountDelta(delta),
        tone: deltaTone(delta === 0 ? 0 : -delta),
        isPercent: false,
      };
    })(),
  ];

  return {
    hasPrior,
    hasPrevious: hasPrior,
    currentLabel,
    priorColumns,
    previousLabel,
    priorCount: priorColumns.length,
    current,
    previous: lastPriorBundle,
    rows,
    extras,
  };
}

/**
 * @param {{ currentSprint: object, previousSprint?: object|null, currentLabel: string, previousLabel?: string|null, sortedSprints?: object[], labelForSprintId?: (id: number) => string }} params
 */
export function buildSprintVsPreviousComparison({
  currentSprint,
  previousSprint,
  currentLabel,
  previousLabel,
  sortedSprints,
  labelForSprintId,
}) {
  const labelFn =
    labelForSprintId ??
    ((id) => {
      if (Number(id) === Number(currentSprint?.id)) return currentLabel ?? `Sprint ${id}`;
      if (previousLabel && Number(previousSprint?.id) === Number(id)) return previousLabel;
      return `Sprint ${id}`;
    });
  if (Array.isArray(sortedSprints) && sortedSprints.length && currentSprint) {
    return buildSprintVsAllPriorComparison({
      currentSprint,
      sortedSprints: sortSprintsChronologically(sortedSprints),
      currentLabel,
      labelForSprintId: labelFn,
    });
  }
  if (!currentSprint) {
    return {
      hasPrevious: false,
      hasPrior: false,
      currentLabel,
      previousLabel: null,
      priorColumns: [],
      rows: [],
      extras: [],
    };
  }
  const priors = previousSprint ? [previousSprint] : [];
  return buildSprintVsAllPriorComparison({
    currentSprint,
    sortedSprints: sortSprintsChronologically([...priors, currentSprint]),
    currentLabel,
    labelForSprintId: labelFn,
  });
}

/** Strip KPI numbers from team-change prose (table holds metrics). */