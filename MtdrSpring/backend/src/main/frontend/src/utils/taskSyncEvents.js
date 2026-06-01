import {
  mergeUpdatedTask,
  patchUserTasksAfterTaskSave,
} from '../features/tasks/utils/taskUtils';

export const TASKS_MUTATED_EVENT = 'mtdr-tasks-mutated';
const DELETED_TASK_TTL_MS = 20000;
const CREATED_TASK_TTL_MS = 20000;
const UPDATED_TASK_TTL_MS = 20000;
let lastTasksMutatedAt = 0;
const recentlyDeletedTaskIds = new Map();
const recentlyCreatedTasks = new Map();
const recentlyUpdatedTasks = new Map();

function userTaskDedupeKey(ut) {
  const tid = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId ?? ut?.taskId;
  const uid = ut?.user?.id ?? ut?.user?.ID ?? ut?.id?.userId ?? ut?.userId;
  if (tid == null || uid == null) return null;
  return `${Number(tid)}:${Number(uid)}`;
}

/** Merge user-task rows; first lists win on duplicate task+user keys. */
export function mergeUserTaskLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const ut of list) {
      const key = userTaskDedupeKey(ut);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(ut);
    }
  }
  return out;
}

export function getLastTasksMutatedAt() {
  return lastTasksMutatedAt;
}

/** After a shared bundle refresh, align mutation watermark so dashboard does not re-fetch in a loop. */
export function markTasksSyncCaughtUp(at = Date.now()) {
  lastTasksMutatedAt = at;
}

export function notifyTasksMutated(detail = {}) {
  lastTasksMutatedAt = Date.now();
  if (detail?.type === 'task-deleted' && detail?.taskId != null) {
    const taskId = String(detail.taskId);
    recentlyDeletedTaskIds.set(taskId, Date.now() + DELETED_TASK_TTL_MS);
    recentlyUpdatedTasks.delete(taskId);
    recentlyCreatedTasks.delete(taskId);
  }
  if (detail?.type === 'task-created' && detail?.task?.id != null) {
    const taskId = String(detail.task.id);
    recentlyCreatedTasks.set(taskId, {
      task: detail.task,
      userTasks: Array.isArray(detail.userTasks) ? detail.userTasks : [],
      expiresAt: Date.now() + CREATED_TASK_TTL_MS,
    });
    recentlyDeletedTaskIds.delete(taskId);
    recentlyUpdatedTasks.delete(taskId);
  }
  if (detail?.type === 'task-updated' && detail?.task?.id != null) {
    const taskId = String(detail.task.id);
    recentlyUpdatedTasks.set(taskId, {
      task: detail.task,
      meta: detail.meta,
      expiresAt: Date.now() + UPDATED_TASK_TTL_MS,
    });
    recentlyDeletedTaskIds.delete(taskId);
  }
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TASKS_MUTATED_EVENT, { detail }));
}

function purgeExpiredDeletedTaskIds() {
  const now = Date.now();
  for (const [taskId, expiresAt] of recentlyDeletedTaskIds.entries()) {
    if (expiresAt <= now) recentlyDeletedTaskIds.delete(taskId);
  }
}

function purgeExpiredCreatedTasks() {
  const now = Date.now();
  for (const [taskId, payload] of recentlyCreatedTasks.entries()) {
    if (!payload || payload.expiresAt <= now) recentlyCreatedTasks.delete(taskId);
  }
}

function purgeExpiredUpdatedTasks() {
  const now = Date.now();
  for (const [taskId, payload] of recentlyUpdatedTasks.entries()) {
    if (!payload || payload.expiresAt <= now) recentlyUpdatedTasks.delete(taskId);
  }
}

export function getRecentlyDeletedTaskIdSet() {
  purgeExpiredDeletedTaskIds();
  return new Set(recentlyDeletedTaskIds.keys());
}

export function getRecentlyCreatedTasks() {
  purgeExpiredCreatedTasks();
  return Array.from(recentlyCreatedTasks.values())
    .map((entry) => entry?.task)
    .filter(Boolean);
}

export function getRecentlyCreatedUserTasks() {
  purgeExpiredCreatedTasks();
  return Array.from(recentlyCreatedTasks.values()).flatMap((entry) =>
    Array.isArray(entry?.userTasks) ? entry.userTasks : [],
  );
}

export function getRecentlyUpdatedTaskEntries() {
  purgeExpiredUpdatedTasks();
  return Array.from(recentlyUpdatedTasks.values());
}

/** Overlay recent edits on fetched lists so a stale API response does not undo sync. */
export function applyRecentUpdatesToTaskLists(tasks, userTasks, projectDevelopers = []) {
  let nextTasks = Array.isArray(tasks) ? tasks : [];
  let nextUserTasks = Array.isArray(userTasks) ? userTasks : [];
  for (const entry of getRecentlyUpdatedTaskEntries()) {
    if (!entry?.task) continue;
    nextTasks = mergeUpdatedTask(nextTasks, entry.task);
    nextUserTasks = patchUserTasksAfterTaskSave(
      nextUserTasks,
      entry.task,
      entry.meta,
      projectDevelopers,
    );
  }
  return { tasks: nextTasks, userTasks: nextUserTasks };
}
