export const SPRINT_CHART_COLORS = ['#C74634', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];

export function accentForSprintId(id) {
  return SPRINT_CHART_COLORS[Number(id) % SPRINT_CHART_COLORS.length];
}

function inferStatus(apiSprint) {
  const now = new Date();
  const start = new Date(apiSprint.startDate);
  const due = new Date(apiSprint.dueDate);
  if (now < start) return 'planned';
  if (now > due) return 'completed';
  return 'active';
}

function formatDateRange(startIso, endIso, locale = 'en') {
  if (!startIso || !endIso) return '';
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  const lang = locale === 'es' ? 'es-MX' : 'en-US';
  const s = new Date(startIso).toLocaleDateString(lang, opts);
  const e = new Date(endIso).toLocaleDateString(lang, opts);
  return `${s} – ${e}`;
}

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || '').slice(0, 2).toUpperCase();
}

function mapApiSprint(apiSprint) {
  const id = apiSprint.id;
  return {
    id,
    shortLabel: `Sprint ${id}`,
    accentColor: accentForSprintId(id),
    name: `Sprint ${id}`,
    dateRange: formatDateRange(apiSprint.startDate, apiSprint.dueDate, 'es'),
    dateRangeEn: formatDateRange(apiSprint.startDate, apiSprint.dueDate, 'en'),
    status: inferStatus(apiSprint),
    totalTasks: 0,
    totalCompleted: 0,
    totalHours: 0,
    kpis: {
      completionRate:    Math.round((apiSprint.completionRate    ?? 0) * 100),
      onTimeDelivery:    Math.round((apiSprint.onTimeDelivery    ?? 0) * 100),
      teamParticipation: Math.round((apiSprint.teamParticipation ?? 0) * 100),
      workloadBalance:   apiSprint.workloadBalance ?? 0,
      productivityScore: Math.round((apiSprint.completionRate    ?? 0) * 100),
    },
    developers: [],
  };
}

function enrichSprintsWithUserTasks(sprints, tasks, userTasks) {
  const sprintMap = {};
  sprints.forEach((sp) => {
    sprintMap[sp.id] = { ...sp, _devMap: {} };
  });

  const taskSprintMap = {};
  tasks.forEach((task) => {
    if (task.assignedSprint?.id) {
      taskSprintMap[task.id] = {
        sprintId: task.assignedSprint.id,
        status: task.status,
        assignedHours: task.assignedHours ?? 0,
      };
    }
  });

  userTasks.forEach((ut) => {
    const taskId = ut.task?.id;
    const taskInfo = taskSprintMap[taskId];
    if (!taskInfo) return;

    const sp = sprintMap[taskInfo.sprintId];
    if (!sp) return;

    sp.totalTasks += 1;
    const isDone = taskInfo.status === 'DONE';
    if (isDone) sp.totalCompleted += 1;

    const workedHours = ut.workedHours ?? 0;
    sp.totalHours += workedHours;

    const devName = ut.user?.name || ut.user?.phoneNumber || `User ${ut.user?.id ?? '?'}`;

    if (!sp._devMap[devName]) {
      sp._devMap[devName] = {
        name: devName,
        initials: initialsFromName(devName),
        assigned: 0,
        completed: 0,
        hours: 0,
        workload: 0,
      };
    }
    sp._devMap[devName].assigned += 1;
    if (isDone) sp._devMap[devName].completed += 1;
    sp._devMap[devName].hours += workedHours;
  });

  return sprints.map((sp) => {
    const { _devMap, ...rest } = sprintMap[sp.id];
    const devs = Object.values(_devMap);
    const maxHours = Math.max(...devs.map((d) => d.hours), 1);
    devs.forEach((d) => { d.workload = Math.round((d.hours / maxHours) * 100); });
    return { ...rest, developers: devs };
  });
}

export async function fetchDashboardSprints() {
  try {
    const [sprintsRes, tasksRes, userTasksRes] = await Promise.all([
      fetch('http://127.0.0.1:8080/api/sprints'),
      fetch('http://127.0.0.1:8080/api/tasks'),
      fetch('http://127.0.0.1:8080/api/user-tasks'),
    ]);

    if (!sprintsRes.ok || !tasksRes.ok || !userTasksRes.ok) throw new Error('Error en la carga');

    const apiSprints   = await sprintsRes.json();
    const apiTasks     = await tasksRes.json();
    const apiUserTasks = await userTasksRes.json();

    const mapped = apiSprints.map(mapApiSprint).sort((a, b) => a.id - b.id);
    return enrichSprintsWithUserTasks(mapped, apiTasks, apiUserTasks);
  } catch (error) {
    console.error("Fallo al cargar datos del Dashboard:", error);
    return [];
  }
}

export function shortDevName(fullName) {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

export function avgHoursPerTask(sprint) {
  if (!sprint.totalCompleted) return '0.0';
  return (sprint.totalHours / sprint.totalCompleted).toFixed(1);
}

export function completionRate(dev) {
  if (!dev.assigned) return 0;
  return Math.round((dev.completed / dev.assigned) * 100);
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

export function buildSprintInsights(selectedSprints) {
  if (selectedSprints.length < 2) return [];
  const insights = [];
  const byProd = [...selectedSprints].sort((a, b) => b.kpis.productivityScore - a.kpis.productivityScore);
  insights.push(`${byProd[0].name} registered the highest productivity score (${byProd[0].kpis.productivityScore}).`);
  const byCompletion = [...selectedSprints].sort((a, b) => b.kpis.completionRate - a.kpis.completionRate);
  insights.push(`Best task completion rate: ${byCompletion[0].shortLabel} at ${byCompletion[0].kpis.completionRate}%.`);
  return [...new Set(insights)].slice(0, 5);
}

export const DEVELOPER_DISPLAY_NAME = {};
export const DEFINED_DEVELOPER_IDS = [];
export const DEFAULT_SELECTED_SPRINT_IDS_FALLBACK = [];
export let DASHBOARD_SPRINTS = [];
export let SPRINTS_FOR_SELECTOR = [];