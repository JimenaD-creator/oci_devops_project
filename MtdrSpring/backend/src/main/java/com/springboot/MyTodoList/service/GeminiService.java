package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.SprintInsight;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Service
public class GeminiService {

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private SprintInsightRepository insightRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(60))
        .build();

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    @Async
    public CompletableFuture<SprintInsight> generateInsightsForSprint(Long sprintId) {
        System.out.println("[GeminiService] API key present: " + 
    (geminiApiKey != null && !geminiApiKey.isBlank() ? 
     "YES (length=" + geminiApiKey.length() + ")" : "NO/EMPTY"));
        try {
            Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
            if (sprint == null) {
                saveErrorInsight(sprintId, null, "Sprint not found: " + sprintId);
                return CompletableFuture.failedFuture(
                    new IllegalArgumentException("Sprint not found: " + sprintId));
            }

            Long projectId = sprint.getAssignedProject() != null
                ? sprint.getAssignedProject().getId() : null;
            if (projectId == null) {
                saveErrorInsight(sprintId, null, "Sprint has no project assigned.");
                return CompletableFuture.failedFuture(
                    new IllegalStateException("Sprint has no project assigned"));
            }

            List<Sprint> historicalSprints = sprintRepository
                .findByAssignedProjectIdOrderByStartDateAsc(projectId);

            String prompt = buildPrompt(sprint, historicalSprints);
            System.out.println("[GeminiService] Prompt length: " + prompt.length());
            System.out.println("[GeminiService] Prompt preview: " + prompt.substring(0, Math.min(200, prompt.length())));
            String rawJson = callGemini(prompt);
            String insightsJson = extractJsonFromGeminiResponse(rawJson);

            SprintInsight insight = insightRepository.findBySprintId(sprintId)
                .orElse(new SprintInsight());
            insight.setSprintId(sprintId);
            insight.setProjectId(projectId);
            insight.setInsightsJson(insightsJson);
            insight.setGeneratedAt(LocalDateTime.now());
            insight.setAcknowledged(false);
            insight.setErrorMessage(null); // clear any previous error
            insightRepository.save(insight);

            System.out.println("[GeminiService] Insights saved for sprint " + sprintId);
            return CompletableFuture.completedFuture(insight);

        } catch (Exception e) {
            System.err.println("[GeminiService] Error generating insights: " + e.getMessage());
            // Persist the error so the frontend stops polling immediately
            try {
                saveErrorInsight(sprintId, null, e.getMessage());
            } catch (Exception saveEx) {
                System.err.println("[GeminiService] Could not save error insight: " + saveEx.getMessage());
            }
            return CompletableFuture.failedFuture(e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERROR PERSISTENCE
    // Saves a row with insightsJson=null and a human-readable errorMessage.
    // The frontend checks for this field and stops polling immediately.
    // ─────────────────────────────────────────────────────────────────────────

    private void saveErrorInsight(Long sprintId, Long projectId, String errorMessage) {
        try {
            SprintInsight insight = insightRepository.findBySprintId(sprintId)
                .orElse(new SprintInsight());
            insight.setSprintId(sprintId);
            if (projectId != null) insight.setProjectId(projectId);
            else if (insight.getProjectId() == null) insight.setProjectId(-1L); // placeholder
            insight.setInsightsJson(null);
            insight.setGeneratedAt(LocalDateTime.now());
            insight.setAcknowledged(false);
            insight.setErrorMessage(sanitizeError(errorMessage));
            insightRepository.save(insight);
        } catch (Exception e) {
            System.err.println("[GeminiService] saveErrorInsight failed: " + e.getMessage());
        }
    }

    /**
     * Converts raw API error messages into short, user-friendly strings.
     */
    private String sanitizeError(String raw) {
        if (raw == null) return "Unknown error.";
        if (raw.contains("429") || raw.contains("RESOURCE_EXHAUSTED") || raw.contains("quota")) {
            return "QUOTA_EXCEEDED";
        }
        if (raw.contains("API key") || raw.contains("not configured")) {
            return "API_KEY_MISSING";
        }
        if (raw.contains("404") && raw.contains("not found")) {
            return "MODEL_NOT_FOUND";
        }
        if (raw.contains("Sprint not found")) {
            return "SPRINT_NOT_FOUND";
        }
        if (raw.contains("no project")) {
            return "NO_PROJECT_ASSIGNED";
        }
        return "GENERATION_FAILED";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROMPT ENGINEERING
    // ─────────────────────────────────────────────────────────────────────────

    private String buildPrompt(Sprint currentSprint, List<Sprint> allSprints) {
        double cr  = toPercent(currentSprint.getCompletionRate());
        double otd = toPercent(currentSprint.getOnTimeDelivery());
        double tp  = toPercent(currentSprint.getTeamParticipation());
        double wb  = toPercent(currentSprint.getWorkloadBalance());
        double ps  = (cr * 0.4) + (otd * 0.3) + (tp * 0.2) + (wb * 0.1);

        List<Sprint> previousSprints = allSprints.stream()
            .filter(s -> !s.getId().equals(currentSprint.getId()))
            .sorted((a, b) -> {
                if (a.getStartDate() == null || b.getStartDate() == null) return 0;
                return b.getStartDate().compareTo(a.getStartDate());
            })
            .limit(5)
            .collect(java.util.stream.Collectors.toList());

        StringBuilder historyJson = new StringBuilder("[");
        for (int i = 0; i < previousSprints.size(); i++) {
            Sprint s = previousSprints.get(i);
            if (i > 0) historyJson.append(",");
            historyJson.append(String.format(
                "{\"sprintId\":%d,\"completionRate\":%.1f,\"onTimeDelivery\":%.1f," +
                "\"teamParticipation\":%.1f,\"workloadBalance\":%.1f,\"productivityScore\":%.1f}",
                s.getId(),
                toPercent(s.getCompletionRate()),
                toPercent(s.getOnTimeDelivery()),
                toPercent(s.getTeamParticipation()),
                toPercent(s.getWorkloadBalance()),
                computeProductivityScore(s)
            ));
        }
        historyJson.append("]");

        String trendHint = detectTrendHint(previousSprints, currentSprint);

        return "You are an expert Agile coach analyzing sprint KPI data for a software development team.\n\n" +
            "Analyze the following sprint data and return ONLY a valid JSON object with no markdown, no backticks, no explanation outside the JSON.\n\n" +
            "## Current Sprint (ID: " + currentSprint.getId() + ")\n" +
            String.format(
                "{\"sprintId\":%d,\"completionRate\":%.1f,\"onTimeDelivery\":%.1f," +
                "\"teamParticipation\":%.1f,\"workloadBalance\":%.1f,\"productivityScore\":%.1f}\n\n",
                currentSprint.getId(), cr, otd, tp, wb, ps) +
            "## Historical Data (previous sprints, most recent first)\n" +
            historyJson + "\n\n" +
            "## Context\n" +
            "- KPI scale: 0-100 (100 = perfect)\n" +
            "- productivityScore = (completionRate x 0.4) + (onTimeDelivery x 0.3) + (teamParticipation x 0.2) + (workloadBalance x 0.1)\n" +
            "- workloadBalance < 70 means task distribution is uneven across developers\n" +
            "- " + trendHint + "\n\n" +
            "## Required JSON Response Structure\n" +
            "Return exactly this structure:\n" +
            "{\"alerts\":[{\"severity\":\"critical\",\"kpi\":\"onTimeDelivery\"," +
            "\"message\":\"On-time delivery dropped 3 consecutive sprints. Immediate attention required.\"," +
            "\"value\":40,\"threshold\":60}]," +
            "\"workloadRecommendations\":[{\"from\":\"Most loaded developer\"," +
            "\"to\":\"Least loaded developer\",\"tasksToMove\":2," +
            "\"reason\":\"Workload balance is 55%, indicating significant skew.\"}]," +
            "\"productivityPrediction\":{\"predictedScore\":72,\"trend\":\"down\"," +
            "\"confidence\":\"medium\",\"reasoning\":\"Consistent decline in on-time delivery.\"}," +
            "\"summary\":\"2-3 sentence assessment of sprint performance and top priority action.\"}\n\n" +
            "## Rules\n" +
            "- alerts: severity must be exactly 'critical' (KPI < 40 or dropped 20+ pts in 2+ sprints), 'warning' (KPI < 60), or 'info'. Empty array [] if no issues.\n" +
            "- workloadRecommendations: only if workloadBalance < 70. Empty array [] if balance is acceptable.\n" +
            "- productivityPrediction.trend: exactly 'up', 'down', or 'stable'\n" +
            "- All numeric values are integers 0-100\n" +
            "- Do not include any text outside the JSON object";
    }

    private String detectTrendHint(List<Sprint> previous, Sprint current) {
        if (previous.isEmpty()) return "This is the first sprint — no historical trend available.";

        Sprint last = previous.get(0);
        double currentOtd  = toPercent(current.getOnTimeDelivery());
        double previousOtd = toPercent(last.getOnTimeDelivery());
        double drop = previousOtd - currentOtd;

        List<String> hints = new ArrayList<>();
        if (drop >= 20) hints.add("On-time delivery dropped " + (int)drop + " points since last sprint.");
        if (toPercent(current.getWorkloadBalance()) < 70)
            hints.add("Workload balance is below 70%% — tasks may be unevenly distributed.");
        if (toPercent(current.getCompletionRate()) < 50)
            hints.add("Completion rate is below 50%% — team may be overloaded or blocked.");

        if (previous.size() >= 2) {
            Sprint secondLast = previous.get(1);
            double otd2 = toPercent(secondLast.getOnTimeDelivery());
            if (previousOtd < otd2 && currentOtd < previousOtd) {
                hints.add("On-time delivery has declined for 3 consecutive sprints: "
                    + (int)otd2 + " → " + (int)previousOtd + " → " + (int)currentOtd + "%%.");
            }
        }

        return hints.isEmpty() ? "No critical trends detected from previous sprint." : String.join(" ", hints);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HTTP CALL TO GEMINI
    // ─────────────────────────────────────────────────────────────────────────

    private String callGemini(String prompt) throws Exception {
    if (geminiApiKey == null || geminiApiKey.isBlank()) {
        throw new IllegalStateException("Gemini API key not configured.");
    }

    String requestBody = "{\"contents\":[{\"parts\":[{\"text\":" +
        mapper.writeValueAsString(prompt) +
        "}]}],\"generationConfig\":{\"temperature\":0.3,\"maxOutputTokens\":8192," +
        "\"responseMimeType\":\"application/json\"}}";

    int maxRetries = 4;
    int delaySeconds = 8;

    for (int attempt = 1; attempt <= maxRetries; attempt++) {
        System.out.println("[GeminiService] Attempt " + attempt + "/" + maxRetries);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(GEMINI_URL + "?key=" + geminiApiKey))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(60)) // ← sube a 60s
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        HttpResponse<String> response = httpClient.send(
            request, HttpResponse.BodyHandlers.ofString());

        int status = response.statusCode();

        if (status == 200) {
            System.out.println("[GeminiService] Raw Gemini response: " + response.body());
            return response.body();
        }

        if ((status == 503 || status == 500) && attempt < maxRetries) {
            System.out.println("[GeminiService] 503 on attempt " + attempt +
                ", retrying in " + delaySeconds + "s...");
            Thread.sleep(delaySeconds * 1000L);
            delaySeconds *= 2; // 8s → 16s → 32s → falla
            continue;
        }

        // Errores que NO ameritan retry
        if (status == 429) throw new RuntimeException("429: Gemini quota exceeded.");
        if (status == 401 || status == 403) throw new RuntimeException("API key invalid.");
        if (status == 404) throw new RuntimeException("404: Model not found.");
        throw new RuntimeException("Gemini HTTP " + status + " - body: " + response.body());
    }

    throw new RuntimeException("Gemini unavailable after " + maxRetries + " attempts (503).");
}
    private String extractJsonFromGeminiResponse(String rawGeminiResponse) throws Exception {
        JsonNode root = mapper.readTree(rawGeminiResponse);
        String text = root
            .path("candidates").get(0)
            .path("content")
            .path("parts").get(0)
            .path("text")
            .asText();

        text = text.trim();
        if (text.startsWith("```json")) text = text.substring(7);
        if (text.startsWith("```"))     text = text.substring(3);
        if (text.endsWith("```"))       text = text.substring(0, text.length() - 3);

        mapper.readTree(text.trim());
        return text.trim();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private double toPercent(BigDecimal value) {
        if (value == null) return 0.0;
        return value.multiply(BigDecimal.valueOf(100))
                    .setScale(1, RoundingMode.HALF_UP)
                    .doubleValue();
    }

    private double computeProductivityScore(Sprint s) {
        double cr  = toPercent(s.getCompletionRate());
        double otd = toPercent(s.getOnTimeDelivery());
        double tp  = toPercent(s.getTeamParticipation());
        double wb  = toPercent(s.getWorkloadBalance());
        return (cr * 0.4) + (otd * 0.3) + (tp * 0.2) + (wb * 0.1);
    }
}