import { API_BASE } from './constants/sprintConstants';
import { fetchProjectBundleRaw } from '../dashboard/dashboardSprintData';
import { resolveActiveProjectIdNum, sprintProjectIdFromJson } from './utils/sprintUtils';

export async function fetchSprintsProjectDevelopers(projectIdNum) {
  const res = await fetch(`${API_BASE}/api/projects/${projectIdNum}/developers`);
  const data = res.ok ? await res.json() : [];
  return Array.isArray(data) ? data : [];
}

export async function fetchSprintsProjectSummary(projectIdNum) {
  const res = await fetch(`${API_BASE}/api/projects/${projectIdNum}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchSprintsTasksAndAssignments(projectIdProp, options = {}) {
  const pid = resolveActiveProjectIdNum(projectIdProp);
  const projectKey = pid != null ? String(pid) : null;
  const { sprints: rawSprints, tasks: tasksData, userTasks: userTasksData } =
    await fetchProjectBundleRaw(projectKey, options);
  let sprintsData = rawSprints;
  const tasksList = Array.isArray(tasksData) ? tasksData : [];
  const userTasksList = Array.isArray(userTasksData) ? userTasksData : [];
  if (pid != null && Array.isArray(sprintsData)) {
    sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === pid);
  }
  const sprintsList = Array.isArray(sprintsData) ? sprintsData : [];
  return { pid, sprintsList, tasksList, userTasksList };
}
