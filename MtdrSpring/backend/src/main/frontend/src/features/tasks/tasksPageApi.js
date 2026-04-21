import { API_BASE } from './constants/taskConstants';
import { sprintProjectIdFromJson } from './utils/taskUtils';

export async function fetchProjectDevelopersList(projectId) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/developers`);
  const data = res.ok ? await res.json() : [];
  return Array.isArray(data) ? data : [];
}

/**
 * Loads sprints, tasks, and user-tasks for the Tasks page (same filtering as TasksPage.loadData).
 * @param {string|null|undefined} effectiveProjectId
 */
export async function fetchTasksPageBundle(effectiveProjectId) {
  const pid = effectiveProjectId;
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
    fetch(tasksUrl),
    fetch(sprintsUrl),
    fetch(userTasksUrl),
  ]);

  let tasksData = await tasksRes.json();
  let sprintsData = await sprintsRes.json();
  let userTasksData = await userTasksRes.json();

  if (pid != null) {
    sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === Number(pid));
    const sprintIds = new Set(sprintsData.map((s) => Number(s.id)));
    tasksData = tasksData.filter((t) => {
      const sid = t.assignedSprint?.id;
      return sid != null && sprintIds.has(Number(sid));
    });
    const taskIds = new Set((Array.isArray(tasksData) ? tasksData : []).map((t) => Number(t.id)));
    userTasksData = (Array.isArray(userTasksData) ? userTasksData : []).filter((ut) => {
      const tid = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId ?? ut?.taskId;
      const n = Number(tid);
      return Number.isFinite(n) && taskIds.has(n);
    });
  }

  return {
    tasksData: Array.isArray(tasksData) ? tasksData : [],
    sprintsData: Array.isArray(sprintsData) ? sprintsData : [],
    userTasksData,
  };
}
