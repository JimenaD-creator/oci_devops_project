package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.config.DisplayTimezone;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

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
        LocalDateTime doneAt = resolveAssigneeCompletionTime(ut, t, assigneeCount);
        if (doneAt == null) {
            return null;
        }
        return isCompletionOnOrBeforeDueDay(doneAt, t.getDueDate());
    }

    /**
     * Authoritative delivery bucket from {@code USER_TASK.completedAt} vs {@code TASK.dueDate}.
     * @return {@code early}, {@code on_time}, {@code late}, or {@code unknown}
     */
    public static String evaluateDeliveryTiming(UserTask ut, Task t, int assigneeCount) {
        Boolean onTime = evaluateAssignmentOnTime(ut, t, assigneeCount);
        if (onTime == null) {
            return "unknown";
        }
        if (!onTime) {
            return "late";
        }
        LocalDateTime doneAt = resolveAssigneeCompletionTime(ut, t, assigneeCount);
        LocalDate dueDay = dueCalendarDay(t.getDueDate());
        LocalDate doneDay = completionCalendarDay(doneAt);
        if (doneDay != null && dueDay != null && doneDay.isBefore(dueDay)) {
            return "early";
        }
        return "on_time";
    }

    /** Fields for AI payloads and debugging — derived from real completion vs due calendar days. */
    public static void enrichAssignmentTimingFields(
            Map<String, Object> target, UserTask ut, Task t, int assigneeCount) {
        if (target == null || ut == null || t == null || !isAssignmentComplete(ut)) {
            return;
        }
        LocalDateTime doneAt = resolveAssigneeCompletionTime(ut, t, assigneeCount);
        if (t.getDueDate() != null) {
            LocalDate dueDay = dueCalendarDay(t.getDueDate());
            if (dueDay != null) {
                target.put("dueCalendarDay", dueDay.toString());
            }
        }
        if (doneAt != null) {
            target.put("assigneeCompletedAt", doneAt.toString());
            LocalDate doneDay = completionCalendarDay(doneAt);
            if (doneDay != null) {
                target.put("completedCalendarDay", doneDay.toString());
            }
        }
        Boolean onTime = evaluateAssignmentOnTime(ut, t, assigneeCount);
        if (onTime != null) {
            target.put("onTime", onTime);
            target.put("deliveryTiming", evaluateDeliveryTiming(ut, t, assigneeCount));
        }
    }

    public static Map<String, Object> assignmentTimingSnapshot(UserTask ut, Task t, int assigneeCount) {
        Map<String, Object> snap = new LinkedHashMap<>();
        enrichAssignmentTimingFields(snap, ut, t, assigneeCount);
        return snap;
    }

    /**
     * Calendar-day comparison aligned with the web UI:
     * <ul>
     *   <li>Due date: the date chosen in the picker (date part of {@code TASK.DUE_DATE}).</li>
     *   <li>Completion: {@code USER_TASK.completedAt} stored as server UTC wall-clock, viewed in
     *       {@link DisplayTimezone} so evening completions are not pushed to the next day.</li>
     * </ul>
     */
    public static boolean isCompletionOnOrBeforeDueDay(LocalDateTime completedAt, LocalDateTime dueDate) {
        if (completedAt == null || dueDate == null) {
            return false;
        }
        LocalDate dueDay = dueCalendarDay(dueDate);
        LocalDate doneDay = completionCalendarDay(completedAt);
        return doneDay != null && dueDay != null && !doneDay.isAfter(dueDay);
    }

    /** Due dates come from a date picker — the Y-M-D portion is authoritative. */
    static LocalDate dueCalendarDay(LocalDateTime dueAt) {
        return dueAt != null ? dueAt.toLocalDate() : null;
    }

    /** Completion timestamps are server UTC; map to the display zone before taking the calendar day. */
    static LocalDate completionCalendarDay(LocalDateTime completedAt) {
        if (completedAt == null) {
            return null;
        }
        return completedAt.atOffset(ZoneOffset.UTC)
                .atZoneSameInstant(DisplayTimezone.get())
                .toLocalDate();
    }

    public static LocalDateTime resolveAssigneeCompletionTime(UserTask ut, Task t, int assigneeCount) {
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
