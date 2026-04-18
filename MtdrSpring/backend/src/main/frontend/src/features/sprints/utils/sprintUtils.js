import { normalizeUserId } from '../../../utils/userIds';
import { ORACLE_RED_ACTION } from '../constants/sprintConstants';

export function oracleRgba(a) {
  return `rgba(199, 70, 52, ${a})`;
}

export const PLANNING_CARD_SX = {
  p: 2.25,
  borderRadius: 2,
  bgcolor: '#FFFFFF',
  border: `1px solid ${oracleRgba(0.22)}`,
  borderTop: `3px solid ${ORACLE_RED_ACTION}`,
  boxShadow: `0 2px 10px ${oracleRgba(0.06)}`,
};

export function newSprintDialogFieldOutline() {
  const accent = ORACLE_RED_ACTION;
  return {
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.35)' },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.55)' },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: accent },
    '& .MuiInputLabel-root': { color: '#616161' },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
    '& .MuiSelect-icon': { color: '#616161' },
  };
}

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toInputDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/**
 * Active project id from props + localStorage. Treats empty-string prop as missing so we
 * still use localStorage (otherwise `??` skips localStorage and /api/sprints loads everything).
 */
export function resolveActiveProjectIdNum(projectIdProp) {
  const trim = (v) => (v == null ? '' : String(v).trim());
  const fromProp = trim(projectIdProp);
  const fromLs =
    typeof localStorage !== 'undefined' ? trim(localStorage.getItem('currentProjectId')) : '';
  const raw = fromProp !== '' ? fromProp : fromLs;
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const fetchJsonNoStore = (url) =>
  fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });

/**
 * Sprint dates from the API are typically midnight at day boundaries. Comparing `now` to that
 * instant makes the due day read as "already past" for almost the whole calendar day, so new
 * sprints show as Completed. Use start-of-day / end-of-day in local time instead.
 */
function startOfLocalDay(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return x;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return x;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59, 999);
}

export function inferStatusByDate(sprint) {
  const now = new Date();
  const start = new Date(sprint.startDate);
  const due = new Date(sprint.dueDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) return 'planned';
  const rangeStart = startOfLocalDay(start);
  const rangeEnd = endOfLocalDay(due);
  if (now < rangeStart) return 'planned';
  if (now > rangeEnd) return 'completed';
  return 'active';
}

/**
 * Sprints page chip: combines calendar (like dashboard) with tasks.
 * - If the sprint window ended by date and not every task is DONE → active ("In progress").
 * - If the window ended and all tasks DONE → completed.
 * - While the window is future (planned) or current (active by date), status follows tasks:
 *   no tasks / none DONE → planned; some DONE → active; all DONE → completed.
 */
export function inferSprintStatus(sprint, allTasks) {
  const calendar = inferStatusByDate(sprint);
  const list = Array.isArray(allTasks) ? allTasks : [];
  const sprintId = Number(sprint?.id);
  if (!Number.isFinite(sprintId)) return 'planned';
  const sprintTasks = list.filter((t) => Number(t.assignedSprint?.id) === sprintId);
  const done = sprintTasks.filter((t) => String(t.status || '').toUpperCase() === 'DONE').length;
  const allDone = sprintTasks.length > 0 && done === sprintTasks.length;

  if (calendar === 'completed') {
    if (allDone) return 'completed';
    return 'active';
  }

  if (sprintTasks.length === 0) return 'planned';
  if (done === 0) return 'planned';
  if (allDone) return 'completed';
  return 'active';
}

function compareSprintsChronologically(a, b) {
  const ta = new Date(a?.startDate ?? 0).getTime();
  const tb = new Date(b?.startDate ?? 0).getTime();
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return Number(a?.id) - Number(b?.id);
}

/**
 * Default highlighted sprint on the Sprints page: calendar-active (same rule as dashboard),
 * or if none, the sprint after the most recently ended calendar window (carry-over work).
 */
export function pickDefaultSelectedSprint(sprints) {
  if (!Array.isArray(sprints) || sprints.length === 0) return null;
  const byChrono = [...sprints].sort(compareSprintsChronologically);
  const calendarActive = byChrono.find((s) => inferStatusByDate(s) === 'active');
  if (calendarActive) return calendarActive;

  const completed = byChrono.filter((s) => inferStatusByDate(s) === 'completed');
  if (completed.length > 0) {
    let latest = completed[0];
    let latestEnd = endOfLocalDay(new Date(latest.dueDate)).getTime();
    for (let i = 1; i < completed.length; i += 1) {
      const s = completed[i];
      const endMs = endOfLocalDay(new Date(s.dueDate)).getTime();
      if (endMs >= latestEnd) {
        latest = s;
        latestEnd = endMs;
      }
    }
    const idx = byChrono.findIndex((s) => Number(s.id) === Number(latest.id));
    if (idx >= 0 && idx + 1 < byChrono.length) {
      return byChrono[idx + 1];
    }
  }

  const firstPlanned = byChrono.find((s) => inferStatusByDate(s) === 'planned');
  if (firstPlanned) return firstPlanned;
  return sprints[0];
}

export function sortSprintsForDisplay(list, allTasks) {
  const rank = (s) => {
    const st = inferSprintStatus(s, allTasks);
    if (st === 'active') return 0;
    if (st === 'planned') return 1;
    return 2;
  };
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return b.id - a.id;
  });
}

export function taskDisplayName(task) {
  const t = typeof task.title === 'string' ? task.title.trim() : '';
  if (t) return t;
  const c = typeof task.classification === 'string' ? task.classification.trim() : '';
  return c || '—';
}

/** USER_TASK row: user id from nested user or embedded id.userId (API may omit lazy user). */
export function userIdFromUserTaskRow(row) {
  if (!row) return null;
  const u = row.user;
  const raw =
    u?.id ??
    u?.ID ??
    u?.userId ??
    row?.userId ??
    row?.USER_ID ??
    row?.id?.userId ??
    row?.id?.user_id;
  return normalizeUserId(raw);
}

/** Positive project id from prop, env, or null. */
export function normalizeProjectIdNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Project id from sprint JSON (matches backend Sprint → assignedProject). */
export function sprintProjectIdFromJson(s) {
  const raw = s?.assignedProject?.id ?? s?.assignedProject?.ID ?? s?.assignedProjectId;
  return normalizeProjectIdNum(raw);
}

/**
 * Project whose team populates "Assigned to": selected app project, else task sprint's project from JSON.
 */
export function resolveProjectIdForDevelopers(taskLike, sprintsList, parentProjectId) {
  const fromParent = normalizeProjectIdNum(parentProjectId);
  if (fromParent != null) return fromParent;
  if (!taskLike) return null;
  const nestedPid = normalizeProjectIdNum(
    taskLike.assignedSprint?.assignedProject?.id ?? taskLike.assignedSprint?.assignedProject?.ID,
  );
  if (nestedPid != null) return nestedPid;
  const sprintIdRaw =
    taskLike.assignedSprint?.id ??
    taskLike.assignedSprint?.ID ??
    taskLike.assignedSprintId ??
    taskLike.sprintId;
  const sprintId = sprintIdRaw != null && sprintIdRaw !== '' ? Number(sprintIdRaw) : null;
  if (sprintId == null || !Number.isFinite(sprintId) || !Array.isArray(sprintsList)) return null;
  const sp = sprintsList.find((s) => Number(s.id) === Number(sprintId));
  return sp ? sprintProjectIdFromJson(sp) : null;
}

export function sprintKpiNumber(sprint, key) {
  const v = sprint?.[key];
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
