import { fetchCachedProjectTasks } from '../dashboard/dashboardSprintData';

export async function fetchTasksForKpiProject(projectKey, options = {}) {
  return fetchCachedProjectTasks(projectKey, options);
}
