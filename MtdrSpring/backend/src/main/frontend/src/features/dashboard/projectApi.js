import { getApiBase } from '../../utils/apiBase';
import { apiFetch } from '../../utils/auth';
import { getCachedDevelopersSnapshot } from './dashboardSprintData';

const DEVELOPERS_CACHE_TTL = 120000; // 2 minutes — aligned with dashboard bundle cache

let cachedDevelopers = {
  projectId: null,
  developers: null,
  timestamp: 0,
};

function normalizeProjectId(projectId) {
  return projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
}

function isDevelopersCacheValid(pid, now, forceFresh) {
  return (
    !forceFresh &&
    cachedDevelopers.projectId === pid &&
    Array.isArray(cachedDevelopers.developers) &&
    now - cachedDevelopers.timestamp < DEVELOPERS_CACHE_TTL
  );
}

/** Synchronous snapshot for stale-while-revalidate UI (no network). */
export function getCachedProjectDevelopersSnapshot(projectId) {
  const pid = normalizeProjectId(projectId);
  if (!pid || !isDevelopersCacheValid(pid, Date.now(), false)) {
    return null;
  }
  return {
    developers: cachedDevelopers.developers,
    timestamp: cachedDevelopers.timestamp,
  };
}

export function invalidateProjectDevelopersCache() {
  cachedDevelopers = {
    projectId: null,
    developers: null,
    timestamp: 0,
  };
}

export async function fetchProjectById(projectId) {
  const response = await apiFetch(`${getApiBase()}/api/projects/${projectId}`);
  if (!response.ok) return null;
  return response.json();
}

/** Developers on the project's assigned team (includes manager when applicable). */
export async function fetchProjectDevelopers(projectId, options = {}) {
  const forceFresh = Boolean(options?.forceFresh);
  const pid = normalizeProjectId(projectId);
  if (!pid) return [];

  const now = Date.now();
  if (isDevelopersCacheValid(pid, now, forceFresh)) {
    return cachedDevelopers.developers;
  }

  if (!forceFresh) {
    const bundleSnap = getCachedDevelopersSnapshot(pid);
    if (bundleSnap?.developers) {
      cachedDevelopers = {
        projectId: pid,
        developers: bundleSnap.developers,
        timestamp: bundleSnap.timestamp || now,
      };
      return bundleSnap.developers;
    }
  }

  const response = await apiFetch(`${getApiBase()}/api/projects/${pid}/developers`);
  if (!response.ok) return [];
  try {
    const data = await response.json();
    const developers = Array.isArray(data) ? data : [];
    cachedDevelopers = {
      projectId: pid,
      developers,
      timestamp: now,
    };
    return developers;
  } catch {
    return [];
  }
}
