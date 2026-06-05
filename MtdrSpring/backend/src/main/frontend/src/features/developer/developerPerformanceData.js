import { SPRINT_CHART_COLORS } from '../dashboard/dashboardSprintData';
import {
  developerProductivityBreakdown,
  efficiencyScoreFromDeveloperHours,
} from '../kpis/productivityScoreUtils';
import { collectDeveloperNamesForSelection } from '../../utils/teamRosterUtils';
import { developerNumericId } from '../../utils/userIds';
import { findDeveloperInSprint } from './developerTaskFilters';

/** Distinct line colors for team comparison (current user uses highlightColor). */
const DEV_COMPARE_LINE_COLORS = [
  '#1565C0',
  '#FB8C00',
  '#26A69A',
  '#8E24AA',
  '#00897B',
  '#3949AB',
  '#00ACC1',
  '#43A047',
  '#F57C00',
  '#5E35B1',
  '#0277BD',
  '#C2185B',
];

function seriesDataKey(userId, name) {
  const uid = Number(userId);
  if (Number.isFinite(uid)) return `score_u_${uid}`;
  const slug = String(name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `score_n_${slug || 'unknown'}`;
}

function resolveUserIdForName(projectDevelopers, fullName) {
  const key = String(fullName || '')
    .trim()
    .toLowerCase();
  if (!key) return null;
  const fromRoster = (projectDevelopers || []).find(
    (u) =>
      String(u?.name ?? u?.NAME ?? '')
        .trim()
        .toLowerCase() === key,
  );
  if (fromRoster) return developerNumericId(fromRoster);
  return null;
}

function isCurrentDeveloper(userId, userName, devUserId, devName) {
  const uid = Number(userId);
  if (Number.isFinite(uid) && Number.isFinite(Number(devUserId)) && uid === Number(devUserId)) {
    return true;
  }
  if (userName && devName && String(userName).trim() === String(devName).trim()) {
    return true;
  }
  return false;
}

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
  const efficiencyScore = efficiencyScoreFromDeveloperHours(hours, estimated);
  const breakdown = developerProductivityBreakdown({
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
    efficiencyScore,
    /** @deprecated Use efficiencyScore — kept for chart payloads that still read .participation */
    participation: efficiencyScore,
    tasksPerHour,
    productivityScore: breakdown.score,
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
  const onTime = onTimeCompletedBase > 0 ? Math.round(onTimeWeighted / onTimeCompletedBase) : null;
  const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  const hoursVsEstimatePct =
    estimated > 0 ? Math.round((hours / estimated) * 100) : hours > 0 ? 100 : 0;
  const tasksPerHour =
    hours > 0 ? Number((completed / hours).toFixed(2)) : completed > 0 ? completed : 0;
  const avgWorkload = perSprint.length
    ? Math.round(perSprint.reduce((s, r) => s + (r.workload || 0), 0) / perSprint.length)
    : 0;
  const productivityScore = developerProductivityBreakdown({
    assigned,
    completed,
    hours,
    assignedHoursEstimate: estimated,
    onTime,
    workload: avgWorkload,
  }).score;

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
        efficiencyScore: m.efficiencyScore,
        workload: m.workload,
        estimated: m.estimated,
        color: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
      };
    })
    .filter((row) => row.assigned > 0 || row.hours > 0);
}

/**
 * Productivity score trend with one line per project developer (for comparison on My Performance).
 * @returns {{ chartData: object[], series: { dataKey: string, name: string, color: string, isCurrentUser: boolean }[] }}
 */
export function buildProductivityScoreComparisonTrend(
  sprints,
  projectDevelopers = [],
  userId,
  userName,
  { highlightColor = '#C74634' } = {},
) {
  const sorted = [...(sprints || [])].sort(compareSprintsChronologically);
  const names = collectDeveloperNamesForSelection(sorted, projectDevelopers);

  const seriesMeta = names.map((fullName, idx) => {
    let devUserId = resolveUserIdForName(projectDevelopers, fullName);
    if (devUserId == null) {
      for (const sp of sorted) {
        const d = (sp.developers || []).find((x) => String(x?.name) === String(fullName));
        if (d?.userId != null) {
          devUserId = Number(d.userId);
          break;
        }
      }
    }
    const isCurrentUser = isCurrentDeveloper(userId, userName, devUserId, fullName);
    return {
      fullName,
      userId: devUserId,
      dataKey: seriesDataKey(devUserId, fullName),
      name: fullName,
      isCurrentUser,
      color: isCurrentUser
        ? highlightColor
        : DEV_COMPARE_LINE_COLORS[idx % DEV_COMPARE_LINE_COLORS.length],
    };
  });

  seriesMeta.sort((a, b) => {
    if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });
  });

  const chartData = sorted
    .map((sp, idx) => {
      const row = {
        name: sp.shortLabel || `Sprint ${sp?.id}`,
        sprintId: sp?.id,
        color: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
        _meta: {},
      };
      let sprintHasActivity = false;

      seriesMeta.forEach((meta) => {
        const m = sprintMetricsForDeveloper(sp, meta.userId, meta.fullName);
        const active = m.assigned > 0 || m.hours > 0;
        if (active) sprintHasActivity = true;
        row[meta.dataKey] = active ? m.productivityScore : null;
        row._meta[meta.dataKey] = active
          ? {
              assigned: m.assigned,
              completed: m.completed,
              hours: m.hours,
              completionRate: m.completionRate,
              onTime: m.onTime,
              efficiencyScore: m.efficiencyScore,
              workload: m.workload,
              estimated: m.estimated,
            }
          : null;
      });

      return sprintHasActivity ? row : null;
    })
    .filter(Boolean);

  const series = seriesMeta.map(({ dataKey, name, color, isCurrentUser }) => ({
    dataKey,
    name,
    color,
    isCurrentUser,
  }));

  return { chartData, series };
}
