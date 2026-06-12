package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SprintDeveloperMetricsUtilTest {

    @Test
    void buildDeveloperSummaryRows_sumsWorkedHoursLikeDashboard() {
        UserTask ut1 = assignment(1L, 10L, "COMPLETED", 2.5, 8L);
        UserTask ut2 = assignment(1L, 11L, "IN_PROGRESS", 1.5, 4L);
        UserTask ut3 = assignment(2L, 10L, "COMPLETED", 3.0, 8L);

        List<Map<String, Object>> rows = SprintDeveloperMetricsUtil.buildDeveloperSummaryRows(
                List.of(ut1, ut2, ut3));

        Map<String, Object> dev1 = rows.stream()
                .filter(r -> Long.valueOf(1L).equals(r.get("userId")))
                .findFirst()
                .orElseThrow();
        Map<String, Object> dev2 = rows.stream()
                .filter(r -> Long.valueOf(2L).equals(r.get("userId")))
                .findFirst()
                .orElseThrow();

        assertEquals(4.0, dev1.get("workedHours"));
        assertEquals(2, dev1.get("assigned"));
        assertEquals(1, dev1.get("completed"));
        assertEquals(12.0, dev1.get("assignedHoursEstimate"));

        assertEquals(3.0, dev2.get("workedHours"));
        assertEquals(1, dev2.get("completed"));
    }

    @Test
    void mergeDeveloperRowsByUserId_sumsHoursAcrossSprints() {
        List<Map<String, Object>> merged = SprintDeveloperMetricsUtil.mergeDeveloperRowsByUserId(
                List.of(
                        Map.of(
                                "userId", 1L,
                                "name", "Ana",
                                "assigned", 2,
                                "completed", 1,
                                "pending", 1,
                                "inProgress", 0,
                                "toDo", 1,
                                "inReview", 0,
                                "workedHours", 2.5,
                                "assignedHoursEstimate", 10.0),
                        Map.of(
                                "userId", 1L,
                                "name", "Ana",
                                "assigned", 1,
                                "completed", 1,
                                "pending", 0,
                                "inProgress", 0,
                                "toDo", 0,
                                "inReview", 0,
                                "workedHours", 1.5,
                                "assignedHoursEstimate", 5.0)));

        assertEquals(1, merged.size());
        assertEquals(4.0, merged.get(0).get("workedHours"));
        assertEquals(3, merged.get(0).get("assigned"));
        assertEquals(2, merged.get(0).get("completed"));
        assertEquals(15.0, merged.get(0).get("assignedHoursEstimate"));
    }

    private static UserTask assignment(
            long userId, long taskId, String status, double workedHours, double assignedHours) {
        User user = new User();
        user.setId(userId);
        user.setName("Dev " + userId);

        Task task = new Task();
        task.setId(taskId);
        task.setAssignedHours(assignedHours);

        UserTask ut = new UserTask();
        ut.setId(new UserTaskId(userId, taskId));
        ut.setUser(user);
        ut.setTask(task);
        ut.setStatus(status);
        ut.setWorkedHours(workedHours);
        return ut;
    }
}
