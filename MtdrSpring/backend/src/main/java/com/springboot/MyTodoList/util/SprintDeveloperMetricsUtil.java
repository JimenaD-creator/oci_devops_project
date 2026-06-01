package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Per-developer sprint metrics aligned with the dashboard charts
 * ({@code dashboardSprintData.enrichSprintsWithUserTasks}).
 */
public final class SprintDeveloperMetricsUtil {

    private SprintDeveloperMetricsUtil() {}

    /** Sum of USER_TASK.WORKED_HOURS for chart rollups (null → 0). */
    public static double userTaskWorkedHours(UserTask ut) {
        if (ut == null || ut.getWorkedHours() == null) {
            return 0.0;
        }
        double n = ut.getWorkedHours();
        return Double.isFinite(n) && n >= 0 ? n : 0.0;
    }

    public static double roundChartHours(double hours) {
        return Math.round(hours * 10.0) / 10.0;
    }

    public static List<Map<String, Object>> buildDeveloperSummaryRows(List<UserTask> userTasks) {
        if (userTasks == null || userTasks.isEmpty()) {
            return List.of();
        }

        Map<Long, DevAgg> byUser = new LinkedHashMap<>();
        Set<String> seenKeys = new LinkedHashSet<>();

        for (UserTask ut : userTasks) {
            if (ut == null || ut.getId() == null || ut.getTask() == null) {
                continue;
            }
            String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
            if (!seenKeys.add(key)) {
                continue;
            }

            Long uid = ut.getId().getUserId();
            Long taskId = ut.getId().getTaskId();
            Task task = ut.getTask();
            User user = ut.getUser();
            String name = (user != null && user.getName() != null && !user.getName().isBlank())
                ? user.getName().trim()
                : ("User " + uid);

            DevAgg dev = byUser.computeIfAbsent(uid, id -> new DevAgg(id, name));
            if (user != null && user.getName() != null && !user.getName().isBlank()) {
                dev.name = user.getName().trim();
            }

            boolean newTask = dev.assignedTaskIds.add(taskId);
            if (newTask && task.getAssignedHours() != null) {
                dev.assignedHoursEstimate += task.getAssignedHours();
            }

            if (UserTask.isCompletedAssignmentStatus(ut.getStatus())) {
                dev.completedTaskIds.add(taskId);
            } else {
                String norm = normalizeAssignmentStatus(ut.getStatus());
                if ("In progress".equals(norm)) {
                    dev.inProgressTaskIds.add(taskId);
                } else if ("In review".equals(norm)) {
                    dev.inReviewTaskIds.add(taskId);
                } else {
                    dev.toDoTaskIds.add(taskId);
                }
            }

            dev.workedHours += userTaskWorkedHours(ut);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (DevAgg dev : byUser.values()) {
            out.add(dev.toMap());
        }
        return out;
    }

    /**
     * Merges per-sprint developer rows by userId (same as dashboard multi-sprint selection).
     */
    public static List<Map<String, Object>> mergeDeveloperRowsByUserId(
            List<Map<String, Object>> perSprintRows) {
        if (perSprintRows == null || perSprintRows.isEmpty()) {
            return List.of();
        }
        Map<Long, Map<String, Object>> merged = new LinkedHashMap<>();
        for (Map<String, Object> row : perSprintRows) {
            if (row == null) {
                continue;
            }
            Object uidObj = row.get("userId");
            if (!(uidObj instanceof Number)) {
                continue;
            }
            long uid = ((Number) uidObj).longValue();
            Map<String, Object> cur = merged.computeIfAbsent(uid, id -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("userId", id);
                m.put("name", row.get("name"));
                m.put("assigned", 0);
                m.put("completed", 0);
                m.put("pending", 0);
                m.put("inProgress", 0);
                m.put("toDo", 0);
                m.put("inReview", 0);
                m.put("workedHours", 0.0);
                m.put("assignedHoursEstimate", 0.0);
                return m;
            });
            cur.put("assigned", (int) cur.get("assigned") + intVal(row.get("assigned")));
            cur.put("completed", (int) cur.get("completed") + intVal(row.get("completed")));
            cur.put("pending", (int) cur.get("pending") + intVal(row.get("pending")));
            cur.put("inProgress", (int) cur.get("inProgress") + intVal(row.get("inProgress")));
            cur.put("toDo", (int) cur.get("toDo") + intVal(row.get("toDo")));
            cur.put("inReview", (int) cur.get("inReview") + intVal(row.get("inReview")));
            cur.put(
                    "workedHours",
                    roundChartHours(
                            doubleVal(cur.get("workedHours")) + doubleVal(row.get("workedHours"))));
            cur.put(
                    "assignedHoursEstimate",
                    roundChartHours(
                            doubleVal(cur.get("assignedHoursEstimate"))
                                    + doubleVal(row.get("assignedHoursEstimate"))));
        }
        return new ArrayList<>(merged.values());
    }

    public static Map<String, Object> rosterOnlyRow(Long userId, String name) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("userId", userId);
        m.put("name", name);
        m.put("assigned", 0);
        m.put("completed", 0);
        m.put("pending", 0);
        m.put("inProgress", 0);
        m.put("toDo", 0);
        m.put("inReview", 0);
        m.put("workedHours", 0.0);
        m.put("assignedHoursEstimate", 0.0);
        m.put("rosterOnly", true);
        return m;
    }

    private static String normalizeAssignmentStatus(String raw) {
        if (raw == null) {
            return "To do";
        }
        String n = raw.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        if (n.equals("TODO") || n.equals("TO_DO") || n.equals("PENDING") || n.equals("BACKLOG")) {
            return "To do";
        }
        if (n.equals("IN_PROCESS") || n.equals("IN_PROGRESS") || n.equals("DOING")) {
            return "In progress";
        }
        if (n.equals("IN_REVIEW") || n.equals("REVIEW") || n.equals("QA")) {
            return "In review";
        }
        if (n.equals("DONE") || n.equals("COMPLETED") || n.equals("FINISHED") || n.equals("COMPLETE")) {
            return "Done";
        }
        return raw;
    }

    private static int intVal(Object o) {
        if (o instanceof Number) {
            return ((Number) o).intValue();
        }
        return 0;
    }

    private static double doubleVal(Object o) {
        if (o instanceof Number) {
            return ((Number) o).doubleValue();
        }
        return 0.0;
    }

    private static final class DevAgg {
        final Long userId;
        String name;
        final Set<Long> assignedTaskIds = new LinkedHashSet<>();
        final Set<Long> completedTaskIds = new LinkedHashSet<>();
        final Set<Long> inProgressTaskIds = new LinkedHashSet<>();
        final Set<Long> toDoTaskIds = new LinkedHashSet<>();
        final Set<Long> inReviewTaskIds = new LinkedHashSet<>();
        double workedHours;
        long assignedHoursEstimate;

        DevAgg(Long userId, String name) {
            this.userId = userId;
            this.name = name;
        }

        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", userId);
            m.put("name", name);
            int assigned = assignedTaskIds.size();
            int completed = completedTaskIds.size();
            m.put("assigned", assigned);
            m.put("completed", completed);
            m.put("pending", Math.max(0, assigned - completed));
            m.put("inProgress", inProgressTaskIds.size());
            m.put("toDo", toDoTaskIds.size());
            m.put("inReview", inReviewTaskIds.size());
            m.put("workedHours", roundChartHours(workedHours));
            m.put("assignedHoursEstimate", roundChartHours(assignedHoursEstimate));
            return m;
        }
    }
}
