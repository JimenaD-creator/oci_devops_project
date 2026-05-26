import { API_BASE } from '../sprints/constants/sprintConstants';

/**
 * @returns {Promise<Array<{ taskId, taskTitle, sprintId, blockedReason, reportedAt }>>}
 */
export async function fetchMyBlockers(userId, projectId) {
  const uid = Number(userId);
  const pid = Number(projectId);
  if (!Number.isFinite(uid) || !Number.isFinite(pid)) {
    return [];
  }
  const res = await fetch(
    `${API_BASE}/api/user-tasks/my-blockers?userId=${uid}&projectId=${pid}`,
    { cache: 'no-store', headers: { Accept: 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(`Could not load blocker reports (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
