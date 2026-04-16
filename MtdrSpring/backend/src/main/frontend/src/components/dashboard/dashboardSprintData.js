/** Match API.js / ProjectSelector: localhost ≠ 127.0.0.1 for the browser; relative URLs when served from Spring. */
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

/** Distinct chart series colors (no red/green — reserved for KPI / status cues elsewhere). */
export const SPRINT_CHART_COLORS = [
  '#1E88E5',
  '#FB8C00',
  '#8E24AA',
  '#455A64',
  '#5E35B1',
  '#0277BD',
  '#F57C00',
  '#6D4C41',
  '#3949AB',
  '#00ACC1',
  '#7E57C2',
  '#5C6BC0',
];

// Cache variables
let cachedData = {
  sprints: null,
  tasks: null,
  userTasks: null,
  timestamp: 0,
  projectId: null
};
const CACHE_TTL = 30000; // 30 segundos

/**
 * Mutates each sprint: accentColor from palette by order among all sprints (sorted by id).
 */
export function assignSprintAccentColors(sprints) {
  if (!Array.isArray(sprints) || sprints.length === 0) return sprints;
  const byIdAsc = [...sprints].sort((a, b) => Number(a.id) - Number(b.id));
  const rank = new Map(byIdAsc.map((s, i) => [s.id, i]));
  const n = SPRINT_CHART_COLORS.length;
  sprints.forEach((s) => {
    const i = rank.has(s.id) ? rank.get(s.id) : 0;
    s.accentColor = SPRINT_CHART_COLORS[i % n];
  });
  return sprints;
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

export function bucketTaskStatus(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'DONE' || s === 'COMPLETED' || s === 'COMPLETE') return 'DONE';
  if (s === 'IN_REVIEW' || s === 'REVIEW') return 'IN_REVIEW';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s === 'PENDING' || s === 'TODO' || s === 'TO_DO' || s === '') return 'TODO';
  return 'TODO';
}

const TASK_STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const STATUS_DIST_META = {
  TODO: { name: 'To Do', color: '#FB8C00' },
  IN_PROGRESS: { name: 'In Progress', color: '#1E88E5' },
  IN_REVIEW: { name: 'In Review', color: '#8E24AA' },
  DONE: { name: 'Completed', color: '#3949AB' },
};

export function resolveUserTaskTaskId(ut) {
  if (ut == null) return null;
  const raw =
    ut.task?.id
    ?? ut.task?.ID
    ?? ut.id?.taskId
    ?? ut.id?.task_id
    ?? ut.taskId
    ?? ut.task_id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** DB user id for this assignment (stable key for aggregating hours per developer). */
export function resolveUserTaskUserId(ut) {
  if (ut == null) return null;
  const raw =
    ut.user?.id
    ?? ut.user?.ID
    ?? ut.id?.userId
    ?? ut.id?.user_id;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sprint for a USER_TASK row: prefer TASK list lookup, else nested task from the assignment (API graph).
 */
function resolveSprintIdForUserTaskRow(ut, taskId, taskSprintMap) {
  if (taskId != null && taskSprintMap[taskId] != null) {
    return taskSprintMap[taskId].sprintId;
  }
  return taskSprintId(ut.task);
}

/** One map entry per developer: userId when present (avoids splitting "Jimena Díaz" vs "User 5" when user was lazy). */
function developerAggregateKey(ut) {
  const uid = resolveUserTaskUserId(ut);
  if (uid != null) return `u:${uid}`;
  const label = String(ut.user?.name || ut.user?.phoneNumber || '').trim();
  if (label) return `n:${label}`;
  const tid = resolveUserTaskTaskId(ut);
  return tid != null ? `t:${tid}` : 'unknown';
}

function pickDeveloperDisplayName(ut, previousName) {
  const fromApi = String(ut.user?.name || ut.user?.phoneNumber || '').trim();
  if (fromApi) return fromApi;
  if (previousName && !/^User\s+\d+$/.test(String(previousName))) return previousName;
  const uid = resolveUserTaskUserId(ut);
  if (uid != null) return `User ${uid}`;
  return previousName || 'Unknown';
}

/**
 * Real hours for a USER_TASK row: maps to DB WORKED_HOURS / API {@code workedHours}.
 * Accepts {@code hours} as an alias when present in JSON.
 */
export function userTaskWorkedHours(ut) {
  if (ut == null) return 0;
  const v = ut.workedHours ?? ut.worked_hours ?? ut.hours;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function taskSprintId(task) {
  if (task == null) return null;
  const as = task.assignedSprint;
  if (as != null && typeof as === 'object' && as.id != null) return Number(as.id);
  if (typeof as === 'number' || (typeof as === 'string' && as !== '')) {
    const n = Number(as);
    return Number.isFinite(n) ? n : null;
  }
  if (task.assignedSprintId != null) return Number(task.assignedSprintId);
  if (task.sprintId != null) return Number(task.sprintId);
  return null;
}

/**
 * Normalizes USER_TASK.STATUS for comparison (matches DB VARCHAR / API casing).
 */
function normalizeUserTaskStatusColumn(st) {
  return String(st ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Whether USER_TASK.WORKED_HOURS counts: assignment row is finished (STATUS COMPLETED or legacy DONE).
 * Does not infer from TASK status alone.
 */
function userTaskRowEligibleForWorkedHours(ut) {
  const st = ut?.status;
  if (st == null || String(st).trim() === '') return false;
  const n = normalizeUserTaskStatusColumn(st);
  return n === 'COMPLETED' || n === 'DONE';
}

function isUserTaskAssignmentDone(ut, taskInfo) {
  const candidates = [ut?.status, ut?.task?.status, taskInfo?.status];
  const nonempty = candidates.filter((s) => s != null && String(s).trim() !== '');
  return nonempty.some((s) => bucketTaskStatus(s) === 'DONE');
}

function sprintTaskStatusRows(counts) {
  const rows = TASK_STATUS_ORDER.map((key) => ({
    key,
    name: STATUS_DIST_META[key].name,
    count: counts[key] ?? 0,
    color: STATUS_DIST_META[key].color,
  }));
  const taskStatusTotal = TASK_STATUS_ORDER.reduce((a, k) => a + (counts[k] ?? 0), 0);
  return { taskStatusDistribution: rows, taskStatusTotal };
}

function mapApiSprint(apiSprint) {
  const id = apiSprint.id;
  return {
    id,
    assignedProject: apiSprint.assignedProject ?? null,
    shortLabel: `Sprint ${id}`,
    accentColor: SPRINT_CHART_COLORS[0],
    name: `Sprint ${id}`,
    dateRange: formatDateRange(apiSprint.startDate, apiSprint.dueDate, 'en'),
    dateRangeEn: formatDateRange(apiSprint.startDate, apiSprint.dueDate, 'en'),
    status: inferStatus(apiSprint),
    totalTasks: 0,
    totalCompleted: 0,
    totalHours: 0,
    taskStatusDistribution: [],
    taskStatusTotal: 0,
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

function deriveKpisFromLiveData(sprintId, _statusCounts, tasksList, userTasksList, taskSprintMap, storedKpis) {
  const totalTasks = TASK_STATUS_ORDER.reduce((acc, k) => acc + (_statusCounts[k] ?? 0), 0);
  const totalCompleted = _statusCounts.DONE ?? 0;
  const completionRatePct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const tasksInSprint = (tasksList || []).filter((t) => taskSprintId(t) === sprintId);

  let doneForOnTime = 0;
  let onTimeCount = 0;
  tasksInSprint.forEach((t) => {
    if (bucketTaskStatus(t.status) !== 'DONE') return;
    doneForOnTime++;
    const fd = t.finishDate;
    const dd = t.dueDate;
    if (fd != null && dd != null && new Date(fd).getTime() <= new Date(dd).getTime()) {
      onTimeCount += 1;
    }
  });
  const onTimeDeliveryPct = doneForOnTime > 0 ? Math.round((onTimeCount / doneForOnTime) * 100) : 0;

  let sumAssignedHours = 0;
  tasksInSprint.forEach((t) => {
    sumAssignedHours += Number(t.assignedHours) || 0;
  });
  let sumWorkedHours = 0;
  (userTasksList || []).forEach((ut) => {
    const tid = resolveUserTaskTaskId(ut);
    const sid = resolveSprintIdForUserTaskRow(ut, tid, taskSprintMap);
    if (sid == null || Number(sid) !== Number(sprintId)) return;
    if (!userTaskRowEligibleForWorkedHours(ut)) return;
    sumWorkedHours += userTaskWorkedHours(ut);
  });
  const teamParticipationPct =
    sumAssignedHours > 0 ? Math.round((sumWorkedHours / sumAssignedHours) * 100) : 0;

  return {
    ...storedKpis,
    completionRate: completionRatePct,
    productivityScore: completionRatePct,
    onTimeDelivery: onTimeDeliveryPct,
    teamParticipation: teamParticipationPct,
  };
}

function enrichSprintsWithUserTasks(sprints, tasks, userTasks) {
  const sprintMap = {};
  sprints.forEach((sp) => {
    const id = Number(sp.id);
    sprintMap[id] = {
      ...sp,
      id,
      _devMap: {},
      _statusCounts: { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 },
    };
  });

  const taskSprintMap = {};
  (tasks || []).forEach((task) => {
    const sid = taskSprintId(task);
    if (sid == null || !Number.isFinite(sid) || !sprintMap[sid]) return;
    const tid = Number(task.id);
    if (!Number.isFinite(tid)) return;
    taskSprintMap[tid] = {
      sprintId: sid,
      status: task.status,
      assignedHours: task.assignedHours ?? 0,
    };
    const b = bucketTaskStatus(task.status);
    sprintMap[sid]._statusCounts[b] += 1;
  });

  userTasks.forEach((ut) => {
    const taskId = resolveUserTaskTaskId(ut);
    const sprintIdForUt = resolveSprintIdForUserTaskRow(ut, taskId, taskSprintMap);
    if (sprintIdForUt == null || !Number.isFinite(Number(sprintIdForUt))) return;

    const sp = sprintMap[Number(sprintIdForUt)];
    if (!sp) return;

    const utCompleted = userTaskRowEligibleForWorkedHours(ut);

    /** USER_TASK.WORKED_HOURS only when USER_TASK.STATUS is COMPLETED/DONE (not inferred from TASK alone). */
    const workedHours = utCompleted ? userTaskWorkedHours(ut) : 0;
    sp.totalHours += workedHours;

    const devKey = developerAggregateKey(ut);
    if (!sp._devMap[devKey]) {
      const initialName = pickDeveloperDisplayName(ut, null);
      sp._devMap[devKey] = {
        name: initialName,
        initials: initialsFromName(initialName),
        _taskIds: new Set(),
        _completedTaskIds: new Set(),
        hours: 0,
        workload: 0,
      };
    }
    const dm = sp._devMap[devKey];
    dm.name = pickDeveloperDisplayName(ut, dm.name);
    dm.initials = initialsFromName(dm.name);
    if (taskId != null) {
      dm._taskIds.add(taskId);
      if (utCompleted) dm._completedTaskIds.add(taskId);
    }
    dm.hours += workedHours;
  });

  return sprints.map((sp) => {
    const id = Number(sp.id);
    const entry = sprintMap[id];
    if (!entry) {
      return {
        ...sp,
        developers: [],
        totalTasks: 0,
        totalCompleted: 0,
        totalHours: 0,
        taskStatusDistribution: [],
        taskStatusTotal: 0,
        kpis: sp.kpis ?? {},
      };
    }
    const { _devMap, _statusCounts, ...rest } = entry;
    const devs = Object.values(_devMap);
    const maxHours = Math.max(...devs.map((d) => d.hours), 1);
    devs.forEach((d) => {
      const taskIds = d._taskIds;
      const completedIds = d._completedTaskIds;
      d.assigned = taskIds ? taskIds.size : 0;
      d.completed = completedIds ? completedIds.size : 0;
      delete d._taskIds;
      delete d._completedTaskIds;
      d.workload = Math.round((d.hours / maxHours) * 100);
      d.pending = Math.max(0, (d.assigned ?? 0) - (d.completed ?? 0));
    });
    const statusPart = sprintTaskStatusRows(_statusCounts);
    const totalTasks = TASK_STATUS_ORDER.reduce((acc, k) => acc + (_statusCounts[k] ?? 0), 0);
    const totalCompleted = _statusCounts.DONE ?? 0;
    const kpis = deriveKpisFromLiveData(id, _statusCounts, tasks, userTasks, taskSprintMap, rest.kpis);
    return { ...rest, kpis, totalTasks, totalCompleted, developers: devs, ...statusPart };
  });
}

const fetchJsonNoCache = (url) =>
  fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });

export async function fetchDashboardSprints(projectId) {
  const now = Date.now();
  
  // Check cache first
  if (cachedData.sprints && 
      cachedData.tasks && 
      cachedData.userTasks && 
      cachedData.projectId === projectId &&
      (now - cachedData.timestamp) < CACHE_TTL) {
    console.log('Using cached dashboard data');
    const mapped = cachedData.sprints.map(mapApiSprint).sort((a, b) => a.id - b.id);
    const enriched = enrichSprintsWithUserTasks(mapped, cachedData.tasks, cachedData.userTasks);
    assignSprintAccentColors(enriched);
    return enriched;
  }
  
  try {
    console.log('Fetching fresh dashboard data');
    const sprintsUrl = projectId
      ? `${API_BASE}/api/sprints?projectId=${projectId}`
      : `${API_BASE}/api/sprints`;

    const [sprintsRes, tasksRes, userTasksRes] = await Promise.all([
      fetchJsonNoCache(sprintsUrl),
      fetchJsonNoCache(`${API_BASE}/api/tasks`),
      fetchJsonNoCache(`${API_BASE}/api/user-tasks`),
    ]);

    if (!sprintsRes.ok || !tasksRes.ok || !userTasksRes.ok) throw new Error('Failed to load data');

    const apiSprints = await sprintsRes.json();
    const apiTasks = await tasksRes.json();
    const apiUserTasks = await userTasksRes.json();
    
    // Update cache
    cachedData = {
      sprints: apiSprints,
      tasks: apiTasks,
      userTasks: apiUserTasks,
      timestamp: now,
      projectId: projectId
    };

    const mapped = apiSprints.map(mapApiSprint).sort((a, b) => a.id - b.id);
    let enriched;
    try {
      enriched = enrichSprintsWithUserTasks(mapped, apiTasks, apiUserTasks);
    } catch (e) {
      console.error('enrichSprintsWithUserTasks failed, using sprints without user-task rollups:', e);
      enriched = mapped;
    }
    assignSprintAccentColors(enriched);
    return enriched;
  } catch (error) {
    console.error('Dashboard data load failed:', error);
    return [];
  }
}

// Export function to manually invalidate cache when data changes
export function invalidateDashboardCache() {
  cachedData = {
    sprints: null,
    tasks: null,
    userTasks: null,
    timestamp: 0,
    projectId: null
  };
  console.log('Dashboard cache invalidated');
}

export function shortDevName(fullName) {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

const TASK_STATUS_KEYS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const MERGE_STATUS_META = {
  TODO: { name: 'To Do', color: '#FB8C00' },
  IN_PROGRESS: { name: 'In Progress', color: '#1E88E5' },
  IN_REVIEW: { name: 'In Review', color: '#8E24AA' },
  DONE: { name: 'Completed', color: '#3949AB' },
};

export function mergeTaskStatusAcrossSprints(selectedSprints) {
  const acc = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
  (selectedSprints || []).forEach((sp) => {
    (sp.taskStatusDistribution || []).forEach((row) => {
      if (acc[row.key] !== undefined) acc[row.key] += row.count ?? 0;
    });
  });
  const template = (selectedSprints && selectedSprints[0]?.taskStatusDistribution) || [];
  const distribution = TASK_STATUS_KEYS.map((key) => {
    const t = template.find((r) => r.key === key);
    const fb = MERGE_STATUS_META[key];
    return {
      key,
      name: t?.name ?? fb.name,
      count: acc[key],
      color: t?.color ?? fb.color,
    };
  });
  const taskStatusTotal = TASK_STATUS_KEYS.reduce((a, k) => a + acc[k], 0);
  return { taskStatusDistribution: distribution, taskStatusTotal };
}

export function aggregateSelectionMetrics(selectedSprints) {
  let totalTasks = 0;
  let totalHours = 0;
  const devMap = new Map();

  (selectedSprints || []).forEach((sp) => {
    totalTasks += Number(sp.totalTasks) || 0;
    totalHours += Number(sp.totalHours) || 0;
    (sp.developers || []).forEach((d) => {
      const cur = devMap.get(d.name) || { name: d.name, assigned: 0, completed: 0, hours: 0 };
      cur.assigned += Number(d.assigned) || 0;
      cur.completed += Number(d.completed) || 0;
      cur.hours += Number(d.hours) || 0;
      devMap.set(d.name, cur);
    });
  });

  const uniqueDevCount = devMap.size;
  const avgTasksPerDev = uniqueDevCount > 0 ? totalTasks / uniqueDevCount : 0;
  const avgHoursPerDev = uniqueDevCount > 0 ? totalHours / uniqueDevCount : 0;

  const developers = Array.from(devMap.values()).map((d) => {
    const assigned = d.assigned ?? 0;
    const completed = d.completed ?? 0;
    return {
      ...d,
      shortName: shortDevName(d.name),
      pending: Math.max(0, assigned - completed),
    };
  });

  return {
    totalTasks,
    totalHours,
    uniqueDevCount,
    avgTasksPerDev,
    avgHoursPerDev,
    developers,
  };
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

export function buildCompareDeveloperChartsModel(selectedSprints) {
  const sprints = [...(selectedSprints || [])].filter(Boolean);
  if (sprints.length < 2) return null;

  const sprintDefs = sprints.map((sp, idx) => ({
    id: Number(sp.id),
    shortLabel: sp.shortLabel ?? `Sprint ${sp.id}`,
    accentColor: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
  }));

  const nameSet = new Set();
  sprints.forEach((sp) => (sp.developers || []).forEach((d) => nameSet.add(d.name)));
  const names = Array.from(nameSet);

  const baseRows = names.map((fullName) => {
    const row = { name: fullName, shortName: shortDevName(fullName) };
    sprints.forEach((sp) => {
      const dev = (sp.developers || []).find((d) => d.name === fullName);
      const assigned = Number(dev?.assigned) || 0;
      const completedRaw = Number(dev?.completed) || 0;
      const completed = Math.min(completedRaw, assigned);
      const open = Math.max(0, assigned - completed);
      const hours = Number(dev?.hours) || 0;
      const id = Number(sp.id);
      row[`wc_${id}`] = completed;
      row[`wo_${id}`] = open;
      row[`hr_${id}`] = hours;
      row[`cb_${id}`] = completed;
      row[`ln_${id}`] = hours;
    });
    return row;
  });

  const sumWorkload = (row) =>
    sprintDefs.reduce((s, d) => s + (row[`wc_${d.id}`] || 0) + (row[`wo_${d.id}`] || 0), 0);
  const sumHours = (row) => sprintDefs.reduce((s, d) => s + (row[`hr_${d.id}`] || 0), 0);
  const sumComboTasks = (row) => sprintDefs.reduce((s, d) => s + (row[`cb_${d.id}`] || 0), 0);

  const workloadRows = [...baseRows].sort((a, b) => {
    const diff = sumWorkload(b) - sumWorkload(a);
    return diff !== 0 ? diff : String(a.name).localeCompare(String(b.name));
  });
  const hoursRows = [...baseRows].sort((a, b) => sumHours(b) - sumHours(a));
  const comboRows = [...baseRows].sort((a, b) => sumComboTasks(b) - sumComboTasks(a));

  return { sprintDefs, workloadRows, hoursRows, comboRows };
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