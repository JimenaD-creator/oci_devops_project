import { API_BASE } from '../../utils/apiBase';
import { getAuthToken } from '../../utils/auth';

function authHeaders() {
  const headers = {};
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function loginWithCredentials(identifier, password) {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier, password }),
  });

  if (!response.ok) {
    const error = new Error('Invalid credentials');
    error.status = response.status;
    try {
      const body = await response.json();
      if (body?.message) error.serverMessage = body.message;
    } catch {
      /* ignore */
    }
    throw error;
  }

  return response.json();
}

export async function fetchManagerPrimaryProject(managerId) {
  const projRes = await fetch(`${API_BASE}/api/projects/manager/${managerId}`, {
    headers: authHeaders(),
  });
  if (!projRes.ok) return null;
  return projRes.json();
}

export async function fetchDeveloperPrimaryProject(userId) {
  const projRes = await fetch(`${API_BASE}/api/projects/developer/${userId}`, {
    headers: authHeaders(),
  });
  if (!projRes.ok) return null;
  return projRes.json();
}
