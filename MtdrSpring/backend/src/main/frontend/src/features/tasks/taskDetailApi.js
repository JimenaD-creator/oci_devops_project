import { API_BASE } from '../sprints/constants/sprintConstants';
import { apiFetch } from '../../utils/auth';
import { BULK_DELETE_BATCH_SIZE } from './constants/taskConstants';

export async function fetchTaskDetailDevelopers(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/developers`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchTaskById(taskId) {
  const taskRes = await fetch(`${API_BASE}/api/tasks/${taskId}`);
  if (!taskRes.ok) return null;
  return taskRes.json();
}

export async function fetchUserTasksForTask(taskId) {
  const utRes = await fetch(`${API_BASE}/api/user-tasks/task/${taskId}`);
  if (!utRes.ok) return [];
  try {
    const data = await utRes.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Task + assignee rows in parallel (detail dialog). */
export async function fetchTaskDetailBundle(taskId) {
  const id = Number(taskId);
  if (!Number.isFinite(id)) return { task: null, userTasks: [] };
  const [task, userTasks] = await Promise.all([fetchTaskById(id), fetchUserTasksForTask(id)]);
  return { task, userTasks: Array.isArray(userTasks) ? userTasks : [] };
}

export async function deleteUserTasksForTask(taskId) {
  return fetch(`${API_BASE}/api/user-tasks/task/${taskId}`, { method: 'DELETE' });
}

export async function postUserTask(body) {
  return fetch(`${API_BASE}/api/user-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function putTask(taskId, payload) {
  return fetch(`${API_BASE}/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteTaskById(taskId) {
  return apiFetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE' });
}

export async function deleteTasksByIds(taskIds, { onProgress } = {}) {
  const ids = Array.isArray(taskIds)
    ? taskIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [];
  if (!ids.length) {
    return { ok: false, status: 400, deletedCount: 0, requestedCount: 0 };
  }

  let totalDeleted = 0;
  for (let i = 0; i < ids.length; i += BULK_DELETE_BATCH_SIZE) {
    const batch = ids.slice(i, i + BULK_DELETE_BATCH_SIZE);
    const res = await apiFetch(`${API_BASE}/api/tasks/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ taskIds: batch }),
    });
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    const batchDeleted = Number(body?.deletedCount);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        deletedCount: totalDeleted,
        requestedCount: ids.length,
      };
    }
    totalDeleted += Number.isFinite(batchDeleted) ? batchDeleted : batch.length;
    onProgress?.(Math.min(i + batch.length, ids.length), ids.length);
  }

  return {
    ok: totalDeleted > 0,
    status: 200,
    deletedCount: totalDeleted,
    requestedCount: ids.length,
  };
}

/** Email newly added assignees after editing assignees on an existing task. */
export async function notifyNewAssignees(taskId, newAssigneeUserIds) {
  const ids = Array.isArray(newAssigneeUserIds)
    ? newAssigneeUserIds.filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
    : [];
  if (ids.length === 0) {
    return { ok: true };
  }
  return apiFetch(`${API_BASE}/api/tasks/${taskId}/notify-new-assignees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ newAssigneeUserIds: ids }),
  });
}
