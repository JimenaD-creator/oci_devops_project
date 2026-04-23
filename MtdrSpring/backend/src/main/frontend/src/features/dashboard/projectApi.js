import { API_BASE } from '../sprints/constants/sprintConstants';

export async function fetchProjectById(projectId) {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}`);
  if (!response.ok) return null;
  return response.json();
}
