import { API_BASE } from './constants/taskConstants';
import { fetchJsonNoStore } from '../sprints/utils/sprintUtils';
import { sprintProjectIdFromJson } from './utils/taskUtils';

export async function fetchProjectDevelopersList(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/developers`);
  const data = res.ok ? await res.json() : [];
  return Array.isArray(data) ? data : [];
}

async function readJsonArray(res, label) {
  if (!res.ok) {
    console.error(`${label} failed:`, res.status);
    return [];
  }
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(`${label} parse error:`, e);
    return [];
  }
}

/**
 * Loads sprints, tasks, and user-tasks for the Tasks page.
 * Tasks are filtered by project on the server when projectId is set.
 */
export async function fetchTasksPageBundle(effectiveProjectId) {
  const pid =
    effectiveProjectId != null && String(effectiveProjectId).trim() !== ''
      ? Number(effectiveProjectId)
      : null;

  const sprintsUrl =
    pid != null
      ? `${API_BASE}/api/sprints?projectId=${encodeURIComponent(pid)}`
      : `${API_BASE}/api/sprints`;
  const tasksUrl =
    pid != null
      ? `${API_BASE}/api/tasks?projectId=${encodeURIComponent(pid)}`
      : `${API_BASE}/api/tasks`;
  const userTasksUrl =
    pid != null
      ? `${API_BASE}/api/user-tasks?projectId=${encodeURIComponent(pid)}`
      : `${API_BASE}/api/user-tasks`;

  const [tasksRes, sprintsRes, userTasksRes] = await Promise.all([
    fetchJsonNoStore(tasksUrl),
    fetchJsonNoStore(sprintsUrl),
    fetchJsonNoStore(userTasksUrl),
  ]);

  let tasksData = await readJsonArray(tasksRes, 'tasks');
  let sprintsData = await readJsonArray(sprintsRes, 'sprints');
  let userTasksData = await readJsonArray(userTasksRes, 'user-tasks');

  if (pid != null) {
    sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === pid);
    const taskIds = new Set(tasksData.map((t) => Number(t.id)).filter(Number.isFinite));
    userTasksData = userTasksData.filter((ut) => {
      const tid = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId ?? ut?.taskId;
      const n = Number(tid);
      return Number.isFinite(n) && taskIds.has(n);
    });
  }

  return {
    tasksData,
    sprintsData,
    userTasksData,
  };
}
