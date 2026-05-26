import { getApiBase } from '../../utils/apiBase';
import { getAuthToken } from '../../utils/auth';

function authHeaders() {
  const headers = {};
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const error = new Error('Unexpected server response');
    error.status = response.status;
    error.serverMessage =
      'The server returned an invalid response. If you are on OCI, redeploy the latest build or hard-refresh the page (Ctrl+Shift+R).';
    throw error;
  }
  return response.json();
}

export async function loginWithCredentials(identifier, password) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(`${getApiBase()}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password }),
      signal: controller.signal,
    });
  } catch (fetchErr) {
    if (fetchErr?.name === 'AbortError') {
      throw Object.assign(new Error('Login timeout'), {
        serverMessage: 'The server took too long to respond. Try again in a moment.',
      });
    }
    throw Object.assign(fetchErr instanceof Error ? fetchErr : new Error('Network error'), {
      serverMessage: 'Could not reach the server. Check your connection and the OCI app URL.',
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const error = new Error('Invalid credentials');
    error.status = response.status;
    try {
      const body = await parseJsonResponse(response);
      if (body?.message) error.serverMessage = body.message;
    } catch (parseErr) {
      if (parseErr?.serverMessage) {
        error.serverMessage = parseErr.serverMessage;
      } else if (response.status === 401) {
        error.serverMessage =
          'Sign-in was rejected. Try again after clearing the site cache, or ask your admin to redeploy the latest version.';
      }
    }
    throw error;
  }

  return parseJsonResponse(response);
}

export async function fetchManagerPrimaryProject(managerId) {
  const projRes = await fetch(`${getApiBase()}/api/projects/manager/${managerId}`, {
    headers: authHeaders(),
  });
  if (!projRes.ok) return null;
  return projRes.json();
}

export async function fetchDeveloperPrimaryProject(userId) {
  const projRes = await fetch(`${getApiBase()}/api/projects/developer/${userId}`, {
    headers: authHeaders(),
  });
  if (!projRes.ok) return null;
  return projRes.json();
}
