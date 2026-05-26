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
        ut.setCompletedAt(LocalDateTime.of(2026, 1, 16, 9, 0));

        Task t = new Task();
        t.setDueDate(LocalDateTime.of(2026, 1, 15, 23, 59));

        assertEquals(Boolean.FALSE, UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, t, 1));
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
