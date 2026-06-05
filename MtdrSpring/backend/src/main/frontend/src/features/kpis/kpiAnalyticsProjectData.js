import { sprintProjectIdFromJson } from '../sprints/utils/sprintUtils';

export function resolveKpiProjectId(projectId) {
  if (projectId != null && String(projectId).trim() !== '') {
    return String(projectId).trim();
  }
  if (typeof localStorage !== 'undefined') {
    const stored = String(localStorage.getItem('currentProjectId') || '').trim();
    if (stored) return stored;
  }
  return '';
}

export function taskSprintIdForKpi(task) {
  const raw =
    task?.assignedSprint?.id ??
    task?.sprint?.id ??
    task?.sprintId ??
    task?.sprint_id ??
    task?.id?.sprintId ??
    task?.id?.sprint_id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Prefer enriched sprints from bundle cache; fall back to context list. */
export function pickProjectSprintsForKpi(enrichedFromSnapshot, sharedSprints, projectId) {
  const pid = String(projectId ?? '').trim();
  if (!pid) return [];

  const fromSnapshot = Array.isArray(enrichedFromSnapshot) ? enrichedFromSnapshot : [];
  const fromContext = Array.isArray(sharedSprints) ? sharedSprints : [];
  const source = fromSnapshot.length > 0 ? fromSnapshot : fromContext;

  return source.filter((s) => {
    const sprintPid = sprintProjectIdFromJson(s);
    return sprintPid != null && String(sprintPid) === pid;
  });
}

export function filterTasksForKpiSprints(tasks, sprintRows) {
  const sprintIds = new Set((sprintRows || []).map((s) => Number(s.id)).filter(Number.isFinite));
  return (Array.isArray(tasks) ? tasks : []).filter((t) => {
    const sid = taskSprintIdForKpi(t);
    return sid != null && sprintIds.has(sid);
  });
}

/** On-time % from enriched sprint KPIs (USER_TASK completion vs due date, same as dashboard). */
export function resolveOnTimeDeliveryPercent(sprint) {
  const v = Number(sprint?.kpis?.onTimeDelivery);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}
