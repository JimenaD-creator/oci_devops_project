import { inferStatusByDate } from '../sprints/utils/sprintUtils';
import {
  computeIndividualWorkloadBalance,
  computeProductivityScore,
  normalizeEfficiencyPercent,
  productivityScoreFromSprintKpis,
} from '../kpis/productivityScoreUtils';
import { isAssigneeCompletionOnTime } from '../tasks/utils/assigneeOnTimeUtils';
import {
  collectDeveloperNamesForSelection,
  mergeRosterWithSprintDevelopers,
} from '../../utils/teamRosterUtils';
import { getApiBase } from '../../utils/apiBase';
import { apiFetch, getSessionExpiredMessage, isUnauthorizedHttpStatus } from '../../utils/auth';
import { developerAvatarColors } from '../../utils/developerColors';

/** Distinct chart + selector dot colors (saturated only — no slate/brown-gray). */
export const SPRINT_CHART_COLORS = [
  '#1565C0',
  '#FB8C00',
  '#26A69A',
  '#8E24AA',
  '#5E35B1',
  '#0277BD',
  '#F57C00',
  '#00897B',
  '#3949AB',
  '#00ACC1',
  '#7E57C2',
  '#43A047',
];

// Cache variables (raw API arrays + pre-enriched sprints for fast page loads)
let cachedData = {
  sprints: null,
  tasks: null,
  userTasks: null,
  developers: null,
  enrichedSprints: null,
  timestamp: 0,
  projectId: null,
};
/** In-memory TTL for sprints + tasks + user-tasks bundle (shared across all pages). */
const CACHE_TTL = 120000; // 2 minutes
const SESSION_CACHE_PREFIX = 'dashboardBundle:v1:';

/** True after F5 / browser reload — sessionStorage may still hold stale bundle data. */
export function isFullPageReload() {
  try {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    return nav?.type === 'reload';
  } catch {
    return false;
  }
}

function shouldBypassClientCache(options = {}) {
  return Boolean(options?.forceFresh) || isFullPageReload();
}

function sessionCacheKey(pid) {
  return `${SESSION_CACHE_PREFIX}${pid}`;
}

function readSessionBundleCache(pid) {
  try {
    const raw = sessionStorage.getItem(sessionCacheKey(pid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || String(parsed.projectId) !== String(pid)) return null;
    if (!parsed.timestamp || Date.now() - parsed.timestamp >= CACHE_TTL) return null;
    if (!Array.isArray(parsed.sprints) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.userTasks)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionBundleCache(pid) {
  try {
    const developers = Array.isArray(cachedData.developers)
      ? cachedData.developers.map((d) => {
          const { profilePicture: _omit, ...rest } = d || {};
          return rest;
        })
      : [];
    sessionStorage.setItem(
      sessionCacheKey(pid),
      JSON.stringify({
        projectId: pid,
        timestamp: cachedData.timestamp,
        sprints: cachedData.sprints,
        tasks: cachedData.tasks,
        userTasks: cachedData.userTasks,
        developers,
        enrichedSprints: cachedData.enrichedSprints,
      }),
    );
  } catch (e) {
    try {
      sessionStorage.setItem(
        sessionCacheKey(pid),
        JSON.stringify({
          projectId: pid,
          timestamp: cachedData.timestamp,
          sprints: cachedData.sprints,
          tasks: cachedData.tasks,
          userTasks: cachedData.userTasks,
          developers: [],
          enrichedSprints: null,
        }),
      );
    } catch {
      /* sessionStorage full — in-memory cache still works for this tab */
    }
  }
}

function clearSessionBundleCache(pid) {
  try {
    if (pid) sessionStorage.removeItem(sessionCacheKey(pid));
  } catch {
    /* ignore */
  }
}

function hydrateMemoryCacheFromSession(pid) {
  if (isFullPageReload()) return false;
  const sessionSnap = readSessionBundleCache(pid);
  if (!sessionSnap) return false;
  cachedData = {
    sprints: sessionSnap.sprints,
    tasks: sessionSnap.tasks,
    userTasks: sessionSnap.userTasks,
    developers: sessionSnap.developers ?? null,
    enrichedSprints: sessionSnap.enrichedSprints ?? null,
    timestamp: sessionSnap.timestamp,
    projectId: pid,
  };
  if (!Array.isArray(cachedData.enrichedSprints) || cachedData.enrichedSprints.length === 0) {
    rebuildEnrichedSprintsFromCache();
  }
  return isCacheValidForProject(pid, Date.now(), false);
}

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

/** Hours/days since a blocked report timestamp (same convention as Blocked tasks cards). */
export function formatBlockedSinceAge(rawDate) {
  if (!rawDate) return 'Unknown';
  const ms = new Date(rawDate).getTime();
  if (!Number.isFinite(ms)) return 'Unknown';
  const diff = Math.max(0, Date.now() - ms);
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function parseBlockedSinceEpochMs(iso) {
  if (iso == null || iso === '') return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Newest block first; undated last; tie-break by title. */
export function sortBlockedTasksNewestFirst(tasks) {
  return [...(tasks || [])].sort((a, b) => {
    const ma = parseBlockedSinceEpochMs(a?.blockedSince);
    const mb = parseBlockedSinceEpochMs(b?.blockedSince);
    if (ma != null && mb != null && ma !== mb) return mb - ma;
    if (ma != null && mb == null) return -1;
    if (ma == null && mb != null) return 1;
    return String(a?.title || '').localeCompare(String(b?.title || ''));
  });
}

export function bucketTaskStatus(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'DONE' || s === 'COMPLETED' || s === 'COMPLETE') return 'DONE';
  if (s === 'IN_REVIEW' || s === 'REVIEW') return 'IN_REVIEW';
  if (s === 'IN_PROGRESS' || s === 'IN_PROCESS') return 'IN_PROGRESS';
  if (s === 'PENDING' || s === 'TODO' || s === 'TO_DO' || s === '') return 'TODO';
  return 'TODO';
}

const TASK_STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const STATUS_DIST_META = {
  TODO: { name: 'To Do', color: '#FFC107' },
  IN_PROGRESS: { name: 'In Progress', color: '#1E88E5' },
  IN_REVIEW: { name: 'In Review', color: '#8E24AA' },
  DONE: { name: 'Completed', color: '#3949AB' },
};

export function resolveUserTaskTaskId(ut) {
  if (ut == null) return null;
  const raw =
    ut.task?.id ?? ut.task?.ID ?? ut.id?.taskId ?? ut.id?.task_id ?? ut.taskId ?? ut.task_id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** DB user id for this assignment (stable key for aggregating hours per developer). */
export function resolveUserTaskUserId(ut) {
  if (ut == null) return null;
  const raw = ut.user?.id ?? ut.user?.ID ?? ut.id?.userId ?? ut.id?.user_id;
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

/**
 * Hours for dashboard rollups: uses {@link userTaskWorkedHours} for each USER_TASK row.
 * Shared tasks can stay IN_REVIEW while assignees log hours; those hours still count per developer and sprint totals.
 * Rows whose task is not in {@code taskSprintMap} are ignored (no matching TASK in the loaded project).
 */
function workedHoursForDashboardCharts(ut, taskId, taskSprintMap) {
  const raw = userTaskWorkedHours(ut);
  if (taskId == null || !Number.isFinite(Number(taskId))) return 0;
  const tm = taskSprintMap[taskId];
  if (!tm) return 0;
  return raw;
}

function isTaskBlocked(task) {
  if (!task || typeof task !== 'object') return false;
  const raw = task.blocked ?? task.block ?? task.isBlocked ?? task.is_blocked;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function isUserTaskBlocked(ut) {
  if (!ut || typeof ut !== 'object') return false;
  if (userTaskRowEligibleForWorkedHours(ut)) return false;
  const raw = ut.isBlocked ?? ut.is_blocked ?? ut.blocked ?? ut.block;
  if (typeof raw === 'boolean') return raw;
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function userTaskBlockedReason(ut) {
  if (!ut || typeof ut !== 'object') return '';
  const raw = ut.blockedReason ?? ut.blocked_reason ?? ut.blockReason ?? ut.block_reason;
  return String(raw ?? '').trim();
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
  return n === 'COMPLETED' || n === 'DONE' || n === 'COMPLETE';
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

function mapApiSprint(apiSprint, sprintNumber) {
  const id = apiSprint.id;
  return {
    id,
    assignedProject: apiSprint.assignedProject ?? null,
    startDate: apiSprint.startDate,
    dueDate: apiSprint.dueDate,
    shortLabel: `Sprint ${sprintNumber}`,
    accentColor: SPRINT_CHART_COLORS[0],
    name: `Sprint ${sprintNumber}`,
    dateRange: formatDateRange(apiSprint.startDate, apiSprint.dueDate, 'en'),
    dateRangeEn: formatDateRange(apiSprint.startDate, apiSprint.dueDate, 'en'),
    /** Dashboard: planned / active / completed from sprint date range (not task completion). */
    status: inferStatusByDate(apiSprint),
    totalTasks: 0,
    totalCompleted: 0,
    totalHours: 0,
    /** Sum of TASK.assigned_hours for tasks in this sprint (planned hours). */
    totalAssignedHoursTasks: 0,
    taskStatusDistribution: [],
    taskStatusTotal: 0,
    kpis: (() => {
      const completionRate = Math.round((apiSprint.completionRate ?? 0) * 100);
      const onTimeDelivery = Math.round((apiSprint.onTimeDelivery ?? 0) * 100);
      const efficiencyScore = normalizeEfficiencyPercent(apiSprint.efficiencyScore ?? 0);
      const workloadBalance = apiSprint.workloadBalance ?? 0;
      return {
        completionRate,
        onTimeDelivery,
        efficiencyScore,
        workloadBalance,
        productivityScore: computeProductivityScore({
          completionRate,
          onTimeDelivery,
          efficiencyScore,
          workloadBalance,
        }),
      };
    })(),
    developers: [],
  };
}
function deriveKpisFromLiveData(
  sprintId,
  _statusCounts,
  tasksList,
  userTasksList,
  taskSprintMap,
  storedKpis,
) {
  const totalTasks = TASK_STATUS_ORDER.reduce((acc, k) => acc + (_statusCounts[k] ?? 0), 0);
  const totalCompleted = _statusCounts.DONE ?? 0;
  const completionRatePct = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  const tasksInSprint = (tasksList || []).filter((t) => taskSprintId(t) === sprintId);

  let doneAssignments = 0;
  let onTimeAssignments = 0;
  (userTasksList || []).forEach((ut) => {
    const taskId = resolveUserTaskTaskId(ut);
    if (taskId == null || Number(taskSprintMap[taskId]?.sprintId) !== Number(sprintId)) return;
    if (!userTaskRowEligibleForWorkedHours(ut)) return;
    doneAssignments += 1;
    const meta = taskSprintMap[taskId];
    if (isAssigneeCompletionOnTime(ut, meta?.dueDate, meta) === true) onTimeAssignments += 1;
  });
  const onTimeDeliveryPct =
    doneAssignments > 0 ? Math.round((onTimeAssignments / doneAssignments) * 100) : 0;

  // Sprint efficiency = planned task hours ÷ logged USER_TASK hours (same as KPI Analytics).
  const totalExpectedHours = tasksInSprint.reduce((sum, t) => {
    const n = Number(t?.assignedHours ?? t?.assigned_hours ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
  const totalWorkedHours = (userTasksList || []).reduce((sum, ut) => {
    const taskId = resolveUserTaskTaskId(ut);
    if (taskId == null) return sum;
    if (Number(taskSprintMap[taskId]?.sprintId) !== Number(sprintId)) return sum;
    return sum + userTaskWorkedHours(ut);
  }, 0);
  const efficiencyScorePct =
    totalWorkedHours > 0
      ? Math.min(100, Math.round((totalExpectedHours / totalWorkedHours) * 100))
      : 0;
  const workloadBalancePct = (() => {
    const raw = Number(storedKpis?.workloadBalance ?? 0);
    if (!Number.isFinite(raw)) return 0;
    return Math.min(100, Math.max(0, Math.round(raw <= 1 ? raw * 100 : raw)));
  })();

  return {
    ...storedKpis,
    completionRate: completionRatePct,
    onTimeDelivery: onTimeDeliveryPct,
    efficiencyScore: efficiencyScorePct,
    workloadBalance: workloadBalancePct,
    productivityScore: computeProductivityScore({
      completionRate: completionRatePct,
      onTimeDelivery: onTimeDeliveryPct,
      efficiencyScore: efficiencyScorePct,
      workloadBalance: workloadBalancePct,
    }),
  };
}

function enrichSprintsWithUserTasks(sprints, tasks, userTasks) {
  const sprintMap = {};
  sprints.forEach((sp) => {
    const id = Number(sp.id);
    sprintMap[id] = {
      ...sp,
      id,
      totalHours: Number(sp.totalHours) || 0,
      totalAssignedHoursTasks: Number(sp.totalAssignedHoursTasks) || 0,
      blockedTasksTotal: Number(sp.blockedTasksTotal) || 0,
      _devMap: {},
      _statusCounts: { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 },
      _blockedTaskMapByDeveloper: {},
    };
  });

  const taskSprintMap = {};
  (tasks || []).forEach((task) => {
    const sid = taskSprintId(task);
    if (sid == null || !Number.isFinite(sid) || !sprintMap[sid]) return;
    const tid = Number(task.id);
    if (!Number.isFinite(tid)) return;
    const ah = Number(task.assignedHours ?? task.assigned_hours) || 0;
    taskSprintMap[tid] = {
      sprintId: sid,
      status: task.status,
      assignedHours: ah,
      blocked: isTaskBlocked(task),
      title: String(task?.title || `Task #${tid}`),
      blockedSince:
        task?.updatedAt ?? task?.updated_at ?? task?.startDate ?? task?.start_date ?? null,
      dueDate: task?.dueDate ?? task?.due_date ?? null,
      finishDate: task?.finishDate ?? task?.finish_date ?? null,
    };
    sprintMap[sid].totalAssignedHoursTasks += ah;
    if (taskSprintMap[tid].blocked) sprintMap[sid].blockedTasksTotal += 1;
    const b = bucketTaskStatus(task.status);
    sprintMap[sid]._statusCounts[b] += 1;
  });

  const assigneeCountByTask = {};
  userTasks.forEach((ut) => {
    const taskId = resolveUserTaskTaskId(ut);
    if (taskId != null && Number.isFinite(taskId)) {
      assigneeCountByTask[taskId] = (assigneeCountByTask[taskId] || 0) + 1;
    }
  });
  Object.keys(taskSprintMap).forEach((tid) => {
    const n = Number(tid);
    taskSprintMap[n].assigneeCount = assigneeCountByTask[n] || 1;
  });

  userTasks.forEach((ut) => {
    const taskId = resolveUserTaskTaskId(ut);
    const sprintIdForUt = resolveSprintIdForUserTaskRow(ut, taskId, taskSprintMap);
    if (sprintIdForUt == null || !Number.isFinite(Number(sprintIdForUt))) return;

    const sp = sprintMap[Number(sprintIdForUt)];
    if (!sp) return;

    const utCompleted = userTaskRowEligibleForWorkedHours(ut);
    const loggedHours = workedHoursForDashboardCharts(ut, taskId, taskSprintMap);

    /** Sprint total: sum of USER_TASK.WORKED_HOURS for tasks in this sprint (incl. shared tasks not fully DONE). */
    sp.totalHours += loggedHours;

    const devKey = developerAggregateKey(ut);
    if (!sp._devMap[devKey]) {
      const initialName = pickDeveloperDisplayName(ut, null);
      sp._devMap[devKey] = {
        name: initialName,
        initials: initialsFromName(initialName),
        profilePicture: ut.user?.profilePicture ?? null,
        _taskIds: new Set(),
        _completedTaskIds: new Set(),
        _completedOnTimeIds: new Set(),
        _completedAssignments: 0,
        _onTimeAssignments: 0,
        _assignedHoursEstimate: 0,
        hours: 0,
        workload: 0,
        blockedCount: 0,
        blockedTasks: [],
      };
    }
    const dm = sp._devMap[devKey];
    dm.name = pickDeveloperDisplayName(ut, dm.name);
    dm.initials = initialsFromName(dm.name);
    if (!dm.profilePicture && ut.user?.profilePicture) {
      dm.profilePicture = ut.user.profilePicture; // 👈 agrega esto
    }
    if (taskId != null) {
      if (!dm._taskIds.has(taskId)) {
        dm._assignedHoursEstimate += Number(taskSprintMap[taskId]?.assignedHours) || 0;
      }
      dm._taskIds.add(taskId);
      if (utCompleted) {
        dm._completedTaskIds.add(taskId);
        dm._completedAssignments += 1;
        const meta = taskSprintMap[taskId];
        if (isAssigneeCompletionOnTime(ut, meta?.dueDate, meta) === true) {
          dm._completedOnTimeIds.add(taskId);
          dm._onTimeAssignments += 1;
        }
      }
    }
    /** Per-developer chart: all logged worked hours on USER_TASK (incl. in progress). */
    dm.hours += loggedHours;

    const blockedFromUserTask = isUserTaskBlocked(ut);
    const blockedFromTask = taskId != null && taskSprintMap[taskId]?.blocked;
    /** Completed assignment never counts as blocked (even if TASK stays flagged blocked). */
    if (taskId != null && !utCompleted && (blockedFromUserTask || blockedFromTask)) {
      const taskMeta = taskSprintMap[taskId];
      if (!sp._blockedTaskMapByDeveloper[devKey]) sp._blockedTaskMapByDeveloper[devKey] = new Set();
      if (!sp._blockedTaskMapByDeveloper[devKey].has(taskId)) {
        sp._blockedTaskMapByDeveloper[devKey].add(taskId);
        dm.blockedCount += 1;
        dm.blockedTasks.push({
          id: taskId,
          title: taskMeta.title,
          blockedSince:
            ut?.updatedAt ??
            ut?.updated_at ??
            ut?.createdAt ??
            ut?.created_at ??
            taskMeta.blockedSince,
          blockedReason: userTaskBlockedReason(ut),
        });
      }
    }
  });

  return sprints.map((sp) => {
    const id = Number(sp.id);
    const entry = sprintMap[id];
    if (!entry) {
      return {
        ...sp,
        status: inferStatusByDate(sp),
        developers: [],
        totalTasks: 0,
        totalCompleted: 0,
        totalHours: 0,
        totalAssignedHoursTasks: 0,
        taskStatusDistribution: [],
        taskStatusTotal: 0,
        kpis: sp.kpis ?? {},
      };
    }
    const { _devMap, _statusCounts, _blockedTaskMapByDeveloper, ...rest } = entry;
    const devEntries = Object.entries(_devMap);
    const devs = devEntries.map(([, d]) => d);
    devEntries.forEach(([devKey, d]) => {
      const taskIds = d._taskIds;
      const completedIds = d._completedTaskIds;
      const onTimeIds = d._completedOnTimeIds;
      d.assigned = taskIds ? taskIds.size : 0;
      d.completed = completedIds ? completedIds.size : 0;
      const onTimeCompleted = onTimeIds ? onTimeIds.size : 0;
      const completedAssignments = Number(d._completedAssignments) || 0;
      const onTimeAssignments = Number(d._onTimeAssignments) || 0;
      d.onTime =
        completedAssignments > 0
          ? Math.round((onTimeAssignments / completedAssignments) * 100)
          : d.completed > 0
            ? Math.round((onTimeCompleted / d.completed) * 100)
            : null;
      const uidFromKey = /^u:(\d+)$/.exec(String(devKey));
      if (uidFromKey) d.userId = Number(uidFromKey[1]);
      delete d._taskIds;
      delete d._completedTaskIds;
      delete d._completedOnTimeIds;
      delete d._completedAssignments;
      delete d._onTimeAssignments;
      d.assignedHoursEstimate = Number(d._assignedHoursEstimate) || 0;
      delete d._assignedHoursEstimate;
      d.pending = Math.max(0, (d.assigned ?? 0) - (d.completed ?? 0));
    });
    devs.forEach((d) => {
      d.workload = computeIndividualWorkloadBalance(d, devs);
    });
    const blockedDevelopers = devs
      .filter((d) => Number(d.blockedCount) > 0)
      .sort((a, b) => Number(b.blockedCount) - Number(a.blockedCount));
    const statusPart = sprintTaskStatusRows(_statusCounts);
    const totalTasks = TASK_STATUS_ORDER.reduce((acc, k) => acc + (_statusCounts[k] ?? 0), 0);
    const totalCompleted = _statusCounts.DONE ?? 0;
    const kpis = deriveKpisFromLiveData(
      id,
      _statusCounts,
      tasks,
      userTasks,
      taskSprintMap,
      rest.kpis,
    );
    return {
      ...rest,
      kpis,
      totalTasks,
      totalCompleted,
      developers: devs,
      blockedDevelopers,
      ...statusPart,
    };
  });
}

const fetchJsonNoCache = (url) => apiFetch(url);

function applyRosterProfilePictures(enrichedSprints, developers) {
  if (!Array.isArray(enrichedSprints) || !Array.isArray(developers)) return;
  const picByUserId = new Map();
  const picByName = new Map();
  developers.forEach((d) => {
    if (!d?.profilePicture) return;
    if (d.id != null) picByUserId.set(Number(d.id), d.profilePicture);
    if (d.name) picByName.set(normalizeDeveloperName(d.name), d.profilePicture);
  });
  enrichedSprints.forEach((sp) => {
    (sp.developers || []).forEach((dev) => {
      if (dev.profilePicture) return;
      if (dev.userId != null) {
        const pic = picByUserId.get(Number(dev.userId));
        if (pic) dev.profilePicture = pic;
      }
      if (!dev.profilePicture && dev.name) {
        const pic = picByName.get(normalizeDeveloperName(dev.name));
        if (pic) dev.profilePicture = pic;
      }
    });
  });
}

async function fetchLegacyDashboardPayload(projectId) {
  const base = getApiBase();
  const sprintsUrl = `${base}/api/sprints?projectId=${encodeURIComponent(projectId)}`;
  const tasksUrl = `${base}/api/tasks?projectId=${encodeURIComponent(projectId)}`;
  const userTasksUrl = `${base}/api/user-tasks?projectId=${encodeURIComponent(projectId)}`;
  const developersUrl = `${base}/api/projects/${encodeURIComponent(projectId)}/developers`;

  const [sprintsRes, tasksRes, userTasksRes, developersRes] = await Promise.all([
    fetchJsonNoCache(sprintsUrl),
    fetchJsonNoCache(tasksUrl),
    fetchJsonNoCache(userTasksUrl),
    fetchJsonNoCache(developersUrl).catch(() => ({ ok: false })),
  ]);

  const status = [sprintsRes.status, tasksRes.status, userTasksRes.status].find((s) => s >= 400);
  if (status) {
    const err = new Error(`Failed to load data (HTTP ${status})`);
    err.httpStatus = status;
    if (isUnauthorizedHttpStatus(status)) {
      err.code = 'UNAUTHORIZED';
      err.userMessage = getSessionExpiredMessage();
    }
    throw err;
  }

  const developers = developersRes?.ok ? await developersRes.json() : [];
  return {
    sprints: await sprintsRes.json(),
    tasks: await tasksRes.json(),
    userTasks: await userTasksRes.json(),
    developers: Array.isArray(developers) ? developers : [],
  };
}

async function fetchProjectDashboardBundle(projectId) {
  const base = getApiBase();
  const url = `${base}/api/projects/${encodeURIComponent(projectId)}/dashboard-bundle`;
  const res = await fetchJsonNoCache(url);
  if (res.ok) {
    return res.json();
  }
  if (isUnauthorizedHttpStatus(res.status)) {
    const err = new Error(`Failed to load dashboard bundle (HTTP ${res.status})`);
    err.httpStatus = res.status;
    err.code = 'UNAUTHORIZED';
    err.userMessage = getSessionExpiredMessage();
    throw err;
  }
  // Prod may be on an older backend (404) or bundle auth/data issues — fall back to legacy APIs.
  if (res.status === 403 || res.status === 404 || res.status >= 500) {
    console.warn(
      `Dashboard bundle unavailable (HTTP ${res.status}); falling back to legacy project APIs.`,
    );
    return fetchLegacyDashboardPayload(projectId);
  }
  const err = new Error(`Failed to load dashboard bundle (HTTP ${res.status})`);
  err.httpStatus = res.status;
  throw err;
}

function storeBundleInCache(pid, bundle, now) {
  const apiSprints = Array.isArray(bundle?.sprints) ? bundle.sprints : [];
  const apiTasks = Array.isArray(bundle?.tasks) ? bundle.tasks : [];
  const apiUserTasks = Array.isArray(bundle?.userTasks) ? bundle.userTasks : [];
  const apiDevelopers = Array.isArray(bundle?.developers) ? bundle.developers : [];

  cachedData = {
    sprints: apiSprints,
    tasks: apiTasks,
    userTasks: apiUserTasks,
    developers: apiDevelopers,
    enrichedSprints: null,
    timestamp: now,
    projectId: pid,
  };

  const sortedSprints = [...apiSprints].sort((a, b) => Number(a.id) - Number(b.id));
  const mapped = sortedSprints.map((sprint, index) => mapApiSprint(sprint, index));
  let enriched;
  try {
    enriched = enrichSprintsWithUserTasks(mapped, apiTasks, apiUserTasks);
  } catch (e) {
    console.error(
      'enrichSprintsWithUserTasks failed, using sprints without user-task rollups:',
      e,
    );
    enriched = mapped;
  }
  applyRosterProfilePictures(enriched, apiDevelopers);
  assignSprintAccentColors(enriched);
  cachedData.enrichedSprints = enriched;
  writeSessionBundleCache(pid);
  return enriched;
}

function isCacheValidForProject(pid, now, forceFresh) {
  return (
    !forceFresh &&
    cachedData.sprints &&
    cachedData.tasks &&
    cachedData.userTasks &&
    cachedData.projectId === pid &&
    now - cachedData.timestamp < CACHE_TTL
  );
}

/** Synchronous snapshot for stale-while-revalidate UI (no network). */
export function getCachedBundleSnapshot(projectId) {
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  if (!pid) {
    return null;
  }
  if (!isCacheValidForProject(pid, Date.now(), false)) {
    hydrateMemoryCacheFromSession(pid);
  }
  if (!isCacheValidForProject(pid, Date.now(), false)) {
    return null;
  }
  return {
    sprints: cachedData.sprints,
    tasks: cachedData.tasks,
    userTasks: cachedData.userTasks,
    developers: cachedData.developers,
    enrichedSprints: cachedData.enrichedSprints,
    taskCount: Array.isArray(cachedData.tasks) ? cachedData.tasks.length : 0,
    timestamp: cachedData.timestamp,
  };
}

/** Developers from the last dashboard bundle (one profile picture per person). */
export function getCachedDevelopersSnapshot(projectId) {
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  if (!pid || !isCacheValidForProject(pid, Date.now(), false)) {
    return null;
  }
  if (!Array.isArray(cachedData.developers)) {
    return null;
  }
  return {
    developers: cachedData.developers,
    timestamp: cachedData.timestamp,
  };
}

/**
 * Returns raw API arrays (sprints, tasks, userTasks) using the same cache as fetchDashboardSprints.
 */
export async function fetchProjectBundleRaw(projectId, options = {}) {
  const forceFresh = shouldBypassClientCache(options);
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  if (!pid) {
    return { sprints: [], tasks: [], userTasks: [] };
  }

  const now = Date.now();
  if (isCacheValidForProject(pid, now, forceFresh)) {
    return {
      sprints: cachedData.sprints,
      tasks: cachedData.tasks,
      userTasks: cachedData.userTasks,
    };
  }

  await fetchDashboardSprints(pid, options);
  return {
    sprints: cachedData.sprints ?? [],
    tasks: cachedData.tasks ?? [],
    userTasks: cachedData.userTasks ?? [],
  };
}

/** Tasks from bundle cache when warm; otherwise loads the bundle once. */
export async function fetchCachedProjectTasks(projectId, options = {}) {
  const { tasks } = await fetchProjectBundleRaw(projectId, options);
  return Array.isArray(tasks) ? tasks : [];
}

export async function fetchDashboardSprints(projectId, options = {}) {
  const forceFresh = shouldBypassClientCache(options);
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  if (!pid) {
    return [];
  }

  const now = Date.now();
  if (!forceFresh && !isCacheValidForProject(pid, now, false)) {
    hydrateMemoryCacheFromSession(pid);
  }

  if (isCacheValidForProject(pid, now, forceFresh)) {
    if (Array.isArray(cachedData.enrichedSprints)) {
      return cachedData.enrichedSprints;
    }
    const sortedCached = [...cachedData.sprints].sort((a, b) => Number(a.id) - Number(b.id));
    const mapped = sortedCached.map((sprint, index) => mapApiSprint(sprint, index));
    const enriched = enrichSprintsWithUserTasks(mapped, cachedData.tasks, cachedData.userTasks);
    assignSprintAccentColors(enriched);
    cachedData.enrichedSprints = enriched;
    return enriched;
  }

  try {
    const bundle = await fetchProjectDashboardBundle(pid);
    return storeBundleInCache(pid, bundle, now);
  } catch (error) {
    console.error('Dashboard data load failed:', error);
    throw error;
  }
}

function rebuildEnrichedSprintsFromCache() {
  if (!Array.isArray(cachedData.sprints)) {
    cachedData.enrichedSprints = [];
    return;
  }
  const sortedSprints = [...cachedData.sprints].sort((a, b) => Number(a.id) - Number(b.id));
  const mapped = sortedSprints.map((sprint, index) => mapApiSprint(sprint, index));
  try {
    cachedData.enrichedSprints = enrichSprintsWithUserTasks(
      mapped,
      cachedData.tasks || [],
      cachedData.userTasks || [],
    );
  } catch (e) {
    console.error('rebuildEnrichedSprintsFromCache failed:', e);
    cachedData.enrichedSprints = mapped;
  }
  assignSprintAccentColors(cachedData.enrichedSprints);
}

function userTaskRowKey(ut) {
  const tid = resolveUserTaskTaskId(ut);
  const uid = resolveUserTaskUserId(ut);
  if (tid == null || uid == null) return null;
  return `${Number(tid)}:${Number(uid)}`;
}

/** Instant dashboard/KPI update after a local delete (before network refresh). */
export function applyOptimisticTaskDeleted(projectId, taskId) {
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  const tid = Number(taskId);
  if (!pid || !Number.isFinite(tid)) return null;
  if (!isCacheValidForProject(pid, Date.now(), false)) return null;

  cachedData.tasks = (cachedData.tasks || []).filter((t) => Number(t?.id) !== tid);
  cachedData.userTasks = (cachedData.userTasks || []).filter((ut) => {
    const utTid = resolveUserTaskTaskId(ut);
    return utTid == null || Number(utTid) !== tid;
  });
  cachedData.timestamp = Date.now();
  rebuildEnrichedSprintsFromCache();
  return getCachedBundleSnapshot(pid);
}

/** Instant dashboard/KPI update after a local create (before network refresh). */
export function applyOptimisticTaskCreated(projectId, task, userTasks = []) {
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  const tid = Number(task?.id);
  if (!pid || !Number.isFinite(tid)) return null;
  if (!isCacheValidForProject(pid, Date.now(), false)) return null;

  const tasks = Array.isArray(cachedData.tasks) ? [...cachedData.tasks] : [];
  if (!tasks.some((t) => Number(t?.id) === tid)) {
    tasks.unshift(task);
  }
  cachedData.tasks = tasks;

  const existingKeys = new Set((cachedData.userTasks || []).map(userTaskRowKey).filter(Boolean));
  const extraRows = Array.isArray(userTasks) ? userTasks : [];
  const mergedUserTasks = [...(cachedData.userTasks || [])];
  for (const ut of extraRows) {
    const key = userTaskRowKey(ut);
    if (!key || existingKeys.has(key)) continue;
    existingKeys.add(key);
    mergedUserTasks.push(ut);
  }
  cachedData.userTasks = mergedUserTasks;
  cachedData.timestamp = Date.now();
  rebuildEnrichedSprintsFromCache();
  return getCachedBundleSnapshot(pid);
}

/** Instant Kanban/dashboard update after a local task save (status, hours, assignee sync). */
export function applyOptimisticTaskUpdated(projectId, task, meta = {}) {
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  const tid = Number(task?.id);
  if (!pid || !Number.isFinite(tid)) return null;

  if (cachedData.projectId !== pid) {
    if (!Array.isArray(cachedData.tasks) && !Array.isArray(cachedData.userTasks)) {
      return null;
    }
    cachedData.projectId = pid;
  }

  cachedData.tasks = (cachedData.tasks || []).map((t) =>
    Number(t?.id) === tid ? { ...t, ...task } : t,
  );
  if (!cachedData.tasks.some((t) => Number(t?.id) === tid) && task) {
    cachedData.tasks = [task, ...cachedData.tasks];
  }

  if (meta?.syncAssignmentStatuses && meta.assignmentStatus != null) {
    const targetUserId =
      meta.userId != null && Number.isFinite(Number(meta.userId)) ? Number(meta.userId) : null;
    const hours =
      meta.workedHours != null && Number.isFinite(Number(meta.workedHours))
        ? Number(meta.workedHours)
        : null;
    cachedData.userTasks = (cachedData.userTasks || []).map((ut) => {
      const utTid = resolveUserTaskTaskId(ut);
      if (Number(utTid) !== tid) return ut;
      const uid = resolveUserTaskUserId(ut);
      if (targetUserId != null && uid !== targetUserId) return ut;
      const next = { ...ut, status: meta.assignmentStatus };
      if (hours != null) {
        next.workedHours = hours;
        next.worked_hours = hours;
        next.hours = hours;
      }
      return next;
    });
  }

  cachedData.timestamp = Date.now();
  writeSessionBundleCache(pid);
  rebuildEnrichedSprintsFromCache();
  return getCachedBundleSnapshot(pid);
}

// Export function to manually invalidate cache when data changes
export function invalidateDashboardCache() {
  const prevPid = cachedData.projectId;
  cachedData = {
    sprints: null,
    tasks: null,
    userTasks: null,
    developers: null,
    enrichedSprints: null,
    timestamp: 0,
    projectId: null,
  };
  if (prevPid) clearSessionBundleCache(prevPid);
  if (process.env.NODE_ENV !== 'test') {
    console.log('Dashboard cache invalidated');
  }
}

export function shortDevName(fullName) {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}

export function normalizeDeveloperName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

const TASK_STATUS_KEYS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const MERGE_STATUS_META = {
  TODO: { name: 'To Do', color: '#FFC107' },
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

/**
 * Flat list of blocked assignments for header notifications (from enriched sprint.blockedDevelopers).
 */
export function buildBlockedTaskNotificationItems(selectedSprints) {
  const seen = new Set();
  const items = [];
  (selectedSprints || []).forEach((sp) => {
    const sprintLabel = sp.shortLabel ?? sp.name ?? `Sprint ${sp.id}`;
    const sid = Number(sp.id);
    (sp.blockedDevelopers || []).forEach((dev) => {
      const developerName = String(dev?.name || '').trim();
      if (!developerName) return;
      (dev.blockedTasks || []).forEach((t) => {
        const taskId = Number(t?.id);
        const taskTitle = String(
          t?.title || (Number.isFinite(taskId) ? `Task #${taskId}` : 'Task'),
        ).trim();
        const key = `${Number.isFinite(sid) ? sid : 'sp'}::${developerName}::${Number.isFinite(taskId) ? taskId : taskTitle}`;
        if (seen.has(key)) return;
        seen.add(key);
        const blockedReason = String(t?.blockedReason || '').trim();
        items.push({
          key,
          sprintId: Number.isFinite(sid) ? sid : null,
          sprintLabel,
          developerName,
          taskId: Number.isFinite(taskId) ? taskId : null,
          taskTitle,
          blockedSince: t?.blockedSince ?? null,
          blockedReason: blockedReason || null,
        });
      });
    });
  });
  items.sort((a, b) => {
    const ma = parseBlockedSinceEpochMs(a.blockedSince);
    const mb = parseBlockedSinceEpochMs(b.blockedSince);
    if (ma != null && mb != null && ma !== mb) return mb - ma;
    if (ma != null && mb == null) return -1;
    if (ma == null && mb != null) return 1;
    const c = String(a.developerName).localeCompare(String(b.developerName));
    if (c !== 0) return c;
    return String(a.taskTitle).localeCompare(String(b.taskTitle));
  });
  return items;
}

/**
 * Per-sprint rows for AI (developer-variation): assignee who reported the block on USER_TASK + task + reason.
 */
export function buildBlockedReportsForAiSprint(sp) {
  const out = [];
  (sp?.blockedDevelopers || []).forEach((dev) => {
    const reportedByDeveloperName = String(dev?.name || '').trim();
    if (!reportedByDeveloperName) return;
    (dev.blockedTasks || []).forEach((t) => {
      const taskId = Number(t?.id);
      out.push({
        reportedByDeveloperName,
        taskId: Number.isFinite(taskId) ? taskId : null,
        taskTitle: String(t?.title || (Number.isFinite(taskId) ? `Task #${taskId}` : '')).trim(),
        blockedReason: String(t?.blockedReason || '').trim(),
      });
    });
  });
  return out;
}

/** Full sprint roster for workload parity (not the filtered developer subset). */
function buildTeamContextForWorkload(selectedSprints = []) {
  if (selectedSprints.length === 1) {
    return (selectedSprints[0].developers || []).map((dev) => ({
      assigned: dev.assigned,
      completed: dev.completed,
      hours: dev.hours,
    }));
  }
  const teamMap = new Map();
  selectedSprints.forEach((sp) => {
    (sp.developers || []).forEach((dev) => {
      const key = normalizeDeveloperName(dev.name);
      const cur = teamMap.get(key) || { assigned: 0, completed: 0, hours: 0 };
      cur.assigned += Number(dev.assigned) || 0;
      cur.completed += Number(dev.completed) || 0;
      cur.hours += Number(dev.hours) || 0;
      teamMap.set(key, cur);
    });
  });
  return Array.from(teamMap.values());
}

/**
 * Keep donut / scorecard workload in sync with DeveloperTable sprint columns.
 * Table uses per-sprint workload vs the full team; filtering to one developer must not
 * recompute against a team of one (which always yields 100%).
 */
function resolveAggregatedDeveloperWorkload(dev, selectedSprints = []) {
  const perSprintValues = [];
  selectedSprints.forEach((sp) => {
    const sprintDev = (sp.developers || []).find(
      (x) => normalizeDeveloperName(x.name) === normalizeDeveloperName(dev.name),
    );
    if (sprintDev == null || typeof sprintDev.workload !== 'number') return;
    const hasActivity =
      Math.max(0, Number(sprintDev.assigned) || 0) > 0 ||
      Math.max(0, Number(sprintDev.hours) || 0) > 0;
    if (hasActivity) perSprintValues.push(sprintDev.workload);
  });
  if (perSprintValues.length) {
    return Math.round(perSprintValues.reduce((sum, n) => sum + n, 0) / perSprintValues.length);
  }
  return computeIndividualWorkloadBalance(dev, buildTeamContextForWorkload(selectedSprints));
}

export function aggregateSelectionMetrics(
  selectedSprints,
  projectDevelopers = [],
  selectedDeveloperName = null,
) {
  const selectedDeveloperKey = normalizeDeveloperName(selectedDeveloperName);
  let totalTasks = 0;
  let totalCompleted = 0;
  let totalHours = 0;
  const devMap = new Map();

  (selectedSprints || []).forEach((sp) => {
    if (!selectedDeveloperKey) {
      totalTasks += Number(sp.totalTasks) || 0;
      totalCompleted += Number(sp.totalCompleted) || 0;
      totalHours += Number(sp.totalHours) || 0;
    }
    (sp.developers || []).forEach((d) => {
      if (selectedDeveloperKey && normalizeDeveloperName(d.name) !== selectedDeveloperKey) {
        return;
      }
      if (selectedDeveloperKey) {
        totalTasks += Number(d.assigned) || 0;
        totalCompleted += Number(d.completed) || 0;
        totalHours += Number(d.hours) || 0;
      }
      const cur = devMap.get(d.name) || {
        name: d.name,
        assigned: 0,
        completed: 0,
        hours: 0,
        assignedHoursEstimate: 0,
        onTime: d.onTime,
        workload: 0,
        profilePicture: d.profilePicture ?? null,
        userId: d.userId ?? null,
        initials: d.initials,
      };
      cur.assigned += Number(d.assigned) || 0;
      cur.completed += Number(d.completed) || 0;
      cur.hours += Number(d.hours) || 0;
      cur.assignedHoursEstimate += Number(d.assignedHoursEstimate) || 0;
      devMap.set(d.name, cur);
    });
  });

  const activityDevelopers = Array.from(devMap.values()).map((d) => {
    const assigned = d.assigned ?? 0;
    const completed = d.completed ?? 0;
    return {
      ...d,
      shortName: shortDevName(d.name),
      pending: Math.max(0, assigned - completed),
    };
  });
  activityDevelopers.forEach((d) => {
    d.workload = resolveAggregatedDeveloperWorkload(d, selectedSprints);
  });

  const mergedDevelopers = mergeRosterWithSprintDevelopers(projectDevelopers, activityDevelopers);
  const developers = selectedDeveloperKey
    ? mergedDevelopers.filter((d) => normalizeDeveloperName(d.name) === selectedDeveloperKey)
    : mergedDevelopers;
  const uniqueDevCount = selectedDeveloperKey ? developers.length : devMap.size;
  const avgTasksPerDev = uniqueDevCount > 0 ? totalTasks / uniqueDevCount : 0;
  const sumDevWorkedHours = Array.from(devMap.values()).reduce(
    (s, d) => s + (Number(d.hours) || 0),
    0,
  );
  const avgHoursPerDev = uniqueDevCount > 0 ? sumDevWorkedHours / uniqueDevCount : 0;
  /** Unique tasks in the selection (not per-assignee sums — one task with 2 devs counts once). */
  const totalAssigned = totalTasks;

  return {
    totalTasks,
    totalAssigned,
    totalCompleted,
    totalHours,
    uniqueDevCount,
    avgTasksPerDev,
    avgHoursPerDev,
    developers,
  };
}

/**
 * Average worked hours per developer in one sprint: sprint total (USER_TASK) ÷ developer count.
 */
export function avgHoursPerDeveloper(sprint) {
  const devs = sprint?.developers;
  const n = Array.isArray(devs) ? devs.length : 0;
  if (!n) return 0;
  const worked = Number(sprint.totalHours ?? 0);
  return Number((worked / n).toFixed(1));
}

/**
 * Average tasks per developer in one sprint: unique sprint tasks ÷ developers with activity.
 */
export function avgTasksPerDeveloper(sprint) {
  const devs = sprint?.developers;
  const n = Array.isArray(devs) ? devs.length : 0;
  if (!n) return 0;
  const tasks = Number(sprint.totalTasks ?? 0);
  return Number((tasks / n).toFixed(2));
}

/**
 * Per-sprint average tasks/hours per developer for multi-sprint scorecard trend lines.
 */
export function buildDeveloperAverageTrendSeries(
  selectedSprints,
  { selectedDeveloperName = null } = {},
) {
  const selectedDeveloperKey = normalizeDeveloperName(selectedDeveloperName);
  const chronological = [...(selectedSprints || [])]
    .filter(Boolean)
    .sort((a, b) => {
      const ta = new Date(a?.startDate ?? 0).getTime();
      const tb = new Date(b?.startDate ?? 0).getTime();
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return sprintDbIdSortKey(a) - sprintDbIdSortKey(b);
    });

  const series = chronological.map((sp, index) => {
    if (selectedDeveloperKey) {
      const dev = (sp.developers || []).find(
        (row) => normalizeDeveloperName(row?.name) === selectedDeveloperKey,
      );
      return {
        sprintLabel: sp?.shortLabel || `S${sp?.id ?? index + 1}`,
        avgTasksPerDev: Number(dev?.assigned) || 0,
        avgHoursPerDev: Number(Number(dev?.hours ?? 0).toFixed(1)),
      };
    }
    return {
      sprintLabel: sp?.shortLabel || `S${sp?.id ?? index + 1}`,
      avgTasksPerDev: avgTasksPerDeveloper(sp),
      avgHoursPerDev: avgHoursPerDeveloper(sp),
    };
  });

  if (chronological.length < 2) {
    return { avgTasksTrend: null, avgHoursTrend: null, series };
  }

  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  return {
    avgTasksTrend: { delta: current.avgTasksPerDev - previous.avgTasksPerDev },
    avgHoursTrend: { delta: current.avgHoursPerDev - previous.avgHoursPerDev },
    series,
  };
}

export function completionRate(dev) {
  if (!dev.assigned) return 0;
  return Math.round((dev.completed / dev.assigned) * 100);
}

export function buildGroupedCompletedData(selectedSprints, projectDevelopers = []) {
  const names = collectDeveloperNamesForSelection(selectedSprints, projectDevelopers);
  return names.map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = (sp.developers || []).find((d) => d.name === name);
      row[`${sp.shortLabel}_c`] = dev ? dev.completed : 0;
    });
    return row;
  });
}

export function buildGroupedHoursData(selectedSprints, projectDevelopers = []) {
  const names = collectDeveloperNamesForSelection(selectedSprints, projectDevelopers);
  return names.map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = (sp.developers || []).find((d) => d.name === name);
      row[`${sp.shortLabel}_h`] = dev ? dev.hours : 0;
    });
    return row;
  });
}

export function buildGroupedWorkloadData(selectedSprints, projectDevelopers = []) {
  const names = collectDeveloperNamesForSelection(selectedSprints, projectDevelopers);
  return names.map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = (sp.developers || []).find((d) => d.name === name);
      row[`${sp.shortLabel}_w`] = dev ? (dev.workload ?? 0) : 0;
    });
    return row;
  });
}

/**
 * Ascending sprint primary key from the DB (`id`). Does not parse "Sprint N" labels — those can
 * disagree with PK order and produce 0,2,1 style column order.
 */
export function sprintDbIdSortKey(sp) {
  const n = Number(sp?.id);
  if (Number.isFinite(n)) return n;
  const parsed = Number(String(sp?.id ?? '').match(/-?\d+/)?.[0]);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * Team productivity score (%) per sprint — same formula as KPI Analytics.
 * @param {object[]} selectedSprints
 */
export function buildTeamProductivityTrendSeries(selectedSprints) {
  const sprints = [...(selectedSprints || [])].filter(Boolean).sort((a, b) => {
    const ta = new Date(a?.startDate ?? 0).getTime();
    const tb = new Date(b?.startDate ?? 0).getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return sprintDbIdSortKey(a) - sprintDbIdSortKey(b);
  });

  return sprints.map((sp, idx) => {
    const kpis = sp.kpis ?? {};
    const productivityScore = productivityScoreFromSprintKpis(kpis);
    return {
      sprintId: sp.id,
      sprintLabel: sp.shortLabel ?? `Sprint ${idx}`,
      accentColor: sp.accentColor,
      productivityScore,
      scoreDisplay: `${productivityScore}%`,
      completionRate: Number(kpis.completionRate) || 0,
      onTimeDelivery: Number(kpis.onTimeDelivery) || 0,
      efficiencyScore: Number(kpis.efficiencyScore) || 0,
      workloadBalance: Number(kpis.workloadBalance) || 0,
      totalCompleted: Number(sp.totalCompleted) || 0,
      totalTasks: Number(sp.totalTasks) || 0,
    };
  });
}

export function buildCompareDeveloperChartsModel(
  selectedSprints,
  projectDevelopers = [],
  selectedDeveloperName = null,
) {
  const selectedDeveloperKey = normalizeDeveloperName(selectedDeveloperName);
  const sprints = [...(selectedSprints || [])]
    .filter(Boolean)
    .sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b));
  if (sprints.length < 2) return null;

  const sprintDefs = sprints.map((sp, idx) => ({
    id: Number(sp.id),
    shortLabel: sp.shortLabel ?? `Sprint ${idx}`,
    accentColor: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
  }));

  let names = collectDeveloperNamesForSelection(sprints, projectDevelopers);
  if (selectedDeveloperKey) {
    names = names.filter((name) => normalizeDeveloperName(name) === selectedDeveloperKey);
  }

  const baseRows = names.map((fullName) => {
    const row = { name: fullName, shortName: shortDevName(fullName) };
    sprints.forEach((sp) => {
      const dev = (sp.developers || []).find((d) => d.name === fullName);
      const assigned = Number(dev?.assigned) || 0;
      const completedRaw = Number(dev?.completed) || 0;
      const completed = Math.min(completedRaw, assigned);
      const open = Math.max(0, assigned - completed);
      const hours = Number(dev?.hours) || 0;
      const estH = Number(dev?.assignedHoursEstimate) || 0;
      const id = Number(sp.id);
      /** Grouped hours: worked (USER_TASK) vs assigned total (TASK estimate). */
      const hw = hours;
      const ha = estH;
      row[`wc_${id}`] = completed;
      row[`wo_${id}`] = open;
      row[`hr_${id}`] = hours;
      row[`hw_${id}`] = hw;
      row[`ha_${id}`] = ha;
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

  let developerDefs = names.map((fullName) => ({
    fullName,
    shortName: shortDevName(fullName),
    accentColor: developerAvatarColors(fullName).color,
  }));
  developerDefs.sort((a, b) => {
    const rowA = baseRows.find((r) => r.name === a.fullName);
    const rowB = baseRows.find((r) => r.name === b.fullName);
    const diff = sumWorkload(rowB) - sumWorkload(rowA);
    return diff !== 0 ? diff : String(a.fullName).localeCompare(String(b.fullName));
  });
  developerDefs = developerDefs.map((dev, idx) => ({ ...dev, id: idx }));

  const sprintWorkloadRows = sprints.map((sp, idx) => {
    const row = {
      sprintId: Number(sp.id),
      shortLabel: sp.shortLabel ?? `Sprint ${idx}`,
      accentColor: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
      name: sp.shortLabel ?? `Sprint ${idx}`,
    };
    developerDefs.forEach((dev) => {
      const devData = (sp.developers || []).find((d) => d.name === dev.fullName);
      const assigned = Number(devData?.assigned) || 0;
      const completedRaw = Number(devData?.completed) || 0;
      const completed = Math.min(completedRaw, assigned);
      const open = Math.max(0, assigned - completed);
      row[`wc_${dev.id}`] = completed;
      row[`wo_${dev.id}`] = open;
    });
    return row;
  });

  const sprintHoursRows = sprints.map((sp, idx) => {
    const row = {
      sprintId: Number(sp.id),
      shortLabel: sp.shortLabel ?? `Sprint ${idx}`,
      accentColor: sp.accentColor ?? SPRINT_CHART_COLORS[idx % SPRINT_CHART_COLORS.length],
      name: sp.shortLabel ?? `Sprint ${idx}`,
    };
    developerDefs.forEach((dev) => {
      const devData = (sp.developers || []).find((d) => d.name === dev.fullName);
      row[`hw_${dev.id}`] = Number(devData?.hours) || 0;
      row[`ha_${dev.id}`] = Number(devData?.assignedHoursEstimate) || 0;
    });
    return row;
  });

  return {
    sprintDefs,
    developerDefs,
    workloadRows,
    hoursRows,
    comboRows,
    sprintWorkloadRows,
    sprintHoursRows,
  };
}

export const DEVELOPER_DISPLAY_NAME = {};
export const DEFINED_DEVELOPER_IDS = [];
export const DEFAULT_SELECTED_SPRINT_IDS_FALLBACK = [];
export let DASHBOARD_SPRINTS = [];
export let SPRINTS_FOR_SELECTOR = [];
