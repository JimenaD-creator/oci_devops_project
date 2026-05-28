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
  if (r.toUpperCase() === 'DEVELOPER') return true;
  return !isAdminRole(role) && !isManagerRole(role);
}

/** Routing role stored in session: ADMIN | MANAGER | DEVELOPER (same as before custom job titles). */
export function resolveAccessRole(role) {
  if (isAdminRole(role)) return 'ADMIN';
  if (isManagerRole(role)) return 'MANAGER';
  return 'DEVELOPER';
}

/** Persist minimal user for localStorage — access role + job title separated. */
export function buildUserSessionFromAuth(userFromApi) {
  const id = Number(userFromApi?.id);
  if (!Number.isFinite(id)) {
    return { id: NaN };
  }

  if (
    userFromApi?.jobTitle
    && (userFromApi.role === 'ADMIN' || userFromApi.role === 'MANAGER' || userFromApi.role === 'DEVELOPER')
  ) {
    const jobTitle = normalizeUserRole(userFromApi.jobTitle);
    const row = {
      id,
      name: userFromApi.name,
      role: userFromApi.role,
      jobTitle,
      type: jobTitle,
    };
    if (userFromApi.profilePicture != null) {
      row.profilePicture = userFromApi.profilePicture;
    }
    return row;
  }

  const displayType = normalizeUserRole(
    userFromApi?.jobTitle || userFromApi?.type || userFromApi?.role || 'DEVELOPER',
  );
  const accessRole = resolveAccessRole(displayType);
  const row = {
    id,
    name: userFromApi?.name,
    role: accessRole,
    jobTitle: displayType,
    type: displayType,
  };
  if (userFromApi?.profilePicture != null) {
    row.profilePicture = userFromApi.profilePicture;
  }
  return row;
}

/** Under project title: generic access level only. */
export function getSidebarRoleLabel(role) {
  if (isAdminRole(role)) return 'ADMIN';
  if (isManagerRole(role)) return 'MANAGER';
  return 'DEVELOPER';
}

/** Under user name: specific job title for team members (e.g. Frontend Developer). */
export function getProfileRoleLabel(role, jobTitle) {
  if (isAdminRole(role)) return 'ADMIN';
  if (isManagerRole(role)) return 'MANAGER';
  const r = normalizeUserRole(jobTitle || role);
  if (!r || r.toUpperCase() === 'DEVELOPER') return 'Developer';
  return r;
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
