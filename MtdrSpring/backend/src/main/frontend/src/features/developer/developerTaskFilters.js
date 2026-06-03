import { resolveUserTaskUserId } from '../dashboard/dashboardSprintData';
import { developerNumericId } from '../../utils/userIds';
import { userTaskRowTaskId } from '../tasks/utils/taskUtils';

export function filterUserTasksForUser(userTasks, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return [];
  return (userTasks || []).filter((ut) => {
    const rowUid =
      resolveUserTaskUserId(ut) ??
      developerNumericId(ut?.id?.userId) ??
      developerNumericId(ut?.userId) ??
      developerNumericId(ut?.user);
    return rowUid === uid;
  });
}

export function taskIdsForUser(userTasks, userId) {
  return new Set(
    filterUserTasksForUser(userTasks, userId).map(userTaskRowTaskId).filter(Number.isFinite),
  );
}

export function findDeveloperInSprint(sprint, userId, userName) {
  const devs = sprint?.developers || [];
  const uid = Number(userId);
  if (Number.isFinite(uid)) {
    const byId = devs.find((d) => Number(d.userId) === uid);
    if (byId) return byId;
  }
  if (userName) {
    return devs.find((d) => String(d.name) === String(userName));
  }
  return null;
}
