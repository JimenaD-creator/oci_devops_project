/**
 * Dashboard sprint analytics (demo data). Newest sprint first in DASHBOARD_SPRINTS;
 * SPRINTS_FOR_SELECTOR is ordered Sprint 9 → 13 for the UI.
 * Wire to API later by replacing this module’s exports.
 */

export const SPRINT_CHART_COLORS = ['#C74634', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];

/** Fixed palette by id */
export const SPRINT_ACCENT = {
  9: '#8E24AA',
  10: '#C74634',
  11: '#1E88E5',
  12: '#43A047',
  13: '#FB8C00',
};

export function accentForSprintId(id) {
  return SPRINT_ACCENT[id] || SPRINT_CHART_COLORS[Number(id) % SPRINT_CHART_COLORS.length];
}

export const DASHBOARD_SPRINTS = [
  {
    id: 13,
    shortLabel: 'Sprint 13',
    accentColor: '#FB8C00',
    name: 'Sprint 13',
    dateRange: 'Abr 23 – May 7, 2024',
    dateRangeEn: 'April 23 – May 7, 2024',
    status: 'planned',
    totalTasks: 28,
    totalCompleted: 6,
    totalHours: 42.0,
    kpis: {
      completionRate: 22,
      onTimeDelivery: 70,
      teamParticipation: 86,
      workloadBalance: 0.88,
      productivityScore: 58,
    },
    developers: [
      { name: 'Carlos Ruiz', initials: 'CR', assigned: 7, completed: 2, hours: 12.0, workload: 72 },
      { name: 'María García', initials: 'MG', assigned: 8, completed: 2, hours: 11.5, workload: 70 },
      { name: 'Juan Pérez', initials: 'JP', assigned: 5, completed: 1, hours: 6.0, workload: 55 },
      { name: 'Laura Sánchez', initials: 'LS', assigned: 6, completed: 1, hours: 8.5, workload: 62 },
      { name: 'Pedro López', initials: 'PL', assigned: 4, completed: 0, hours: 4.0, workload: 40 },
    ],
  },
  {
    id: 12,
    shortLabel: 'Sprint 12',
    accentColor: '#43A047',
    name: 'Sprint 12',
    dateRange: 'Abr 8 – Abr 22, 2024',
    dateRangeEn: 'April 8-22, 2024',
    status: 'active',
    totalTasks: 32,
    totalCompleted: 25,
    totalHours: 168.0,
    kpis: {
      completionRate: 78,
      onTimeDelivery: 72,
      teamParticipation: 88,
      workloadBalance: 0.92,
      productivityScore: 84,
    },
    developers: [
      { name: 'Carlos Ruiz', initials: 'CR', assigned: 8, completed: 6, hours: 32.5, workload: 80 },
      { name: 'María García', initials: 'MG', assigned: 10, completed: 8, hours: 45.0, workload: 100 },
      { name: 'Juan Pérez', initials: 'JP', assigned: 6, completed: 5, hours: 20.0, workload: 60 },
      { name: 'Laura Sánchez', initials: 'LS', assigned: 7, completed: 6, hours: 31.0, workload: 70 },
      { name: 'Pedro López', initials: 'PL', assigned: 4, completed: 3, hours: 14.0, workload: 48 },
    ],
  },
  {
    id: 11,
    shortLabel: 'Sprint 11',
    accentColor: '#1E88E5',
    name: 'Sprint 11',
    dateRange: 'Mar 25 – Abr 7, 2024',
    dateRangeEn: 'March 25 – April 7, 2024',
    status: 'completed',
    totalTasks: 20,
    totalCompleted: 18,
    totalHours: 118.2,
    kpis: {
      completionRate: 78,
      onTimeDelivery: 68,
      teamParticipation: 85,
      workloadBalance: 0.88,
      productivityScore: 76,
    },
    developers: [
      { name: 'Carlos Ruiz', initials: 'CR', assigned: 7, completed: 5, hours: 28.0, workload: 78 },
      { name: 'María García', initials: 'MG', assigned: 9, completed: 8, hours: 42.5, workload: 98 },
      { name: 'Juan Pérez', initials: 'JP', assigned: 5, completed: 4, hours: 18.5, workload: 58 },
      { name: 'Laura Sánchez', initials: 'LS', assigned: 6, completed: 5, hours: 29.2, workload: 68 },
      { name: 'Pedro López', initials: 'PL', assigned: 3, completed: 2, hours: 11.0, workload: 44 },
    ],
  },
  {
    id: 10,
    shortLabel: 'Sprint 10',
    accentColor: '#C74634',
    name: 'Sprint 10',
    dateRange: 'Mar 11 – Mar 24, 2024',
    dateRangeEn: 'March 11-24, 2024',
    status: 'completed',
    totalTasks: 18,
    totalCompleted: 16,
    totalHours: 102.0,
    kpis: {
      completionRate: 72,
      onTimeDelivery: 65,
      teamParticipation: 82,
      workloadBalance: 0.85,
      productivityScore: 71,
    },
    developers: [
      { name: 'Carlos Ruiz', initials: 'CR', assigned: 6, completed: 5, hours: 26.0, workload: 75 },
      { name: 'María García', initials: 'MG', assigned: 8, completed: 7, hours: 38.0, workload: 95 },
      { name: 'Juan Pérez', initials: 'JP', assigned: 5, completed: 3, hours: 16.0, workload: 55 },
      { name: 'Laura Sánchez', initials: 'LS', assigned: 5, completed: 4, hours: 22.0, workload: 65 },
      { name: 'Pedro López', initials: 'PL', assigned: 3, completed: 2, hours: 9.0, workload: 42 },
    ],
  },
  {
    id: 9,
    shortLabel: 'Sprint 9',
    accentColor: '#8E24AA',
    name: 'Sprint 9',
    dateRange: 'Feb 24 – Mar 9, 2024',
    dateRangeEn: 'February 24 – March 9, 2024',
    status: 'completed',
    totalTasks: 16,
    totalCompleted: 14,
    totalHours: 95.5,
    kpis: {
      completionRate: 88,
      onTimeDelivery: 70,
      teamParticipation: 80,
      workloadBalance: 0.82,
      productivityScore: 74,
    },
    developers: [
      { name: 'Carlos Ruiz', initials: 'CR', assigned: 7, completed: 6, hours: 30.0, workload: 78 },
      { name: 'María García', initials: 'MG', assigned: 9, completed: 7, hours: 40.5, workload: 96 },
      { name: 'Juan Pérez', initials: 'JP', assigned: 5, completed: 4, hours: 18.0, workload: 58 },
      { name: 'Laura Sánchez', initials: 'LS', assigned: 6, completed: 5, hours: 28.0, workload: 66 },
      { name: 'Pedro López', initials: 'PL', assigned: 3, completed: 2, hours: 10.0, workload: 44 },
    ],
  },
];

/** Task `developer` id ↔ full name (same team as sprint cards). */
export const DEVELOPER_DISPLAY_NAME = {
  developer1: 'Carlos Ruiz',
  developer2: 'María García',
  developer3: 'Juan Pérez',
  developer4: 'Laura Sánchez',
  developer5: 'Pedro López',
};

/** Stable order for filters: alphabetical by display name. */
export const DEFINED_DEVELOPER_IDS = Object.entries(DEVELOPER_DISPLAY_NAME)
  .sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }))
  .map(([id]) => id);

/** Sprint 9 → 13 for checkboxes */
export const SPRINTS_FOR_SELECTOR = [...DASHBOARD_SPRINTS].sort((a, b) => a.id - b.id);

export const DEFAULT_SELECTED_SPRINT_IDS = [12];

export function getSprintById(id) {
  return DASHBOARD_SPRINTS.find((s) => s.id === id);
}

export function getSprintsByIds(ids) {
  const set = new Set(ids);
  return DASHBOARD_SPRINTS.filter((s) => set.has(s.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

export function avgHoursPerTask(sprint) {
  if (!sprint.totalCompleted) return '0.0';
  return (sprint.totalHours / sprint.totalCompleted).toFixed(1);
}

/** Previous sprint in timeline order (by numeric id). */
export function getPreviousSprint(sprint) {
  const byId = [...DASHBOARD_SPRINTS].sort((a, b) => a.id - b.id);
  const i = byId.findIndex((s) => s.id === sprint.id);
  return i > 0 ? byId[i - 1] : null;
}

/** Merge developer rows for grouped charts: { name, [shortLabel_completed]: n, ... } */
export function shortDevName(fullName) {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

export function buildGroupedCompletedData(selectedSprints) {
  const names = new Set();
  selectedSprints.forEach((sp) => sp.developers.forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      row[`${sp.shortLabel}_c`] = dev ? dev.completed : 0;
    });
    return row;
  });
}

export function buildGroupedHoursData(selectedSprints) {
  const names = new Set();
  selectedSprints.forEach((sp) => sp.developers.forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      row[`${sp.shortLabel}_h`] = dev ? dev.hours : 0;
    });
    return row;
  });
}

/** Workload index (0–100) per developer per sprint for grouped charts */
export function buildGroupedWorkloadData(selectedSprints) {
  const names = new Set();
  selectedSprints.forEach((sp) => sp.developers.forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      row[`${sp.shortLabel}_w`] = dev ? (dev.workload ?? 0) : 0;
    });
    return row;
  });
}

export function completionRate(dev) {
  if (!dev.assigned) return 0;
  return Math.round((dev.completed / dev.assigned) * 100);
}

/** Build comparison insight strings */
export function buildSprintInsights(selectedSprints) {
  if (selectedSprints.length < 2) return [];
  const insights = [];
  const byProd = [...selectedSprints].sort((a, b) => b.kpis.productivityScore - a.kpis.productivityScore);
  insights.push(
    `${byProd[0].name} registered the highest productivity score (${byProd[0].kpis.productivityScore}).`
  );
  const byCompletion = [...selectedSprints].sort((a, b) => b.kpis.completionRate - a.kpis.completionRate);
  insights.push(
    `Best task completion rate: ${byCompletion[0].shortLabel} at ${byCompletion[0].kpis.completionRate}%.`
  );
  const names = selectedSprints[0].developers.map((d) => d.name);
  let devInsightAdded = false;
  for (const devName of names) {
    if (devInsightAdded) break;
    const rates = selectedSprints.map((sp) => {
      const d = sp.developers.find((x) => x.name === devName);
      return { sp, rate: d ? completionRate(d) : 0 };
    });
    const sorted = [...rates].sort((a, b) => b.rate - a.rate);
    if (sorted.length >= 2 && sorted[0].rate !== sorted[sorted.length - 1].rate) {
      const lo = sorted[sorted.length - 1];
      const hi = sorted[0];
      const delta = hi.rate - lo.rate;
      if (delta >= 8) {
        insights.push(
          `${devName.split(' ')[0]} gained ${delta}% completion from ${lo.sp.shortLabel} to ${hi.sp.shortLabel}.`
        );
        devInsightAdded = true;
      }
    }
  }
  const hoursTrend = [...selectedSprints].sort((a, b) => a.id - b.id);
  if (hoursTrend.length >= 2) {
    const last = hoursTrend[hoursTrend.length - 1];
    const prev = hoursTrend[hoursTrend.length - 2];
    const diff = Math.round(((last.totalHours - prev.totalHours) / prev.totalHours) * 100);
    if (Math.abs(diff) >= 3) {
      insights.push(
        `Total hours logged ${diff > 0 ? 'rose' : 'fell'} ~${Math.abs(diff)}% from ${prev.shortLabel} to ${last.shortLabel}.`
      );
    }
  }
  return [...new Set(insights)].slice(0, 5);
}
