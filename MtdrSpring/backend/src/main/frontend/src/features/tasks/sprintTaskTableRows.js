import { developerNumericId } from '../../utils/userIds';
import { resolveUserTaskUserId } from '../dashboard/dashboardSprintData';
import { taskDisplayName } from '../sprints/utils/sprintUtils';
import {
  deriveTaskStatusFromAssignments,
  isUserTaskAssigneeComplete,
  normalizeTaskStatus,
  userTaskRowStatus,
  userTaskRowTaskId,
} from './utils/taskUtils';

export function buildAssignmentsByTaskId(userTasks) {
  return (Array.isArray(userTasks) ? userTasks : []).reduce((acc, ut) => {
    const tid = userTaskRowTaskId(ut);
    if (!Number.isFinite(tid)) return acc;
    if (!acc[tid]) acc[tid] = [];
    acc[tid].push(ut);
    return acc;
  }, {});
}

export function resolveUtDeveloperName(ut, projectDevelopers = []) {
  const direct = String(
    ut?.user?.name ?? ut?.user?.NAME ?? ut?.user?.fullName ?? ut?.user?.displayName ?? '',
  ).trim();
  if (direct) return direct;
  const uid = Number(ut?.user?.id ?? ut?.user?.ID ?? ut?.id?.userId ?? ut?.userId);
  if (Number.isFinite(uid)) {
    const known = (projectDevelopers || []).find((u) => developerNumericId(u) === uid);
    if (known?.name) return String(known.name).trim();
    return `User ${uid}`;
  }
  return null;
}

/**
 * Build TaskTable rows for sprint tasks (same shape as Sprints page manager table).
 * @param {object[]} tasks - TASK entities for one sprint
 * @param {object[]} userTasks - USER_TASK rows (may be pre-filtered per developer)
 * @param {object[]} projectDevelopers
 * @param {{ assignmentFilter?: (assignments: object[], task: object) => object[] }} [options]
 */
export function buildSprintTaskTableRows(tasks, userTasks, projectDevelopers = [], options = {}) {
  const { assignmentFilter } = options;
  const assignmentsByTaskId = buildAssignmentsByTaskId(userTasks);

  return (tasks || []).map((task) => {
    let taskAssignments = assignmentsByTaskId[Number(task.id)] || [];
    if (typeof assignmentFilter === 'function') {
      taskAssignments = assignmentFilter(taskAssignments, task);
    }

    const names = [
      ...new Set(
        taskAssignments.map((ut) => resolveUtDeveloperName(ut, projectDevelopers)).filter(Boolean),
      ),
    ];
    const workedHours = taskAssignments.reduce((sum, ut) => {
      const n = Number(ut?.workedHours ?? ut?.worked_hours ?? ut?.hours ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    const assigneeProgress =
      taskAssignments.length > 0
        ? [...taskAssignments]
            .map((ut) => {
              const uid = Number(ut?.user?.id ?? ut?.user?.ID ?? ut?.id?.userId ?? ut?.userId);
              const name =
                resolveUtDeveloperName(ut, projectDevelopers) ||
                (Number.isFinite(uid) ? `User ${uid}` : 'Unknown');
              return {
                userId: Number.isFinite(uid) ? uid : null,
                name,
                status: normalizeTaskStatus(userTaskRowStatus(ut)),
                completed: isUserTaskAssigneeComplete(ut),
                completedAt: ut?.completedAt ?? ut?.completed_at ?? null,
              };
            })
            .sort((a, b) =>
              String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }),
            )
        : undefined;
    const derivedStatus = deriveTaskStatusFromAssignments(task.status, taskAssignments);

    return {
      id: task.id,
      description: taskDisplayName(task),
      priority: task.priority ?? null,
      assignedHours: task.assignedHours ?? null,
      done: derivedStatus === 'DONE',
      status: derivedStatus,
      statusRaw: derivedStatus,
      dueDate: task.dueDate,
      completedAt: task.finishDate,
      developers: names,
      developer: names[0] ?? null,
      actualHours: workedHours > 0 ? workedHours : null,
      assigneeProgress,
    };
  });
}

/** Keep only tasks where the given user has at least one assignment row. */
export function filterTasksForUser(tasks, userTasks, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return [];
  const ids = new Set(
    (userTasks || [])
      .filter((ut) => resolveUserTaskUserId(ut) === uid)
      .map(userTaskRowTaskId)
      .filter(Number.isFinite),
  );
  return (tasks || []).filter((t) => ids.has(Number(t.id)));
}
