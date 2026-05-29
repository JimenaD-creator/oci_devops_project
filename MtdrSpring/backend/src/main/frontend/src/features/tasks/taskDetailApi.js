import { API_BASE } from '../sprints/constants/sprintConstants';
import { apiFetch } from '../../utils/auth';

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
  return fetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE' });
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
