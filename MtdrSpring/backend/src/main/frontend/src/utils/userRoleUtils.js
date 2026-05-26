/**
 * Classifies user.type / currentUser.role for routing and UI.
 * Developer access: any role that is not ADMIN or MANAGER (e.g. DevOps Engineer).
 */

export function normalizeUserRole(role) {
  return (role ?? '').trim();
}

export function isAdminRole(role) {
  return normalizeUserRole(role).toUpperCase() === 'ADMIN';
}

export function isManagerRole(role) {
  return normalizeUserRole(role).toUpperCase() === 'MANAGER';
}

export function isDeveloperRole(role) {
  const r = normalizeUserRole(role);
  if (!r) return true;
  return !isAdminRole(role) && !isManagerRole(role);
}

/** Under project title: generic access level only. */
export function getSidebarRoleLabel(role) {
  if (isAdminRole(role)) return 'ADMIN';
  if (isManagerRole(role)) return 'MANAGER';
  return 'DEVELOPER';
}

/** Under user name: specific job title for team members (e.g. Frontend Developer). */
export function getProfileRoleLabel(role) {
  const r = normalizeUserRole(role);
  if (isDeveloperRole(role)) {
    if (!r || r.toUpperCase() === 'DEVELOPER') return 'Developer';
    return r;
  }
  return getSidebarRoleLabel(role);
}

export const TEAM_MEMBER_TYPE_SUGGESTIONS = [
  'DEVELOPER',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Mobile Developer',
  'DevOps Engineer',
  'QA Engineer',
  'MANAGER',
];
