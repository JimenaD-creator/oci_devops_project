const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export async function fetchAllUsers() {
  const response = await fetch(`${API_BASE}/users`);
  if (!response.ok) throw new Error('Server error');
  return response.json();
}

export async function fetchManagerPrimaryProject(managerId) {
  const projRes = await fetch(`${API_BASE}/api/projects/manager/${managerId}`);
  if (!projRes.ok) return null;
  return projRes.json();
}
