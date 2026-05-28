import { getApiBase } from '../../utils/apiBase';
import { apiFetch, getAuthToken } from '../../utils/auth';
import { isDeveloperRole, isManagerRole } from '../../utils/userRoleUtils';

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
    const error = new Error('Login failed');
    error.status = response.status;
    try {
      const body = await parseJsonResponse(response);
      if (body?.message) error.serverMessage = body.message;
    } catch (parseErr) {
      if (parseErr?.serverMessage) {
        error.serverMessage = parseErr.serverMessage;
      } else if (response.status === 401) {
        error.serverMessage = 'Invalid credentials. Please try again.';
      } else if (response.status >= 500) {
        error.serverMessage =
          'Server error during sign-in. Restart the backend and try again.';
      }
    }
    if (!error.serverMessage) {
      error.serverMessage =
        response.status === 401
          ? 'Invalid credentials. Please try again.'
          : `Sign-in failed (${response.status}). Try again or contact support.`;
    }
    throw error;
  }

  return parseJsonResponse(response);
}

export async function fetchManagerPrimaryProject(managerId) {
  const projRes = await apiFetch(`${getApiBase()}/api/projects/manager/${managerId}`);
  if (!projRes.ok) return null;
  return projRes.json();
}

export async function fetchDeveloperPrimaryProject(userId) {
  const projRes = await apiFetch(`${getApiBase()}/api/projects/developer/${userId}`);
  if (!projRes.ok) return null;
  return projRes.json();
}

/** After login, ensure currentProjectId is set (needed for dashboard API calls in OCI). */
export async function resolveProjectContextAfterLogin(user, authData) {
  if (authData?.projectId != null) {
    return {
      projectId: String(authData.projectId),
      projectName: authData.projectName || '',
    };
  }
  const userId = user?.id;
  if (!userId) return { projectId: null, projectName: '' };

  if (isManagerRole(user?.role)) {
    const res = await apiFetch(`${getApiBase()}/api/projects/manager/${userId}/list`);
    if (res.ok) {
      const list = await res.json();
      const first = Array.isArray(list) ? list[0] : null;
      if (first?.id != null) {
        return { projectId: String(first.id), projectName: first.name || '' };
      }
    }
  } else if (isDeveloperRole(user?.role)) {
    const project = await fetchDeveloperPrimaryProject(userId);
    if (project?.id != null) {
      return { projectId: String(project.id), projectName: project.name || '' };
    }
  }
  return { projectId: null, projectName: '' };
}
