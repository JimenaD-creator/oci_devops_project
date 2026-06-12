package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.SprintInsight;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Compacts persisted sprint insight JSON for the manager chat context.
 */
public final class ManagerChatInsightContextUtil {

    private static final int MAX_ALERTS = 5;
    private static final int MAX_RECOMMENDATIONS = 6;

    private ManagerChatInsightContextUtil() {}

    public static Map<String, Object> compactInsightForChat(SprintInsight insight, ObjectMapper mapper) {
        Map<String, Object> unavailable = new LinkedHashMap<>();
        unavailable.put("available", false);
        if (insight == null) {
            return unavailable;
        }
        if (insight.getErrorMessage() != null && !insight.getErrorMessage().isBlank()) {
            unavailable.put("error", insight.getErrorMessage());
            return unavailable;
        }
        if (insight.getInsightsJson() == null || insight.getInsightsJson().isBlank()) {
            return unavailable;
        }
        try {
            JsonNode root = mapper.readTree(insight.getInsightsJson());
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("available", true);
            if (insight.getGeneratedAt() != null) {
                out.put("generatedAt", insight.getGeneratedAt().toString());
            }

            JsonNode es = root.get("executiveSummary");
            if (es != null && es.isObject()) {
                Map<String, Object> summary = new LinkedHashMap<>();
                putText(summary, "overview", es.path("overview").asText(null));
                putText(summary, "trends", es.path("trends").asText(null));
                putText(summary, "improvementAreas", es.path("improvementAreas").asText(null));
                if (!summary.isEmpty()) {
                    out.put("summary", summary);
                }
            }

            out.put("alerts", readAlerts(root.get("alerts")));
            out.put("recommendations", readRecommendations(root.get("actionableRecommendations")));
            out.put("developerNotes", readDeveloperInsights(root.get("developerInsights")));

            String summaryText = root.path("summary").asText(null);
            if (summaryText != null && !summaryText.isBlank()) {
                out.put("briefSummary", InsightEmbeddingTextBuilder.truncate(summaryText));
            }
            return out;
        } catch (Exception e) {
            unavailable.put("parseError", true);
            return unavailable;
        }
    }

    /** Scrubs stored insight text that may reference database ids as sprint numbers. */
    public static void sanitizeSprintLabelsInInsightMap(
            Map<String, Object> insight,
            String answerLabel,
            Long answerSprintDbId,
            String previousSprintLabel,
            List<String> validSprintLabels) {
        if (insight == null || insight.isEmpty()) {
            return;
        }
        sanitizeStringFields(insight.get("summary"), answerLabel, previousSprintLabel, validSprintLabels, answerSprintDbId);
        sanitizeStringFields(insight.get("briefSummary"), answerLabel, previousSprintLabel, validSprintLabels, answerSprintDbId);
        sanitizeListOfMaps(insight.get("alerts"), "message", answerLabel, previousSprintLabel, validSprintLabels, answerSprintDbId);
        sanitizeListOfMaps(insight.get("recommendations"), "text", answerLabel, previousSprintLabel, validSprintLabels, answerSprintDbId);
        sanitizeListOfMaps(insight.get("developerNotes"), "note", answerLabel, previousSprintLabel, validSprintLabels, answerSprintDbId);
    }

    private static void sanitizeStringFields(
            Object node,
            String answerLabel,
            String previousSprintLabel,
            List<String> validSprintLabels,
            Long answerSprintDbId) {
        if (!(node instanceof Map)) {
            return;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> map = (Map<String, Object>) node;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String) {
                String text = (String) value;
                entry.setValue(
                    ManagerChatReplyUtil.enforceSingleSprintReply(
                        text, answerLabel, previousSprintLabel, validSprintLabels, answerSprintDbId));
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static void sanitizeListOfMaps(
            Object node,
            String textKey,
            String answerLabel,
            String previousSprintLabel,
            List<String> validSprintLabels,
            Long answerSprintDbId) {
        if (!(node instanceof List)) {
            return;
        }
        List<?> list = (List<?>) node;
        for (Object item : list) {
            if (!(item instanceof Map)) {
                continue;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> rowMap = (Map<String, Object>) item;
            Object raw = rowMap.get(textKey);
            if (raw instanceof String) {
                String text = (String) raw;
                rowMap.put(
                    textKey,
                    ManagerChatReplyUtil.enforceSingleSprintReply(
                        text, answerLabel, previousSprintLabel, validSprintLabels, answerSprintDbId));
            }
        }
    }

    /**
     * Cross-sprint view: merges live developer metrics with AI notes per sprint.
     */
    public static List<Map<String, Object>> buildDeveloperPerformanceHistory(
            List<Map<String, Object>> sprintData) {
        List<Map<String, Object>> timeline = new ArrayList<>();
        if (sprintData == null) {
            return timeline;
        }
        for (Map<String, Object> sprint : sprintData) {
            if (sprint == null) {
                continue;
            }
            Object sprintLabel = sprint.get("sprintLabel");

            @SuppressWarnings("unchecked")
            Map<String, Object> sprintAnalysis = sprint.get("sprintAnalysis") instanceof Map
                ? (Map<String, Object>) sprint.get("sprintAnalysis")
                : null;
            if (sprintAnalysis == null || !Boolean.TRUE.equals(sprintAnalysis.get("available"))) {
                continue;
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> devNotes = sprintAnalysis.get("developerNotes") instanceof List
                ? (List<Map<String, Object>>) sprintAnalysis.get("developerNotes")
                : List.of();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> devMetrics = sprint.get("developers") instanceof List
                ? (List<Map<String, Object>>) sprint.get("developers")
                : List.of();

            for (Map<String, Object> di : devNotes) {
                if (di == null) {
                    continue;
                }
                String name = di.get("developerName") != null ? String.valueOf(di.get("developerName")).trim() : "";
                if (name.isBlank()) {
                    continue;
                }
                Map<String, Object> row = new LinkedHashMap<>();
                if (sprintLabel != null) {
                    row.put("sprintLabel", sprintLabel);
                }
                row.put("developerName", name);
                row.put("note", di.get("note"));
                row.put("overloaded", di.get("overloaded"));

                Map<String, Object> metrics = findDeveloperMetrics(devMetrics, name);
                if (metrics != null) {
                    row.put("completed", metrics.get("completed"));
                    row.put("pending", metrics.get("pending"));
                    row.put("workedHours", metrics.get("workedHours"));
                    row.put("assignedHoursEstimate", metrics.get("assignedHoursEstimate"));
                }
                timeline.add(row);
            }
        }
        return timeline;
    }

    private static Map<String, Object> findDeveloperMetrics(List<Map<String, Object>> devMetrics, String name) {
        String normalized = normalizeName(name);
        for (Map<String, Object> m : devMetrics) {
            if (m == null) {
                continue;
            }
            Object n = m.get("name");
            if (n != null && normalizeName(String.valueOf(n)).equals(normalized)) {
                return m;
            }
        }
        return null;
    }

    private static String normalizeName(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    private static void putText(Map<String, Object> target, String key, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        target.put(key, InsightEmbeddingTextBuilder.truncate(value));
    }

    private static List<Map<String, Object>> readAlerts(JsonNode alerts) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (alerts == null || !alerts.isArray()) {
            return out;
        }
        int count = 0;
        for (JsonNode alert : alerts) {
            if (count >= MAX_ALERTS) {
                break;
            }
            String message = alert.path("message").asText(null);
            if (message == null || message.isBlank()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("severity", alert.path("severity").asText("info"));
            row.put("message", InsightEmbeddingTextBuilder.truncate(message));
            out.add(row);
            count++;
        }
        return out;
    }

    private static List<Map<String, Object>> readRecommendations(JsonNode recs) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (recs == null || !recs.isArray()) {
            return out;
        }
        int count = 0;
        for (JsonNode rec : recs) {
            if (count >= MAX_RECOMMENDATIONS) {
                break;
            }
            String text = rec.path("text").asText(null);
            if (text == null || text.isBlank()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("category", rec.path("category").asText(""));
            row.put("text", InsightEmbeddingTextBuilder.truncate(text));
            out.add(row);
            count++;
        }
        return out;
    }

    private static List<Map<String, Object>> readDeveloperInsights(JsonNode devInsights) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (devInsights == null || !devInsights.isArray()) {
            return out;
        }
        for (JsonNode dev : devInsights) {
            String name = dev.path("developerName").asText(null);
            String insight = dev.path("insight").asText(null);
            if (name == null || name.isBlank() || insight == null || insight.isBlank()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("developerName", name.trim());
            row.put("note", InsightEmbeddingTextBuilder.truncate(insight));
            row.put("overloaded", dev.path("overloaded").asBoolean(false));
            out.add(row);
        }
        return out;
    }
}
