import { getApiBase } from './apiBase';

const LEGACY_AUTH_KEY = 'mtdr_authenticated';
const TOKEN_KEY = 'mtdr_auth_token';
const USER_KEY = 'currentUser';

export function isAuthenticated() {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return false;
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function login(authData, remember = false) {
  const storage = remember ? localStorage : sessionStorage;
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);

  storage.setItem(TOKEN_KEY, authData.token);
  localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
}

export function clearAuthTokens() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
}

export function logout() {
  clearAuthTokens();
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('currentProjectId');
  localStorage.removeItem('currentProjectName');
}

let authFetchInterceptorInstalled = false;

export function installAuthFetchInterceptor() {
  if (authFetchInterceptorInstalled || typeof window === 'undefined') return;
  authFetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const token = getAuthToken();
    if (!token || !shouldAttachToken(input)) {
      return originalFetch(input, init);
    }

    const inputHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init.headers || inputHeaders || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return originalFetch(input, { ...init, headers });
  };
}

function shouldAttachToken(input) {
  const rawUrl = input instanceof Request ? input.url : String(input);

  try {
    const requestUrl = new URL(rawUrl, window.location.origin);
    const path = requestUrl.pathname.replace(/\/+$/, '');
    if (path.endsWith('/api/auth/login')) {
      return false;
    }
    const apiUrl = new URL(getApiBase() || window.location.origin, window.location.origin);
    return requestUrl.origin === apiUrl.origin;
  } catch {
    return false;
  }
}
