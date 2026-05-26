/**
 * API root URL.
 * - Dev: React on :3000 → Spring on :8080
 * - Prod: same origin as the page (Load Balancer URL in OCI)
 */
export function resolveApiBase() {
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_API_URL || 'http://localhost:8080';
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export const API_BASE = resolveApiBase();
