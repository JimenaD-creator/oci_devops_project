import { ORACLE_RED } from '../constants/taskConstants';
import {
  resolveActiveProjectIdNum,
  sprintProjectIdFromJson,
} from '../../sprints/utils/sprintUtils';

export { resolveActiveProjectIdNum as resolveActiveProjectId, sprintProjectIdFromJson };

/** USER_TASK row finished: COMPLETED (canonical) or DONE (legacy rows). */
export function isUserTaskAssigneeComplete(ut) {
  const u = String(ut?.status || '')
    .trim()
    .toUpperCase();
  return u === 'COMPLETED' || u === 'DONE';
}

/** Canonical string id for a TASK entity (API may use id or ID). */
export function taskEntityId(task) {
  const raw = task?.id ?? task?.ID ?? task?.taskId;
  if (raw == null || raw === '') return null;
  return String(raw);
}

/** Numeric TASK_ID for a user-task row (API may nest it under task, id, or root). */
export function userTaskRowTaskId(ut) {
  const raw = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId ?? ut?.taskId;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** STATUS on a USER_TASK row (API field names vary). */
export function userTaskRowStatus(ut) {
  return ut?.status ?? ut?.STATUS ?? ut?.assignmentStatus ?? '';
}

/** Create-task dialog fields: Oracle red focus + grays (aligned with Tasks page). */
export function pageFormFieldOutline(isDark = false) {
  return {
    '& .MuiOutlinedInput-root': { 
      borderRadius: 2, 
      bgcolor: isDark ? '#1C1E22' : '#FFFFFF' 
    },
    '& .MuiOutlinedInput-input': { 
      color: isDark ? '#F0F0F0' : '#1A1A1A' 
    },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
      borderColor: isDark ? '#3A3C42' : 'rgba(199, 70, 52, 0.35)',
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: isDark ? '#5A5C62' : 'rgba(199, 70, 52, 0.55)',
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderWidth: 2,
      borderColor: isDark ? '#EF5350' : ORACLE_RED,
    },
    '& .MuiInputLabel-root': { 
      color: isDark ? '#9A9A9A' : '#616161' 
    },
    '& .MuiInputLabel-root.Mui-focused': { 
      color: isDark ? '#EF5350' : ORACLE_RED 
    },
    '& .MuiSelect-select': { 
      color: isDark ? '#F0F0F0' : '#1A1A1A' 
    },
    '& .MuiSelect-icon': { 
      color: isDark ? '#9A9A9A' : '#616161' 
    },
  };
}
export function createTaskSelectFillSx() {
  return {
    ...pageFormFieldOutline(),
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(199, 70, 52, 0.08)' },
  };
}

export function normalizeTaskStatus(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (normalized === 'DONE' || normalized === 'COMPLETED' || normalized === 'COMPLETE')
    return 'DONE';
  if (normalized === 'IN_PROGRESS' || normalized === 'IN_PROCESS') return 'IN_PROGRESS';
  if (normalized === 'IN_REVIEW' || normalized === 'REVIEW') return 'IN_REVIEW';
  if (
    normalized === 'PENDING' ||
    normalized === 'TODO' ||
    normalized === 'TO_DO' ||
    normalized === ''
  )
    return 'TODO';
  return 'TODO';
}

/** Mirrors TaskAssignmentSyncService: aggregate TASK status from USER_TASK rows. */
export function deriveTaskStatusFromAssignments(taskStatus, assignmentRows = []) {
  const rows = Array.isArray(assignmentRows) ? assignmentRows : [];
  if (rows.length === 0) return normalizeTaskStatus(taskStatus);
  const statuses = rows.map((ut) => normalizeTaskStatus(ut?.status ?? ut?.STATUS));
  if (statuses.every((s) => s === 'DONE')) return 'DONE';
  if (statuses.some((s) => s === 'IN_PROGRESS')) return 'IN_PROGRESS';
  if (statuses.some((s) => s === 'IN_REVIEW')) return 'IN_REVIEW';
  if (statuses.some((s) => s === 'DONE')) return 'IN_REVIEW';
  return 'TODO';
}

export function assigneeStatusLabel(statusKey) {
  const key = normalizeTaskStatus(statusKey);
  const labels = {
    TODO: 'To Do',
    IN_PROGRESS: 'In Progress',
    IN_REVIEW: 'In Review',
    DONE: 'Done',
  };
  return labels[key] ?? 'To Do';
}

export function assigneeStatusChipStyle(statusKey) {
  const key = normalizeTaskStatus(statusKey);
  const styles = {
    TODO: { bg: '#F1EFE8', color: '#5F5E5A', border: '#D3D1C7' },
    IN_PROGRESS: { bg: '#FAEEDA', color: '#633806', border: '#FAC775' },
    IN_REVIEW: { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB' },
    DONE: { bg: '#EAF3DE', color: '#27500A', border: '#97C459' },
  };
  return styles[key] ?? styles.TODO;
}

export function mapTaskToKanban(task, developerNames = [], assignmentRows = []) {
  const statusMap = {
    DONE: 'done',
    IN_PROGRESS: 'in_progress',
    IN_REVIEW: 'in_review',
    TODO: 'todo',
  };
  const normalizedStatus = deriveTaskStatusFromAssignments(task?.status, assignmentRows);
  const list = Array.isArray(developerNames)
    ? [...new Set(developerNames.filter(Boolean))]
    : developerNames
      ? [developerNames]
      : [];
  return {
    id: task.id,
    description: task.title || `Task #${task.id}`,
    details: task.description || task.classification || '',
    classification: task.classification ?? '',
    priority: task.priority ?? 'MEDIUM',
    done: normalizedStatus === 'DONE',
    status: statusMap[normalizedStatus] ?? 'todo',
    rawStatus: normalizedStatus,
    rawStatusOriginal: task.status,
    actualHours: task.assignedHours ?? null,
    developers: list,
    developer: list[0] ?? null,
    dueDate: task.dueDate,
    sprintId: task.assignedSprint?.id ?? task.assignedSprint?.ID ?? null,
    _raw: task,
  };
}
