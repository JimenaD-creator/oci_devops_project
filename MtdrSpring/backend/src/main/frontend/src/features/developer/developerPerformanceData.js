import { SPRINT_CHART_COLORS } from '../dashboard/dashboardSprintData';
import { findDeveloperInSprint } from './developerTaskFilters';

export function sprintMetricsForDeveloper(sprint, userId, userName) {
  const dev = findDeveloperInSprint(sprint, userId, userName);
  const assigned = Number(dev?.assigned) || 0;
  const completed = Number(dev?.completed) || 0;
  const hours = Number(dev?.hours) || 0;
  const estimated = Number(dev?.assignedHoursEstimate) || 0;
  const onTime = typeof dev?.onTime === 'number' ? dev.onTime : null;
  const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const hoursVsEstimatePct =
    estimated > 0 ? Math.round((hours / estimated) * 100) : hours > 0 ? 100 : 0;
  const tasksPerHour =
    hours > 0 ? Number((completed / hours).toFixed(2)) : completed > 0 ? completed : 0;

  return {
    sprintId: sprint?.id,
    shortLabel: sprint?.shortLabel || `Sprint ${sprint?.id}`,
    accentColor: sprint?.accentColor,
    assigned,
    completed,
    hours,
    estimated,
    onTime,
    completionRate,
    hoursVsEstimatePct,
    tasksPerHour,
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
