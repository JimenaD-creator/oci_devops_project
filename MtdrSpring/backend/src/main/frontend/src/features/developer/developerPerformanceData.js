import { SPRINT_CHART_COLORS } from '../dashboard/dashboardSprintData';
import { productivityScoreFromDeveloperMetrics } from '../kpis/productivityScoreUtils';
import { findDeveloperInSprint } from './developerTaskFilters';

function compareSprintsChronologically(a, b) {
  const ta = new Date(a?.startDate ?? 0).getTime();
  const tb = new Date(b?.startDate ?? 0).getTime();
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return Number(a?.id) - Number(b?.id);
}

export function sprintMetricsForDeveloper(sprint, userId, userName) {
  const dev = findDeveloperInSprint(sprint, userId, userName);
  const assigned = Number(dev?.assigned) || 0;
  const completed = Number(dev?.completed) || 0;
  const hours = Number(dev?.hours) || 0;
  const estimated = Number(dev?.assignedHoursEstimate) || 0;
  const onTime = typeof dev?.onTime === 'number' ? dev.onTime : null;
  const workload = typeof dev?.workload === 'number' ? dev.workload : 0;
  const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const hoursVsEstimatePct =
    estimated > 0 ? Math.round((hours / estimated) * 100) : hours > 0 ? 100 : 0;
  const tasksPerHour =
    hours > 0 ? Number((completed / hours).toFixed(2)) : completed > 0 ? completed : 0;
  const productivityScore = productivityScoreFromDeveloperMetrics({
    assigned,
    completed,
    hours,
    assignedHoursEstimate: estimated,
    onTime,
    workload,
  });

  return {
    sprintId: sprint?.id,
    shortLabel: sprint?.shortLabel || `Sprint ${sprint?.id}`,
    accentColor: sprint?.accentColor,
    assigned,
    completed,
    hours,
    estimated,
    onTime,
    workload,
    completionRate,
    hoursVsEstimatePct,
    tasksPerHour,
    productivityScore,
  };
}

export function aggregateDeveloperPerformance(sprints, userId, userName) {
  const perSprint = (sprints || []).map((sp) => sprintMetricsForDeveloper(sp, userId, userName));
  const assigned = perSprint.reduce((s, r) => s + r.assigned, 0);
  const completed = perSprint.reduce((s, r) => s + r.completed, 0);
  const hours = perSprint.reduce((s, r) => s + r.hours, 0);
  const estimated = perSprint.reduce((s, r) => s + r.estimated, 0);
  let onTimeWeighted = 0;
  let onTimeCompletedBase = 0;
  perSprint.forEach((r) => {
    if (typeof r.onTime === 'number' && r.completed > 0) {
      onTimeWeighted += r.onTime * r.completed;
      onTimeCompletedBase += r.completed;
    }
  });
  const onTime =
    onTimeCompletedBase > 0 ? Math.round(onTimeWeighted / onTimeCompletedBase) : null;
  const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const hoursVsEstimatePct =
    estimated > 0 ? Math.round((hours / estimated) * 100) : hours > 0 ? 100 : 0;
  const tasksPerHour =
    hours > 0 ? Number((completed / hours).toFixed(2)) : completed > 0 ? completed : 0;
  const productivityScore = productivityScoreFromDeveloperMetrics({
    assigned,
    completed,
    hours,
    assignedHoursEstimate: estimated,
    onTime,
    workload: perSprint.length
      ? Math.round(perSprint.reduce((s, r) => s + (r.workload || 0), 0) / perSprint.length)
      : 0,
  });

  return {
    perSprint,
    assigned,
    completed,
    hours,
    estimated,
    onTime,
    completionRate,
    hoursVsEstimatePct,
    tasksPerHour,
    productivityScore,
  };
}

export function buildCompletedTasksBySprintChart(sprints, userId, userName) {
  return (sprints || []).map((sp, idx) => {
    const m = sprintMetricsForDeveloper(sp, userId, userName);
    return {
      name: m.shortLabel,
      completed: m.completed,
      color: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
    };
  });
}

export function buildHoursWorkedTrendChart(sprints, userId, userName) {
  return (sprints || []).map((sp, idx) => {
    const m = sprintMetricsForDeveloper(sp, userId, userName);
    return {
      name: m.shortLabel,
      hours: Number(m.hours.toFixed(1)),
      color: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
    };
  });
}

/** Chronological productivity score (%) per sprint for the signed-in developer. */
export function buildProductivityScoreTrendChart(sprints, userId, userName) {
  return [...(sprints || [])]
    .sort(compareSprintsChronologically)
    .map((sp, idx) => {
      const m = sprintMetricsForDeveloper(sp, userId, userName);
      return {
        name: m.shortLabel,
        productivityScore: m.productivityScore,
        assigned: m.assigned,
        completed: m.completed,
        hours: m.hours,
        completionRate: m.completionRate,
        onTime: m.onTime,
        workload: m.workload,
        color: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
      };
    })
    .filter((row) => row.assigned > 0 || row.hours > 0);
}
