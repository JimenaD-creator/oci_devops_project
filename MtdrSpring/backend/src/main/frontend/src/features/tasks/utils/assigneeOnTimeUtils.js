import { isUserTaskAssigneeComplete } from './taskUtils';

/** Must match backend {@code app.display.timezone} / DisplayTimezone.java */
export const DISPLAY_TIMEZONE = 'America/Mexico_City';

export function toTimeMs(value) {
  if (value == null || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function hasExplicitTimezone(iso) {
  return /[Zz]|[+-]\d{2}:?\d{2}$/.test(String(iso).trim());
}

/** Server stores USER_TASK.completedAt as UTC wall-clock in a naive LocalDateTime. */
export function parseNaiveUtcWallClockMs(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/.exec(String(iso).trim());
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

export function calendarDayInTimezone(utcMs, timeZone = DISPLAY_TIMEZONE) {
  if (utcMs == null || !Number.isFinite(utcMs)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(utcMs));
  const y = parts.find((p) => p.type === 'year')?.value;
  const mo = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return y && mo && d ? `${y}-${mo}-${d}` : null;
}

/** Due dates come from a date picker — the Y-M-D portion is authoritative. */
export function dueCalendarDayFromTaskDue(dueValue) {
  if (dueValue == null || dueValue === '') return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(dueValue).trim());
  if (m) return m[1];
  const ms = toTimeMs(dueValue);
  return ms != null ? calendarDayInTimezone(ms) : null;
}

export function completionCalendarDayFromAssignee(doneMs, completedAtIso = null) {
  if (completedAtIso != null && completedAtIso !== '') {
    const raw = String(completedAtIso).trim();
    if (hasExplicitTimezone(raw)) {
      const ms = toTimeMs(raw);
      return ms != null ? calendarDayInTimezone(ms) : null;
    }
    const naive = parseNaiveUtcWallClockMs(raw);
    if (naive != null) return calendarDayInTimezone(naive);
  }
  if (doneMs != null && Number.isFinite(doneMs)) {
    return calendarDayInTimezone(doneMs);
  }
  return null;
}

export function isCompletionOnOrBeforeDueDay(doneMs, dueValue, completedAtIso = null) {
  const dueDay = dueCalendarDayFromTaskDue(dueValue);
  const doneDay = completionCalendarDayFromAssignee(doneMs, completedAtIso);
  if (dueDay == null || doneDay == null) return null;
  return doneDay <= dueDay;
}

/**
 * When the assignee finished their part (not when the whole TASK was closed).
 * Uses USER_TASK.completedAt when present; for legacy rows, updatedAt then task.finishDate (single assignee).
 */
export function assigneeCompletionTimeMs(ut, taskMeta = {}) {
  if (!isUserTaskAssigneeComplete(ut)) return null;
  const raw = ut?.completedAt ?? ut?.completed_at;
  if (raw != null && raw !== '') {
    if (hasExplicitTimezone(raw)) {
      return toTimeMs(raw);
    }
    const naive = parseNaiveUtcWallClockMs(raw);
    if (naive != null) return naive;
  }

  const assigneeCount = Number(taskMeta.assigneeCount ?? 1);
  if (assigneeCount <= 1) {
    const finish = taskMeta.finishDate ?? taskMeta.finish_date;
    if (finish != null && finish !== '') {
      if (hasExplicitTimezone(finish)) return toTimeMs(finish);
      const naiveFinish = parseNaiveUtcWallClockMs(finish);
      if (naiveFinish != null) return naiveFinish;
    }
  }

  const legacy = toTimeMs(ut?.updatedAt ?? ut?.updated_at ?? ut?.createdAt ?? ut?.created_at);
  return legacy;
}

/** true = on time, false = late, null = unknown / not completed */
export function isAssigneeCompletionOnTime(ut, taskDueDate, taskMeta = {}) {
  const doneMs = assigneeCompletionTimeMs(ut, taskMeta);
  const completedAtIso = ut?.completedAt ?? ut?.completed_at ?? null;
  if (taskDueDate == null || doneMs == null) return null;
  return isCompletionOnOrBeforeDueDay(doneMs, taskDueDate, completedAtIso);
}

/** @returns {'early'|'on_time'|'late'|null} */
export function assigneeDeliveryTiming(ut, taskDueDate, taskMeta = {}) {
  const onTime = isAssigneeCompletionOnTime(ut, taskDueDate, taskMeta);
  if (onTime == null) return null;
  if (!onTime) return 'late';
  const doneMs = assigneeCompletionTimeMs(ut, taskMeta);
  const completedAtIso = ut?.completedAt ?? ut?.completed_at ?? null;
  const dueDay = dueCalendarDayFromTaskDue(taskDueDate);
  const doneDay = completionCalendarDayFromAssignee(doneMs, completedAtIso);
  if (dueDay != null && doneDay != null && doneDay < dueDay) return 'early';
  return 'on_time';
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
  const finishRaw = task?.finishDate ?? task?.finish_date;
  const dueRaw = task?.dueDate ?? task?.due_date;
  const finishMs = assigneeCompletionTimeMs(
    { status: 'COMPLETED', completedAt: finishRaw },
    { assigneeCount: 1, finishDate: finishRaw },
  );
  return isCompletionOnOrBeforeDueDay(finishMs, dueRaw, finishRaw);
}

/** Per-assignee label for Task Details (always show delivery state when complete). */
export function assigneeDeliveryStatus(ut, taskDueDate, taskMeta = {}) {
  if (!isUserTaskAssigneeComplete(ut)) {
    return { complete: false, label: 'Pending', tone: 'pending', completedAt: null };
  }
  const completedAt = ut?.completedAt ?? ut?.completed_at ?? null;
  const timing = assigneeDeliveryTiming(ut, taskDueDate, taskMeta);
  if (timing === 'early') {
    return { complete: true, label: 'Early', tone: 'onTime', completedAt };
  }
  if (timing === 'on_time') {
    return { complete: true, label: 'On time', tone: 'onTime', completedAt };
  }
  if (timing === 'late') {
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

/** Multi-assignee: true only when every assignee completed on or before due day. */
export function multiAssigneeTaskOnTime(assigneeProgress = [], taskDueDate, taskMeta = {}) {
  const rows = Array.isArray(assigneeProgress) ? assigneeProgress : [];
  if (rows.length === 0) return null;
  if (!rows.every((r) => r?.completed)) return null;
  return rows.every((r) => assigneeProgressOnTimeResult(r, taskDueDate, taskMeta) === true);
}

/** Manager task list: Yes / No / — based on assignee completion vs due date. */
export function taskOnTimeDisplayForManager(item) {
  const due = item?.dueDate ?? item?.due_date;
  const progress = item?.assigneeProgress;
  const meta = {
    assigneeCount: progress?.length ?? item?.assigneeCount ?? 1,
    finishDate: item?.finishDate ?? item?.finish_date,
  };
  if (Array.isArray(progress) && progress.length > 0) {
    const result = multiAssigneeTaskOnTime(progress, due, meta);
    return onTimeLabelFromResult(result);
  }
  const ut = {
    status: item?.statusRaw ?? item?.status,
    completedAt: item?.completedAt ?? item?.completed_at,
  };
  return onTimeLabelFromResult(isAssigneeCompletionOnTime(ut, due, meta));
}
