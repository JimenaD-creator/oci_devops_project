/*
 * UI-only session gate. Replace with JWT handling when backend auth is added.
 */
const AUTH_KEY = 'mtdr_authenticated';

export function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === 'true';
}

export function login() {
  sessionStorage.setItem(AUTH_KEY, 'true');
}

export function logout() {
  sessionStorage.removeItem(AUTH_KEY);
}
