package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;

class UserTaskOnTimeUtilTest {

    @Test
    void usesCompletedAt_notTaskFinishDate_forMultiAssignee() {
        UserTask ut = new UserTask();
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 10, 12, 0));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 0, 0));
        t.setFinishDate(LocalDateTime.of(2026, 1, 20, 12, 0));

        assertEquals(Boolean.TRUE, UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, 2));
    }

    @Test
    void calendarDay_allowsSameDayCompletion() {
        UserTask ut = new UserTask();
        ut.setStatus("DONE");
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 15, 18, 30));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 0, 0));

        assertEquals(Boolean.TRUE, UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, 1));
    }

    @Test
    void marksLate_whenCompletedAfterDueDay() {
        UserTask ut = new UserTask();
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 16, 15, 0));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 23, 59));

        assertEquals(Boolean.FALSE, UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, 1));
    }

    @Test
    void eveningCompletion_sameDueDay_notMarkedLate_whenServerUtcAheadOfDisplayZone() {
        // Jan 15 11pm America/Mexico_City ≈ Jan 16 05:00 UTC wall-clock stored as completedAt
        UserTask ut = new UserTask();
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 16, 5, 0));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 23, 59, 59));

        assertEquals(Boolean.TRUE, UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, 1));
    }

    @Test
    void marksEarly_whenCompletedBeforeDueDay() {
        UserTask ut = new UserTask();
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 10, 12, 0));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 0, 0));

        assertEquals("early", UserTaskOnTimeUtil.evaluateDeliveryTiming(ut, t, 1));
        assertEquals(Boolean.TRUE, UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, 1));
    }

    @Test
    void marksOnTime_whenCompletedOnDueDay() {
        UserTask ut = new UserTask();
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 15, 18, 30));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 0, 0));

        assertEquals("on_time", UserTaskOnTimeUtil.evaluateDeliveryTiming(ut, t, 1));
    }

    @Test
    void enrichAssignmentTimingFields_includesCalendarDays() {
        UserTask ut = new UserTask();
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 10, 12, 0));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 23, 59));

        java.util.Map<String, Object> fields = UserTaskOnTimeUtil.assignmentTimingSnapshot(ut, t, 1);
        assertEquals("2026-01-15", fields.get("dueCalendarDay"));
        assertEquals("2026-01-10", fields.get("completedCalendarDay"));
        assertEquals("early", fields.get("deliveryTiming"));
        assertEquals(Boolean.TRUE, fields.get("onTime"));
    }

    @Test
    void returnsNull_whenMultiAssigneeWithoutCompletedAt() {
        UserTask ut = new UserTask();
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(null);

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 0, 0));
        t.setFinishDate(LocalDateTime.of(2026, 1, 20, 0, 0));

        assertNull(UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, 2));
    }
}
