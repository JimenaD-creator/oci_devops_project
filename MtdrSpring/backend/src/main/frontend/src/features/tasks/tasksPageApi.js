import { API_BASE } from './constants/taskConstants';
import { fetchProjectBundleRaw } from '../dashboard/dashboardSprintData';
import { fetchProjectDevelopers } from '../dashboard/projectApi';
import { sprintProjectIdFromJson } from './utils/taskUtils';
import { apiFetch } from '../../utils/auth';

/** Marks a USER_TASK complete and persists worked hours (total for this assignment). */
export async function completeAssigneeWithHours(taskId, userId, workedHours) {
  const res = await apiFetch(`${API_BASE}/api/user-tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      taskId: Number(taskId),
      status: 'COMPLETED',
      workedHours,
    }),
  });
  if (!res.ok) throw new Error('Failed to save worked hours');
  return res.json();
}

export async function fetchProjectDevelopersList(projectId, options = {}) {
  return fetchProjectDevelopers(projectId, options);
}

/**
 * Loads sprints, tasks, and user-tasks for the Tasks page.
 * Tasks are filtered by project on the server when projectId is set.
 */
export async function fetchTasksPageBundle(effectiveProjectId, options = {}) {
  const pid =
    effectiveProjectId != null && String(effectiveProjectId).trim() !== ''
      ? Number(effectiveProjectId)
      : null;

  const projectKey = pid != null ? String(pid) : null;
  const {
    sprints: rawSprints,
    tasks: rawTasks,
    userTasks: rawUserTasks,
  } = await fetchProjectBundleRaw(projectKey, options);

  let tasksData = Array.isArray(rawTasks) ? rawTasks : [];
  let sprintsData = Array.isArray(rawSprints) ? rawSprints : [];
  let userTasksData = Array.isArray(rawUserTasks) ? rawUserTasks : [];

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
