export { API_BASE } from '../../sprints/constants/sprintConstants';

/** Primary accent for Tasks UI (Oracle red). */
export const ORACLE_RED = '#C74634';

export const pageEase = [0.22, 1, 0.36, 1];

/** Shown in window.confirm before deleting a task (no DB/table jargon). */
export const DELETE_TASK_CONFIRM_MESSAGE =
  'Delete this task permanently? All assignees and their progress on this task will be removed. This cannot be undone.';

/** Max task ids per bulk-delete API request (avoids long-running HTTP calls). */
export const BULK_DELETE_BATCH_SIZE = 50;

export function bulkDeleteTasksConfirmMessage(count) {
  const n = Math.max(0, Number(count) || 0);
  if (n <= 1) return DELETE_TASK_CONFIRM_MESSAGE;
  return `Delete ${n} tasks permanently? All assignees and their progress on those tasks will be removed. This cannot be undone.`;
}
