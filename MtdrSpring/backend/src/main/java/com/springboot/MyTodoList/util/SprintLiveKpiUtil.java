package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Live sprint KPIs aligned with {@code dashboardSprintData.deriveKpisFromLiveData} and KPI Analytics.
 */
public final class SprintLiveKpiUtil {

    private SprintLiveKpiUtil() {}

    public static Map<String, Object> computeLiveKpis(
            Sprint sprint,
            List<Task> sprintTasks,
            List<UserTask> sprintUserTasks) {
        Map<String, Integer> statusCounts = new LinkedHashMap<>();
        statusCounts.put("TODO", 0);
        statusCounts.put("IN_PROGRESS", 0);
        statusCounts.put("IN_REVIEW", 0);
        statusCounts.put("DONE", 0);

        if (sprintTasks != null) {
            for (Task task : sprintTasks) {
                if (task == null) {
                    continue;
                }
                String bucket = bucketTaskStatus(task.getStatus());
                statusCounts.merge(bucket, 1, Integer::sum);
            }
        }

        int totalTasks = statusCounts.values().stream().mapToInt(Integer::intValue).sum();
        int totalCompleted = statusCounts.getOrDefault("DONE", 0);
        int completionRate = totalTasks > 0 ? (int) Math.round((100.0 * totalCompleted) / totalTasks) : 0;

        Map<Long, Integer> assigneeCountByTask = new HashMap<>();
        LinkedHashMap<String, UserTask> dedupedAssignments = new LinkedHashMap<>();
        if (sprintUserTasks != null) {
            for (UserTask ut : sprintUserTasks) {
                if (ut == null || ut.getId() == null) {
                    continue;
                }
                String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
                dedupedAssignments.putIfAbsent(key, ut);
            }
        }
        for (UserTask ut : dedupedAssignments.values()) {
            if (ut.getId() != null) {
                assigneeCountByTask.merge(ut.getId().getTaskId(), 1, Integer::sum);
            }
        }

        int doneAssignments = 0;
        int onTimeAssignments = 0;
        double totalWorkedHours = 0.0;
        for (UserTask ut : dedupedAssignments.values()) {
            Task task = ut.getTask();
            if (task == null) {
                continue;
            }
            totalWorkedHours += SprintDeveloperMetricsUtil.userTaskWorkedHours(ut);
            if (!UserTask.isCompletedAssignmentStatus(ut.getStatus())) {
                continue;
            }
            doneAssignments += 1;
            int assigneeCount = assigneeCountByTask.getOrDefault(task.getId(), 1);
            Boolean onTime = UserTaskOnTimeUtil.evaluateAssignmentOnTime(ut, task, assigneeCount);
            if (Boolean.TRUE.equals(onTime)) {
                onTimeAssignments += 1;
            }
        }

        int onTimeDelivery = doneAssignments > 0
                ? (int) Math.round((100.0 * onTimeAssignments) / doneAssignments)
                : 0;

        long totalExpectedHours = 0L;
        if (sprintTasks != null) {
            for (Task task : sprintTasks) {
                if (task == null || task.getAssignedHours() == null) {
                    continue;
                }
                totalExpectedHours += task.getAssignedHours();
            }
        }
        int teamParticipation = totalExpectedHours > 0
                ? (int) Math.round((100.0 * totalWorkedHours) / totalExpectedHours)
                : 0;
        teamParticipation = Math.min(100, Math.max(0, teamParticipation));

        int workloadBalance = normalizeWorkloadBalancePercent(
                sprint != null ? sprint.getWorkloadBalance() : null);

        int productivityScore = computeProductivityScore(
                completionRate, onTimeDelivery, teamParticipation, workloadBalance);

        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("completionRate", completionRate);
        kpis.put("onTimeDelivery", onTimeDelivery);
        kpis.put("teamParticipation", teamParticipation);
        kpis.put("workloadBalance", workloadBalance);
        kpis.put("productivityScore", productivityScore);
        kpis.put("totalTasks", totalTasks);
        kpis.put("totalCompleted", totalCompleted);
        kpis.put("totalWorkedHours", SprintDeveloperMetricsUtil.roundChartHours(totalWorkedHours));
        kpis.put("totalExpectedHours", totalExpectedHours);
        return kpis;
    }

    public static String bucketTaskStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return "TODO";
        }
        String s = raw.trim().toUpperCase().replaceAll("[\\s-]+", "_");
        if (s.equals("DONE") || s.equals("COMPLETED") || s.equals("COMPLETE")) {
            return "DONE";
        }
        if (s.equals("IN_REVIEW") || s.equals("REVIEW")) {
            return "IN_REVIEW";
        }
        if (s.equals("IN_PROGRESS") || s.equals("IN_PROCESS")) {
            return "IN_PROGRESS";
        }
        return "TODO";
    }

    public static int normalizeWorkloadBalancePercent(BigDecimal raw) {
        if (raw == null) {
            return 0;
        }
        double n = raw.doubleValue();
        if (!Double.isFinite(n)) {
            return 0;
        }
        double pct = n <= 1.0 ? n * 100.0 : n;
        return (int) Math.min(100, Math.max(0, Math.round(pct)));
    }

    /** Same weights as {@code productivityScoreUtils.js}. */
    public static int computeProductivityScore(
            int completionRate, int onTimeDelivery, int teamParticipation, int workloadBalance) {
        int cr = clampPercent(completionRate);
        int otd = clampPercent(onTimeDelivery);
        int tp = clampPercent(teamParticipation);
        int wb = clampPercent(workloadBalance);
        int score = (int) Math.round(cr * 0.4 + otd * 0.3 + tp * 0.2 + wb * 0.1);
        return Math.min(100, Math.max(0, score));
    }

    private static int clampPercent(int value) {
        return Math.min(100, Math.max(0, value));
    }
}
