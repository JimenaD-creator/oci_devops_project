/**
 * Full page navigation after login (avoids React router / stale state issues in OCI prod).
 */
export function redirectAfterLogin(path = '/') {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  window.location.replace(`${window.location.origin}${normalized}`);
}
