import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isTokenExpired,
  isUnauthorizedError,
  resolveLoadErrorMessage,
  getSessionExpiredMessage,
} from './auth';

function makeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('auth session helpers', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { language: 'es-MX' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isTokenExpired returns true when exp is in the past', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 120 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('isTokenExpired returns false when exp is in the future', () => {
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('resolveLoadErrorMessage maps UNAUTHORIZED to session message', () => {
    const msg = resolveLoadErrorMessage({ code: 'UNAUTHORIZED' }, 'fallback');
    expect(msg).toBe(getSessionExpiredMessage());
    expect(msg).toMatch(/sesión|session/i);
  });

  it('isUnauthorizedError detects httpStatus 401', () => {
    expect(isUnauthorizedError({ httpStatus: 401 })).toBe(true);
    expect(isUnauthorizedError({ httpStatus: 500 })).toBe(false);
  });
});
