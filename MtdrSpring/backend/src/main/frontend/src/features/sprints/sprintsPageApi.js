import { API_BASE } from './constants/sprintConstants';
import {
  fetchJsonNoStore,
  resolveActiveProjectIdNum,
  sprintProjectIdFromJson,
} from './utils/sprintUtils';

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

export async function fetchSprintsTasksAndAssignments(projectIdProp) {
  const pid = resolveActiveProjectIdNum(projectIdProp);
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
  const [sprintsRes, tasksRes, userTasksRes] = await Promise.all([
    fetchJsonNoStore(sprintsUrl),
    fetchJsonNoStore(tasksUrl),
    fetchJsonNoStore(userTasksUrl),
  ]);
  let sprintsData = await sprintsRes.json();
  const tasksData = await tasksRes.json();
  const userTasksData = await userTasksRes.json();
  const tasksList = Array.isArray(tasksData) ? tasksData : [];
  const userTasksList = Array.isArray(userTasksData) ? userTasksData : [];
  if (pid != null && Array.isArray(sprintsData)) {
    sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === pid);
  }
  const sprintsList = Array.isArray(sprintsData) ? sprintsData : [];
  return { pid, sprintsList, tasksList, userTasksList };
}
