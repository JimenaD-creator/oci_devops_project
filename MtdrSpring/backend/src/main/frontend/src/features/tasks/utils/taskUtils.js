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

/** Create-task dialog fields: Oracle red focus + grays (aligned with Tasks page). */
export function pageFormFieldOutline() {
  return {
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
    '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(199, 70, 52, 0.35)',
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(199, 70, 52, 0.55)',
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderWidth: 2,
      borderColor: ORACLE_RED,
    },
    '& .MuiInputLabel-root': { color: '#616161' },
    '& .MuiInputLabel-root.Mui-focused': { color: ORACLE_RED },
    '& .MuiSelect-select': { color: '#1A1A1A' },
    '& .MuiSelect-icon': { color: '#616161' },
  };
}

export function createTaskSelectFillSx() {
  return {
    ...pageFormFieldOutline(),
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(199, 70, 52, 0.08)' },
  };
}

export function mapTaskToKanban(task, developerNames = []) {
  const statusMap = {
    DONE: 'done',
    IN_PROGRESS: 'in_progress',
    IN_REVIEW: 'in_review',
    TODO: 'todo',
  };
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
    done: task.status === 'DONE',
    status: statusMap[task.status] ?? 'todo',
    rawStatus: task.status,
    actualHours: task.assignedHours ?? null,
    developers: list,
    developer: list[0] ?? null,
    dueDate: task.dueDate,
    sprintId: task.assignedSprint?.id ?? null,
    _raw: task,
  };
}
