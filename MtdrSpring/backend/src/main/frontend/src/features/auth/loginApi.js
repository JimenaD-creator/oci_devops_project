import { getAuthToken } from '../../utils/auth';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

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
