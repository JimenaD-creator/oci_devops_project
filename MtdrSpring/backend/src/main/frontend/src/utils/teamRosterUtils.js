import { developerNumericId } from './userIds';

export function rosterDeveloperDisplayName(user) {
  if (!user) return 'Unknown';
  const name = String(
    user?.name ?? user?.NAME ?? user?.displayName ?? user?.fullName ?? '',
  ).trim();
  if (name) return name;
  const id = developerNumericId(user);
  return id != null ? `User ${id}` : 'Unknown';
}

export function rosterDeveloperProfilePicture(user) {
  if (!user) return null;
  const raw = user?.profilePicture ?? user?.profile_picture ?? user?.PROFILE_PICTURE;
  const pic = raw != null ? String(raw).trim() : '';
  return pic || null;
}

/** Profile photo from project team roster (by user id or display name). */
export function resolveProfilePictureFromRoster(projectDevelopers, { name, userId } = {}) {
  const roster = Array.isArray(projectDevelopers) ? projectDevelopers : [];
  const uid = userId != null ? Number(userId) : null;
  if (Number.isFinite(uid)) {
    const byId = roster.find((u) => developerNumericId(u) === uid);
    const pic = rosterDeveloperProfilePicture(byId);
    if (pic) return pic;
  }
  const nameKey = String(name || '')
    .trim()
    .toLowerCase();
  if (!nameKey) return null;
  const byName = roster.find(
    (u) => rosterDeveloperDisplayName(u).toLowerCase() === nameKey,
  );
  return rosterDeveloperProfilePicture(byName);
}

function shortDevNameLocal(fullName) {
  if (!fullName) return '';
  return String(fullName).trim().split(/\s+/)[0] || '';
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return String(name || '').slice(0, 2).toUpperCase();
}

/** Count unique developers on the project team roster. */
export function countTeamDevelopers(developers) {
  if (!Array.isArray(developers) || developers.length === 0) return 0;
  const ids = new Set();
  developers.forEach((u) => {
    const id = developerNumericId(u);
    if (id != null) ids.add(id);
  });
  if (ids.size > 0) return ids.size;
  const names = new Set(
    developers
      .map((u) => rosterDeveloperDisplayName(u))
      .filter((n) => n && n !== 'Unknown'),
  );
  return names.size;
}

function indexSprintDevelopers(sprintDevelopers) {
  const byUserId = new Map();
  const byName = new Map();
  (sprintDevelopers || []).forEach((d) => {
    if (d?.userId != null && Number.isFinite(Number(d.userId))) {
      byUserId.set(Number(d.userId), d);
    }
    const nm = String(d?.name || '')
      .trim()
      .toLowerCase();
    if (nm) byName.set(nm, d);
  });
  return { byUserId, byName };
}

function findSprintDeveloper(indices, userId, name) {
  if (userId != null && indices.byUserId.has(Number(userId))) {
    return indices.byUserId.get(Number(userId));
  }
  const nm = String(name || '')
    .trim()
    .toLowerCase();
  if (nm && indices.byName.has(nm)) return indices.byName.get(nm);
  return null;
}

export function emptyDeveloperMetrics(name, extras = {}) {
  const displayName = String(name || 'Unknown').trim() || 'Unknown';
  return {
    name: displayName,
    shortName: shortDevNameLocal(displayName),
    assigned: 0,
    completed: 0,
    hours: 0,
    workload: 0,
    pending: 0,
    assignedHoursEstimate: 0,
    onTime: null,
    participation: null,
    initials: initialsFromName(displayName),
    profilePicture: extras.profilePicture ?? null,
    userId: extras.userId ?? null,
  };
}

/**
 * Full project team for a sprint view: roster first, then any activity-only names.
 */
export function mergeRosterWithSprintDevelopers(projectDevelopers, sprintDevelopers) {
  const indices = indexSprintDevelopers(sprintDevelopers);
  const merged = [];
  const seenIds = new Set();
  const seenNames = new Set();

  (projectDevelopers || []).forEach((u) => {
    const uid = developerNumericId(u);
    const name = rosterDeveloperDisplayName(u);
    const nameKey = name.toLowerCase();
    const fromActivity = findSprintDeveloper(indices, uid, name);
    if (fromActivity) {
      const assigned = Number(fromActivity.assigned) || 0;
      const completed = Number(fromActivity.completed) || 0;
      merged.push({
        ...fromActivity,
        name: fromActivity.name || name,
        userId: fromActivity.userId ?? uid,
        profilePicture:
          fromActivity.profilePicture ??
          rosterDeveloperProfilePicture(u) ??
          null,
        shortName: fromActivity.shortName ?? shortDevNameLocal(fromActivity.name || name),
        pending: Math.max(0, assigned - completed),
      });
    } else {
      merged.push(
        emptyDeveloperMetrics(name, {
          userId: uid,
          profilePicture: rosterDeveloperProfilePicture(u),
        }),
      );
    }
    if (uid != null) seenIds.add(uid);
    seenNames.add(nameKey);
  });

  (sprintDevelopers || []).forEach((d) => {
    const uid = d?.userId != null ? Number(d.userId) : null;
    const nameKey = String(d?.name || '')
      .trim()
      .toLowerCase();
    if (uid != null && seenIds.has(uid)) return;
    if (nameKey && seenNames.has(nameKey)) return;
    const assigned = Number(d.assigned) || 0;
    const completed = Number(d.completed) || 0;
    merged.push({
      ...d,
      pending: Math.max(0, assigned - completed),
      shortName: d.shortName ?? shortDevNameLocal(d.name),
    });
  });

  return merged;
}

/** Ordered developer names: project roster + anyone with sprint activity. */
export function collectDeveloperNamesForSelection(selectedSprints, projectDevelopers) {
  const names = [];
  const seen = new Set();
  const add = (n) => {
    const t = String(n || '').trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    names.push(t);
  };
  (projectDevelopers || []).forEach((u) => add(rosterDeveloperDisplayName(u)));
  (selectedSprints || []).forEach((sp) =>
    (sp.developers || []).forEach((d) => add(d?.name)),
  );
  return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

const NO_TASKS_INSIGHT =
  'On the project team with no tasks assigned in this sprint.';

/**
 * AI per-developer table: include full project roster, including developers with no assignments.
 */
export function mergeDeveloperInsightRows(projectDevelopers, aiRows) {
  const fromAi = Array.isArray(aiRows) ? aiRows : [];
  const roster = Array.isArray(projectDevelopers) ? projectDevelopers : [];
  if (roster.length === 0) return fromAi;

  const byName = new Map();
  fromAi.forEach((row) => {
    const key = String(row?.developerName || '')
      .trim()
      .toLowerCase();
    if (key) byName.set(key, row);
  });

  const merged = [];
  const seen = new Set();
  roster.forEach((u) => {
    const name = rosterDeveloperDisplayName(u);
    const key = name.toLowerCase();
    seen.add(key);
    if (byName.has(key)) {
      merged.push(byName.get(key));
    } else {
      merged.push({
        developerName: name,
        insight: NO_TASKS_INSIGHT,
        overloaded: false,
      });
    }
  });

  fromAi.forEach((row) => {
    const key = String(row?.developerName || '')
      .trim()
      .toLowerCase();
    if (key && !seen.has(key)) merged.push(row);
  });

  return merged;
}
