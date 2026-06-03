import { API_BASE } from './constants/sprintConstants';
import { fetchProjectBundleRaw, getCachedBundleSnapshot } from '../dashboard/dashboardSprintData';
import { fetchProjectDevelopers } from '../dashboard/projectApi';
import { resolveActiveProjectIdNum, sprintProjectIdFromJson } from './utils/sprintUtils';

export async function fetchSprintsProjectDevelopers(projectIdNum, options = {}) {
  return fetchProjectDevelopers(projectIdNum, options);
}

export async function fetchSprintsProjectSummary(projectIdNum) {
  const res = await fetch(`${API_BASE}/api/projects/${projectIdNum}`);
  if (!res.ok) return null;
  return res.json();
}

function bundleFromSnapshot(snap, pid) {
  let sprintsData = snap.sprints;
  const tasksList = Array.isArray(snap.tasks) ? snap.tasks : [];
  const userTasksList = Array.isArray(snap.userTasks) ? snap.userTasks : [];
  if (pid != null && Array.isArray(sprintsData)) {
    sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === pid);
  }
  const sprintsList = Array.isArray(sprintsData) ? sprintsData : [];
  return { pid, sprintsList, tasksList, userTasksList };
}

export async function fetchSprintsTasksAndAssignments(projectIdProp, options = {}) {
  const pid = resolveActiveProjectIdNum(projectIdProp);
  const projectKey = pid != null ? String(pid) : null;
  if (!options?.forceFresh && projectKey) {
    const snap = getCachedBundleSnapshot(projectKey);
    if (snap) {
      return bundleFromSnapshot(snap, pid);
    }
  }
  const {
    sprints: rawSprints,
    tasks: tasksData,
    userTasks: userTasksData,
  } = await fetchProjectBundleRaw(projectKey, options);
  let sprintsData = rawSprints;
  const tasksList = Array.isArray(tasksData) ? tasksData : [];
  const userTasksList = Array.isArray(userTasksData) ? userTasksData : [];
  if (pid != null && Array.isArray(sprintsData)) {
    sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === pid);
  }
  const sprintsList = Array.isArray(sprintsData) ? sprintsData : [];
  return { pid, sprintsList, tasksList, userTasksList };
}
