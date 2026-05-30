/**
 * API root URL (evaluated at call time so OCI/prod always uses the page origin).
 * - Dev: React on :3000 → Spring on :8080
 * - Prod: same origin as the page (Load Balancer URL in OCI)
 */
export function getApiBase() {
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8080`;

  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

/** @deprecated Prefer getApiBase() for fetch calls */
export const API_BASE = getApiBase();
