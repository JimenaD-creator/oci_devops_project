import { getApiBase } from './apiBase';
import { buildUserSessionFromAuth } from './userRoleUtils';

const LEGACY_AUTH_KEY = 'mtdr_authenticated';
const TOKEN_KEY = 'mtdr_auth_token';
const USER_KEY = 'currentUser';
export const SESSION_EXPIRED_EVENT = 'mtdr-session-expired';

const SESSION_EXPIRED_MESSAGE_ES =
  'Sesión inválida o expirada. Cierra sesión, recarga la página e inicia sesión de nuevo.';
const SESSION_EXPIRED_MESSAGE_EN =
  'Your session is invalid or expired. Sign out, reload the page, and sign in again.';
/** Inline in currentUser JSON; larger images use mtdr_profile_picture_{userId}. */
const MAX_INLINE_PROFILE_PICTURE_LENGTH = 120_000;

export function profilePictureStorageKey(userId) {
  return `mtdr_profile_picture_${userId}`;
}

export function readCachedProfilePicture(userId) {
  if (userId == null) return null;
  try {
    return localStorage.getItem(profilePictureStorageKey(userId));
  } catch {
    return null;
  }
}

function writeCachedProfilePicture(userId, profilePicture) {
  if (userId == null || !profilePicture) return;
  try {
    localStorage.setItem(profilePictureStorageKey(userId), profilePicture);
  } catch {
    /* quota — avatar may not persist offline */
  }
}

function clearCachedProfilePicture(userId) {
  if (userId == null) return;
  try {
    localStorage.removeItem(profilePictureStorageKey(userId));
  } catch {
    /* ignore */
  }
}

/** Resolve avatar for UI: inline field, cache, or null. */
export function resolveProfilePicture(userId, inlinePicture) {
  if (inlinePicture && typeof inlinePicture === 'string') {
    return inlinePicture;
  }
  return readCachedProfilePicture(userId);
}

function applyProfilePictureToSession(session, profilePicture) {
  if (!session || !Number.isFinite(session.id)) {
    return session;
  }
  if (profilePicture === null) {
    clearCachedProfilePicture(session.id);
    const { profilePicture: _omit, ...rest } = session;
    return rest;
  }
  if (profilePicture === undefined) {
    const cached = readCachedProfilePicture(session.id);
    return cached ? { ...session, profilePicture: cached } : session;
  }
  if (typeof profilePicture !== 'string' || !profilePicture) {
    return session;
  }
  writeCachedProfilePicture(session.id, profilePicture);
  if (profilePicture.length <= MAX_INLINE_PROFILE_PICTURE_LENGTH) {
    return { ...session, profilePicture };
  }
  const { profilePicture: _drop, ...rest } = session;
  return rest;
}

export function persistCurrentUser(user) {
  if (!user?.id) return;
  const session = applyProfilePictureToSession(buildUserSessionFromAuth(user), user.profilePicture);
  localStorage.setItem(USER_KEY, JSON.stringify(session));
}

export function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = buildUserSessionFromAuth(parsed);
    if (!Number.isFinite(session.id)) return null;
    const picField = Object.prototype.hasOwnProperty.call(parsed, 'profilePicture')
      ? parsed.profilePicture
      : undefined;
    return applyProfilePictureToSession(session, picField);
  } catch {
    return null;
  }
}

function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** True when JWT exp claim is in the past (30s skew). Missing exp → not treated as expired. */
export function isTokenExpired(token = getAuthToken()) {
  if (!token) return true;
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return false;
  return Date.now() >= Number(payload.exp) * 1000 - 30_000;
}

export function isUnauthorizedHttpStatus(status) {
  return status === 401 || status === 403;
}

export function isUnauthorizedError(error) {
  if (!error) return false;
  if (error.code === 'UNAUTHORIZED') return true;
  return isUnauthorizedHttpStatus(error.httpStatus);
}

export function getSessionExpiredMessage() {
  try {
    const lang = typeof navigator !== 'undefined' ? navigator.language : '';
    return lang && lang.toLowerCase().startsWith('es')
      ? SESSION_EXPIRED_MESSAGE_ES
      : SESSION_EXPIRED_MESSAGE_EN;
  } catch {
    return SESSION_EXPIRED_MESSAGE_ES;
  }
}

export function resolveLoadErrorMessage(error, fallback = 'Could not load data.') {
  if (isUnauthorizedError(error)) {
    return getSessionExpiredMessage();
  }
  if (error?.userMessage && String(error.userMessage).trim()) {
    return String(error.userMessage).trim();
  }
  return fallback;
}

export function notifySessionExpired() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

let sessionExpiryHandled = false;

export function handleSessionExpiredOnce() {
  if (sessionExpiryHandled) return;
  sessionExpiryHandled = true;
  logout();
  notifySessionExpired();
}

export function resetSessionExpiryGuard() {
  sessionExpiryHandled = false;
}

export function isAuthenticated() {
  const token = getAuthToken();
  if (!token || isTokenExpired(token)) return false;
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

/** Remove session before a new sign-in (avoids stale JWT / user / project mixing in OCI). */
export function clearSessionForLogin() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('currentProjectId');
  localStorage.removeItem('currentProjectName');
}

export function clearAuthTokens() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
}

export function logout() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      clearCachedProfilePicture(parsed?.id);
    }
  } catch {
    /* ignore */
  }
  clearSessionForLogin();
}

function buildUserForStorage(user) {
  if (!user || typeof user !== 'object') {
    return null;
  }
  const session = buildUserSessionFromAuth(user);
  if (!Number.isFinite(session.id)) {
    return null;
  }
  const pic = user.profilePicture != null ? user.profilePicture : undefined;
  return applyProfilePictureToSession(session, pic);
}

export function login(authData, remember = false) {
  const storage = remember ? localStorage : sessionStorage;
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);
  resetSessionExpiryGuard();

  const token = authData?.token;
  const userForStorage = buildUserForStorage(authData?.user);
  if (!token || !userForStorage?.id) {
    throw new Error('Invalid auth payload');
  }

  storage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(userForStorage));
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

/**
 * fetch() that always sends Bearer when a session exists (OCI-safe; do not rely only on the interceptor).
 */
export function apiFetch(input, init = {}) {
  const headers = new Headers(input instanceof Request ? input.headers : init.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const nextInit = { cache: 'no-store', ...init, headers };
  const run =
    input instanceof Request ? fetch(new Request(input, nextInit)) : fetch(input, nextInit);
  return run.then((response) => {
    if (token && isUnauthorizedHttpStatus(response.status) && !isAuthLoginRequest(input, init)) {
      handleSessionExpiredOnce();
    }
    return response;
  });
}

function isAuthLoginRequest(input, init) {
  try {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const path = new URL(rawUrl, window.location.origin).pathname.replace(/\/+$/, '');
    return path.endsWith('/api/auth/login');
  } catch {
    return false;
  }
}
