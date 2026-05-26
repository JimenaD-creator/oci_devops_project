import { describe, expect, it } from 'vitest';
import {
  buildUserSessionFromAuth,
  getProfileRoleLabel,
  isDeveloperRole,
  resolveAccessRole,
} from './userRoleUtils';

describe('userRoleUtils', () => {
  it('resolveAccessRole maps job titles to DEVELOPER', () => {
    expect(resolveAccessRole('Frontend Developer')).toBe('DEVELOPER');
    expect(resolveAccessRole('DevOps Engineer')).toBe('DEVELOPER');
    expect(resolveAccessRole('MANAGER')).toBe('MANAGER');
  });

  it('buildUserSessionFromAuth stores access role and job title', () => {
    const session = buildUserSessionFromAuth({
      id: 42,
      name: 'Alex',
      role: 'Frontend Developer',
    });
    expect(session.role).toBe('DEVELOPER');
    expect(session.jobTitle).toBe('Frontend Developer');
    expect(isDeveloperRole(session.role)).toBe(true);
  });

  it('getProfileRoleLabel shows job title under user name', () => {
    expect(getProfileRoleLabel('DEVELOPER', 'Frontend Developer')).toBe('Frontend Developer');
    expect(getProfileRoleLabel('DEVELOPER', 'DEVELOPER')).toBe('Developer');
  });
});
