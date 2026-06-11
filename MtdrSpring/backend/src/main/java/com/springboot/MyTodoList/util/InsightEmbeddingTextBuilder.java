package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Builds a compact text chunk from persisted sprint insight JSON for embedding.
 * Avoids embedding the full JSON blob — focuses on alerts, summary, and KPI snapshot.
 */
public final class InsightEmbeddingTextBuilder {

    private static final int MAX_FIELD_CHARS = 480;
    private static final int MAX_ALERTS = 4;
    private static final int MAX_RECOMMENDATIONS = 3;

    private InsightEmbeddingTextBuilder() {}

    public static String buildFromInsightsJson(JsonNode root) {
        if (root == null || !root.isObject()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();

        appendKpiSnapshot(sb, root.get("generationKpiSnapshot"));
        appendExecutiveSummary(sb, root.get("executiveSummary"));
        appendAlerts(sb, root.get("alerts"));
        appendRecommendations(sb, root.get("actionableRecommendations"));
        appendSummary(sb, root.path("summary").asText(null));

        return sb.toString().trim();
    }

    private static void appendKpiSnapshot(StringBuilder sb, JsonNode snapshot) {
        if (snapshot == null || !snapshot.isObject()) {
            return;
        }
        sb.append("KPIs: ");
        appendMetric(sb, "completion", snapshot.path("completionRate"));
        appendMetric(sb, "on-time", snapshot.path("onTimeDelivery"));
        appendMetric(sb, "efficiency", snapshot.path("efficiencyScore"));
        appendMetric(sb, "workload balance", snapshot.path("workloadBalance"));
        appendMetric(sb, "productivity", snapshot.path("productivityScore"));
        sb.append(". ");
    }

    private static void appendMetric(StringBuilder sb, String label, JsonNode value) {
        if (value == null || value.isNull()) {
            return;
        }
        if (value.isNumber()) {
            sb.append(label).append(' ').append(Math.round(value.asDouble())).append("%, ");
        }
    }

    private static void appendExecutiveSummary(StringBuilder sb, JsonNode es) {
        if (es == null || !es.isObject()) {
            return;
        }
        appendLine(sb, "Overview", es.path("overview").asText(null));
        appendLine(sb, "Trends", es.path("trends").asText(null));
        appendLine(sb, "Risks", es.path("improvementAreas").asText(null));
    }

    private static void appendAlerts(StringBuilder sb, JsonNode alerts) {
        if (alerts == null || !alerts.isArray()) {
            return;
        }
        int count = 0;
        for (JsonNode alert : alerts) {
            if (count >= MAX_ALERTS) {
                break;
            }
            String severity = alert.path("severity").asText("info");
            String message = truncate(alert.path("message").asText(null));
            if (message == null || message.isBlank()) {
                continue;
            }
            sb.append("Alert ").append(severity).append(": ").append(message).append(' ');
            count++;
        }
    }

    private static void appendRecommendations(StringBuilder sb, JsonNode recs) {
        if (recs == null || !recs.isArray()) {
            return;
        }
        int count = 0;
        for (JsonNode rec : recs) {
            if (count >= MAX_RECOMMENDATIONS) {
                break;
            }
            String category = rec.path("category").asText("");
            String text = truncate(rec.path("text").asText(null));
            if (text == null || text.isBlank()) {
                continue;
            }
            sb.append("Recommendation");
            if (!category.isBlank()) {
                sb.append(' ').append(category.replace('_', ' '));
            }
            sb.append(": ").append(text).append(' ');
            count++;
        }
    }

    private static void appendSummary(StringBuilder sb, String summary) {
        appendLine(sb, "Summary", summary);
    }

    private static void appendLine(StringBuilder sb, String label, String text) {
        if (text == null || text.isBlank()) {
            return;
        }
        sb.append(label).append(": ").append(truncate(text)).append(' ');
    }

    public static String truncate(String text) {
        if (text == null) {
            return null;
        }
        String trimmed = text.trim();
        if (trimmed.length() <= MAX_FIELD_CHARS) {
            return trimmed;
        }
        return trimmed.substring(0, MAX_FIELD_CHARS - 3) + "...";
    }

    /** Short snippet for UI cards — prefers top alert, else overview. */
    public static String buildDisplaySnippet(JsonNode root) {
        if (root == null || !root.isObject()) {
            return "";
        }
        JsonNode alerts = root.get("alerts");
        if (alerts != null && alerts.isArray()) {
            for (JsonNode alert : alerts) {
                String message = alert.path("message").asText(null);
                if (message != null && !message.isBlank()) {
                    return truncate(message);
                }
            }
        }
        JsonNode overview = root.path("executiveSummary").path("overview");
        if (overview.isTextual() && !overview.asText().isBlank()) {
            return truncate(overview.asText());
        }
        String summary = root.path("summary").asText(null);
        return summary != null ? truncate(summary) : "";
    }
}
