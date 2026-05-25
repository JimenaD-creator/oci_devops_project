import { API_BASE } from '../sprints/constants/sprintConstants';

export async function fetchProjectById(projectId) {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}`);
  if (!response.ok) return null;
  return response.json();
}

/** Developers on the project's assigned team (includes manager when applicable). */
export async function fetchProjectDevelopers(projectId) {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}/developers`);
  if (!response.ok) return [];
  try {
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
