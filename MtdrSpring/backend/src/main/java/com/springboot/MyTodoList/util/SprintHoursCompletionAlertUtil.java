package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Deterministic AI Insights alert: compares logged hours vs completed tasks against the
 * immediately previous sprint (hours per completed task, with completion context).
 */
public final class SprintHoursCompletionAlertUtil {

    public static final String ALERT_SOURCE = "hoursVsPreviousSprint";

    /** Minimum relative change in hours-per-completed-task to surface an alert. */
    private static final double HOURS_PER_TASK_CHANGE_THRESHOLD = 0.25;

    /** Completed-task counts within this fraction are treated as "similar output". */
    private static final double COMPLETION_SIMILAR_FRACTION = 0.15;

    private SprintHoursCompletionAlertUtil() {}

    public static final class DeliverySnapshot {
        private final int completedTasks;
        private final double workedHours;

        public DeliverySnapshot(int completedTasks, double workedHours) {
            this.completedTasks = Math.max(0, completedTasks);
            this.workedHours = Math.max(0.0, workedHours);
        }

        public int getCompletedTasks() {
            return completedTasks;
        }

        public double getWorkedHours() {
            return workedHours;
        }

        public static DeliverySnapshot fromLiveKpis(Map<String, Object> live) {
            if (live == null || live.isEmpty()) {
                return new DeliverySnapshot(0, 0.0);
            }
            int completed = intFrom(live.get("totalCompleted"));
            double hours = doubleFrom(live.get("totalWorkedHours"));
            return new DeliverySnapshot(completed, hours);
        }
    }

    /**
     * @param sprintEnded {@code true} when sprint calendar phase is {@code ended}
     * @param sprintEarly {@code true} when sprint is in first days (early snapshot)
     */
    public static Optional<Map<String, Object>> buildAlert(
            DeliverySnapshot current,
            DeliverySnapshot previous,
            String previousSprintLabel,
            boolean sprintEnded,
            boolean sprintEarly) {
        if (current == null || previous == null) {
            return Optional.empty();
        }
        if (sprintEarly) {
            return Optional.empty();
        }
        if (previous.getCompletedTasks() < 1 || current.getCompletedTasks() < 1) {
            return Optional.empty();
        }
        if (previous.getWorkedHours() <= 0.0 && current.getWorkedHours() <= 0.0) {
            return Optional.empty();
        }
        if (current.getWorkedHours() <= 0.0 && current.getCompletedTasks() > 0) {
            return Optional.empty();
        }

        String prevLabel = labelOrDefault(previousSprintLabel);
        double prevRate = previous.getWorkedHours() / previous.getCompletedTasks();
        double curRate = current.getWorkedHours() / Math.max(1, current.getCompletedTasks());
        if (prevRate <= 0.0) {
            return Optional.empty();
        }

        double rateChangeFraction = (curRate - prevRate) / prevRate;
        boolean completionSimilar =
                completionCountsSimilar(current.getCompletedTasks(), previous.getCompletedTasks());

        if (rateChangeFraction >= HOURS_PER_TASK_CHANGE_THRESHOLD) {
            int pct = (int) Math.round(rateChangeFraction * 100.0);
            String severity = sprintEnded ? "warning" : "info";
            String message = String.format(
                    Locale.ROOT,
                    "Team logged %d%% more hours per completed task than %s: %d Done with %sh logged "
                            + "vs %d Done with %sh in %s. Review estimates and timesheet accuracy.",
                    pct,
                    prevLabel,
                    current.getCompletedTasks(),
                    formatHours(current.getWorkedHours()),
                    previous.getCompletedTasks(),
                    formatHours(previous.getWorkedHours()),
                    prevLabel);
            return Optional.of(alertMap(severity, message));
        }

        if (rateChangeFraction <= -HOURS_PER_TASK_CHANGE_THRESHOLD) {
            int pct = (int) Math.round(Math.abs(rateChangeFraction) * 100.0);
            if (completionSimilar) {
                String message = String.format(
                        Locale.ROOT,
                        "Team logged %d%% fewer hours per completed task than %s with similar completions "
                                + "(%d Done, %sh vs %d Done, %sh). Delivery pace improved or estimates were conservative.",
                        pct,
                        prevLabel,
                        current.getCompletedTasks(),
                        formatHours(current.getWorkedHours()),
                        previous.getCompletedTasks(),
                        formatHours(previous.getWorkedHours()));
                return Optional.of(alertMap("info", message));
            }
            if (current.getCompletedTasks() < previous.getCompletedTasks() && !completionSimilar) {
                String severity = sprintEnded ? "warning" : "info";
                String message = String.format(
                        Locale.ROOT,
                        "Logged hours fell %d%% vs %s but completed tasks dropped from %d to %d "
                                + "(%sh vs %sh). Validate timesheet logging so KPIs reflect actual effort.",
                        pct,
                        prevLabel,
                        previous.getCompletedTasks(),
                        current.getCompletedTasks(),
                        formatHours(current.getWorkedHours()),
                        formatHours(previous.getWorkedHours()));
                return Optional.of(alertMap(severity, message));
            }
        }

        return Optional.empty();
    }

    public static boolean alertsAlreadyContainHoursVsPrevious(ArrayNode alerts) {
        if (alerts == null) {
            return false;
        }
        for (JsonNode item : alerts) {
            if (item != null && ALERT_SOURCE.equals(item.path("alertSource").asText(""))) {
                return true;
            }
        }
        return false;
    }

    private static Map<String, Object> alertMap(String severity, String message) {
        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("severity", severity);
        alert.put("kpi", "sprintComparison");
        alert.put("message", message);
        alert.put("alertSource", ALERT_SOURCE);
        return alert;
    }

    static boolean completionCountsSimilar(int currentCompleted, int previousCompleted) {
        if (previousCompleted <= 0) {
            return false;
        }
        int delta = Math.abs(currentCompleted - previousCompleted);
        int tolerance = Math.max(1, (int) Math.round(previousCompleted * COMPLETION_SIMILAR_FRACTION));
        return delta <= tolerance;
    }

    private static String labelOrDefault(String previousSprintLabel) {
        if (previousSprintLabel == null || previousSprintLabel.isBlank()) {
            return "the previous sprint";
        }
        return previousSprintLabel.trim();
    }

    private static String formatHours(double hours) {
        return String.format(Locale.ROOT, "%.1f", hours);
    }

    private static int intFrom(Object value) {
        if (!(value instanceof Number)) {
            return 0;
        }
        return Math.max(0, ((Number) value).intValue());
    }

    private static double doubleFrom(Object value) {
        if (!(value instanceof Number)) {
            return 0.0;
        }
        return ((Number) value).doubleValue();
    }
}
