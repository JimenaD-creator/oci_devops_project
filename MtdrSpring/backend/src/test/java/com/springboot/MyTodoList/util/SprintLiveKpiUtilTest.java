package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SprintLiveKpiUtilTest {

    @Test
    void computeLiveKpis_matchesDashboardFormula() {
        Sprint sprint = new Sprint();
        sprint.setWorkloadBalance(new BigDecimal("0.85"));

        Task doneTask = task(1L, "DONE", 10L);
        Task openTask = task(2L, "IN_PROGRESS", 6L);

        UserTask completed = assignment(1L, 1L, "COMPLETED", 4.0, LocalDateTime.of(2026, 5, 10, 12, 0));
        completed.getTask().setDueDate(LocalDateTime.of(2026, 5, 15, 0, 0));
        UserTask inProgress = assignment(1L, 2L, "IN_PROGRESS", 2.0, null);

        Map<String, Object> kpis = SprintLiveKpiUtil.computeLiveKpis(
                sprint,
                List.of(doneTask, openTask),
                List.of(completed, inProgress));

        assertEquals(50, kpis.get("completionRate"));
        assertEquals(100, kpis.get("onTimeDelivery"));
        assertEquals(38, kpis.get("teamParticipation"));
        assertEquals(85, kpis.get("workloadBalance"));
        assertEquals(6.0, kpis.get("totalWorkedHours"));
        assertEquals(66, kpis.get("productivityScore"));
    }

    private static Task task(long id, String status, long assignedHours) {
        Task task = new Task();
        task.setId(id);
        task.setStatus(status);
        task.setAssignedHours(assignedHours);
        return task;
    }

    private static UserTask assignment(
            long userId, long taskId, String status, double workedHours, LocalDateTime completedAt) {
        User user = new User();
        user.setId(userId);
        user.setName("Dev " + userId);

        Task task = new Task();
        task.setId(taskId);
        task.setAssignedHours(8L);

        UserTask ut = new UserTask();
        ut.setId(new UserTaskId(userId, taskId));
        ut.setUser(user);
        ut.setTask(task);
        ut.setStatus(status);
        ut.setWorkedHours(workedHours);
        ut.setCompletedAt(completedAt);
        return ut;
    }
}
