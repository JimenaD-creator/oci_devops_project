import { getApiBase } from './apiBase';
import { buildUserSessionFromAuth } from './userRoleUtils';

const LEGACY_AUTH_KEY = 'mtdr_authenticated';
const TOKEN_KEY = 'mtdr_auth_token';
const USER_KEY = 'currentUser';
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
  const pic = user.profilePicture != null
    ? user.profilePicture
    : undefined;
  return applyProfilePictureToSession(session, pic);
}

export function login(authData, remember = false) {
  const storage = remember ? localStorage : sessionStorage;
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_AUTH_KEY);

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
  const headers = new Headers(
    input instanceof Request ? input.headers : init.headers || {},
  );
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const nextInit = { cache: 'no-store', ...init, headers };
  if (input instanceof Request) {
    return fetch(new Request(input, nextInit));
  }
  return fetch(input, nextInit);
}
