import { isUserTaskAssigneeComplete } from './taskUtils';

export function toTimeMs(value) {
  if (value == null || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Compare on calendar day (UTC) so due-date at midnight is not "late" same afternoon. */
export function calendarDayIndexUtc(ms) {
  if (ms == null || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function isCompletionOnOrBeforeDueDay(doneMs, dueMs) {
  if (dueMs == null || doneMs == null) return null;
  const dueDay = calendarDayIndexUtc(dueMs);
  const doneDay = calendarDayIndexUtc(doneMs);
  if (dueDay == null || doneDay == null) return null;
  return doneDay <= dueDay;
}

/**
 * When the assignee finished their part (not when the whole TASK was closed).
 * Uses USER_TASK.completedAt when present; for legacy rows, updatedAt then task.finishDate (single assignee).
 */
export function assigneeCompletionTimeMs(ut, taskMeta = {}) {
  if (!isUserTaskAssigneeComplete(ut)) return null;
  const fromRow = toTimeMs(ut?.completedAt ?? ut?.completed_at);
  if (fromRow != null) return fromRow;

  const assigneeCount = Number(taskMeta.assigneeCount ?? 1);
  if (assigneeCount <= 1) {
    return toTimeMs(taskMeta.finishDate ?? taskMeta.finish_date);
  }

  const legacy = toTimeMs(ut?.updatedAt ?? ut?.updated_at ?? ut?.createdAt ?? ut?.created_at);
  return legacy;
}

/** true = on time, false = late, null = unknown / not completed */
export function isAssigneeCompletionOnTime(ut, taskDueDate, taskMeta = {}) {
  const dueMs = toTimeMs(taskDueDate);
  const doneMs = assigneeCompletionTimeMs(ut, taskMeta);
  if (dueMs == null || doneMs == null) return null;
  return isCompletionOnOrBeforeDueDay(doneMs, dueMs);
}

export function onTimeLabelFromResult(result) {
  if (result === true) return 'Yes';
  if (result === false) return 'No';
  return '—';
}

/** All assignees marked their USER_TASK complete. */
export function allAssigneesComplete(taskUserTasks = []) {
  const rows = Array.isArray(taskUserTasks) ? taskUserTasks : [];
  return rows.length > 0 && rows.every(isUserTaskAssigneeComplete);
}

/** Task closed when every assignee is done; uses TASK.finishDate vs dueDate (calendar day). */
export function taskTeamCompletionOnTime(task) {
  const finishMs = toTimeMs(task?.finishDate ?? task?.finish_date);
  const dueMs = toTimeMs(task?.dueDate ?? task?.due_date);
  return isCompletionOnOrBeforeDueDay(finishMs, dueMs);
}

/** Per-assignee label for Task Details (always show delivery state when complete). */
export function assigneeDeliveryStatus(ut, taskDueDate, taskMeta = {}) {
  if (!isUserTaskAssigneeComplete(ut)) {
    return { complete: false, label: 'Pending', tone: 'pending', completedAt: null };
  }
  const completedAt = ut?.completedAt ?? ut?.completed_at ?? null;
  const onTime = isAssigneeCompletionOnTime(ut, taskDueDate, taskMeta);
  if (onTime === true) {
    return { complete: true, label: 'On time', tone: 'onTime', completedAt };
  }
  if (onTime === false) {
    return { complete: true, label: 'Late', tone: 'late', completedAt };
  }
  return {
    complete: true,
    label: 'Completed',
    tone: 'unknown',
    completedAt,
    hint: 'Re-open and complete again to record delivery time',
  };
}

function assigneeProgressOnTimeResult(row, dueDate, taskMeta) {
  if (!row?.completed) return null;
  return isAssigneeCompletionOnTime(
    { status: 'COMPLETED', completedAt: row.completedAt },
    dueDate,
    taskMeta,
  );
}

/**
 * Multi-assignee task: on time only if every assignee finished and each was on time.
 * Returns true | false | null (pending or unknown — not "late").
 */
export function multiAssigneeTaskOnTime(assigneeProgress, dueDate, taskMeta = {}) {
  const progress = Array.isArray(assigneeProgress) ? assigneeProgress : [];
  if (progress.length <= 1) return null;

  if (!progress.every((row) => row.completed)) return null;

  const results = progress.map((row) => assigneeProgressOnTimeResult(row, dueDate, taskMeta));
  if (results.some((r) => r === false)) return false;
  if (results.every((r) => r === true)) return true;
  return null;
}

/** Manager task row: per-assignee on-time when multiple developers are assigned. */
export function taskOnTimeDisplayForManager(item) {
  const progress = Array.isArray(item?.assigneeProgress) ? item.assigneeProgress : [];
  const dueDate = item?.dueDate;
  const taskMeta = {
    finishDate: item?.completedAt ?? item?.completed_at,
    assigneeCount: progress.length > 0 ? progress.length : item?.developers?.length || 1,
  };

  if (progress.length > 1) {
    const teamOnTime = multiAssigneeTaskOnTime(progress, dueDate, taskMeta);
    if (teamOnTime === true) return 'Yes';
    if (teamOnTime === false) return 'No';
    if (!item?.done && !isCompletedStatus(item)) return '—';
    return 'No';
  }

  if (progress.length === 1) {
    const r = assigneeProgressOnTimeResult(progress[0], dueDate, taskMeta);
    if (r === true) return 'Yes';
    if (r === false) return 'No';
    if (!progress[0].completed) return '—';
    return '—';
  }

  const dueMs = toTimeMs(dueDate);
  const finishMs = toTimeMs(taskMeta.finishDate);
  if (!item?.done && !isCompletedStatus(item)) return '—';
  if (dueMs == null || finishMs == null) return '—';
  return isCompletionOnOrBeforeDueDay(finishMs, dueMs) ? 'Yes' : 'No';
}

function isCompletedStatus(item) {
  const st = String(item?.statusRaw ?? item?.status ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return st === 'DONE' || st === 'COMPLETED';
}
