const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export async function fetchTasksForKpiProject(projectKey) {
  const tasksUrl =
    projectKey != null
      ? `${API_BASE}/api/tasks?projectId=${encodeURIComponent(projectKey)}`
      : `${API_BASE}/api/tasks`;
  const tasksRes = await fetch(tasksUrl);
  if (!tasksRes.ok) return [];
  try {
    const tasksData = await tasksRes.json();
    return Array.isArray(tasksData) ? tasksData : [];
  } catch {
    return [];
  }
}
