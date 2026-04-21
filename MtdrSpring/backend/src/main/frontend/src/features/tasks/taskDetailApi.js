import { API_BASE } from '../sprints/constants/sprintConstants';

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
