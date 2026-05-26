package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;

import java.time.LocalDateTime;

/**
 * Per-assignee on-time evaluation (USER_TASK.completedAt), aligned with the web
 * {@code assigneeOnTimeUtils.js} logic — not TASK.finishDate alone.
 */
public final class UserTaskOnTimeUtil {

    private UserTaskOnTimeUtil() {
    }

    public static boolean isAssignmentComplete(UserTask ut) {
        return UserTask.isCompletedAssignmentStatus(ut != null ? ut.getStatus() : null);
    }

    /**
     * @return true if on time, false if late, null if completion time cannot be determined
     */
    public static Boolean evaluateAssignmentOnTime(UserTask ut, Task t, int assigneeCount) {
        if (ut == null || t == null || t.getDueDate() == null) {
            return null;
        }
        if (!isAssignmentComplete(ut)) {
            return null;
        }
        LocalDateTime doneAt = resolveCompletionTime(ut, t, assigneeCount);
        if (doneAt == null) {
            return null;
        }
        return !doneAt.toLocalDate().isAfter(t.getDueDate().toLocalDate());
    }

    private static LocalDateTime resolveCompletionTime(UserTask ut, Task t, int assigneeCount) {
        LocalDateTime completedAt = ut.getCompletedAt();
        if (completedAt != null) {
            return completedAt;
        }
        if (assigneeCount <= 1 && t.getFinishDate() != null) {
            return t.getFinishDate();
        }
        return null;
    }
}
