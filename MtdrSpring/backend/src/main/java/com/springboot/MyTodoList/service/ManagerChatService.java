package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.*;
import com.springboot.MyTodoList.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ManagerChatService {

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

    @Autowired private SprintRepository sprintRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private UserTaskRepository userTaskRepository;
    @Autowired private UserSprintRepository userSprintRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();
    private static final int GEMINI_MAX_RETRIES = 3;
    private static final long GEMINI_RETRY_BASE_MS = 1000L;

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC ENTRY POINT
    // ─────────────────────────────────────────────────────────────────────────

    public ManagerChatResponse chat(ManagerChatRequest req) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            return ManagerChatResponse.error("API_KEY_MISSING",
                "Gemini API key is not configured on the server.");
        }
        if (req.getProjectId() == null) {
            return ManagerChatResponse.error("MISSING_PROJECT",
                "A projectId is required to query project data.");
        }
        if (req.getMessage() == null || req.getMessage().isBlank()) {
            return ManagerChatResponse.error("EMPTY_MESSAGE", "Message cannot be empty.");
        }

        try {
            String contextJson = buildProjectContext(req.getProjectId(), req.getSprintId());
            String scope = req.getSprintId() != null
                ? "sprint_" + req.getSprintId()
                : "all_sprints";

            String systemPrompt = buildSystemPrompt(contextJson, scope);
            String reply = callGemini(systemPrompt, req.getMessage(), req.getHistory());
            return ManagerChatResponse.of(reply, scope);

        } catch (Exception e) {
            System.err.println("[ManagerChatService] Error: " + e.getMessage());
            String code = sanitizeErrorCode(e.getMessage());
            return ManagerChatResponse.error(code, friendlyError(code));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONTEXT BUILDER
    // ─────────────────────────────────────────────────────────────────────────

    private String buildProjectContext(Long projectId, Long sprintId) throws Exception {
        List<Sprint> sprints;
        if (sprintId != null) {
            sprints = sprintRepository.findById(sprintId)
                .map(List::of)
                .orElse(List.of());
        } else {
            sprints = sprintRepository.findByAssignedProjectIdOrderByStartDateAsc(projectId);
        }

        List<Map<String, Object>> sprintData = new ArrayList<>();
        for (Sprint s : sprints) {
            Map<String, Object> sd = new LinkedHashMap<>();
            sd.put("sprintId", s.getId());
            sd.put("startDate", s.getStartDate() != null ? s.getStartDate().toString() : null);
            sd.put("dueDate", s.getDueDate() != null ? s.getDueDate().toString() : null);
            sd.put("goal", s.getGoal());
            sd.put("phase", resolvePhase(s));
            sd.put("completionRate", toPercent(s.getCompletionRate()));
            sd.put("onTimeDelivery", toPercent(s.getOnTimeDelivery()));
            sd.put("teamParticipation", toPercent(s.getTeamParticipation()));
            sd.put("workloadBalance", toPercent(s.getWorkloadBalance()));

            // Tasks for this sprint
            List<Map<String, Object>> tasks = buildTasksForSprint(s.getId());
            sd.put("tasks", tasks);

            // Developers summary
            List<Map<String, Object>> devSummary = buildDevSummaryForSprint(s.getId());
            sd.put("developers", devSummary);

            sprintData.add(sd);
        }

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("projectId", projectId);
        context.put("asOf", LocalDateTime.now().toString());
        context.put("sprintCount", sprintData.size());
        context.put("sprints", sprintData);

        return mapper.writeValueAsString(context);
    }

    private List<Map<String, Object>> buildTasksForSprint(Long sprintId) {
        try {
            List<UserTask> userTasks = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (userTasks == null) return List.of();

            // Deduplicate by taskId
            Map<Long, UserTask> deduped = new LinkedHashMap<>();
            for (UserTask ut : userTasks) {
                if (ut == null || ut.getTask() == null) continue;
                deduped.putIfAbsent(ut.getTask().getId(), ut);
            }

            List<Map<String, Object>> result = new ArrayList<>();
            for (UserTask ut : deduped.values()) {
                Task t = ut.getTask();
                Map<String, Object> tm = new LinkedHashMap<>();
                tm.put("taskId", t.getId());
                tm.put("title", t.getTitle());
                tm.put("status", normalizeStatus(t.getStatus()));
                tm.put("priority", t.getPriority());
                tm.put("classification", t.getClassification());
                tm.put("assignedHours", t.getAssignedHours());
                tm.put("workedHours", ut.getWorkedHours());
                tm.put("dueDate", t.getDueDate() != null ? t.getDueDate().toString() : null);
                tm.put("finishDate", t.getFinishDate() != null ? t.getFinishDate().toString() : null);
                tm.put("assignee", ut.getUser() != null ? ut.getUser().getName() : "Unassigned");
                result.add(tm);
            }
            return result;
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildTasksForSprint: " + e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> buildDevSummaryForSprint(Long sprintId) {
        try {
            List<UserTask> userTasks = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (userTasks == null) return List.of();

            Map<Long, Map<String, Object>> byUser = new LinkedHashMap<>();
            Set<String> seenKeys = new HashSet<>();

            for (UserTask ut : userTasks) {
                if (ut == null || ut.getId() == null || ut.getTask() == null) continue;
                String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
                if (!seenKeys.add(key)) continue;

                User u = ut.getUser();
                Long uid = ut.getId().getUserId();
                String name = (u != null && u.getName() != null) ? u.getName() : "User " + uid;

                Map<String, Object> dev = byUser.computeIfAbsent(uid, id -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", name);
                    m.put("assigned", 0);
                    m.put("completed", 0);
                    m.put("inProgress", 0);
                    m.put("toDo", 0);
                    m.put("inReview", 0);
                    m.put("workedHours", 0L);
                    return m;
                });

                dev.put("assigned", (int) dev.get("assigned") + 1);
                String norm = normalizeStatus(ut.getTask().getStatus());
                if ("Done".equals(norm)) dev.put("completed", (int) dev.get("completed") + 1);
                else if ("In progress".equals(norm)) dev.put("inProgress", (int) dev.get("inProgress") + 1);
                else if ("To do".equals(norm)) dev.put("toDo", (int) dev.get("toDo") + 1);
                else if ("In review".equals(norm)) dev.put("inReview", (int) dev.get("inReview") + 1);

                if (ut.getWorkedHours() != null) {
                    dev.put("workedHours", (long) dev.get("workedHours") + ut.getWorkedHours());
                }
            }

            // Add roster-only members (on sprint but no tasks)
            List<UserSprint> roster = userSprintRepository.findBySprintIdWithUser(sprintId);
            if (roster != null) {
                for (UserSprint us : roster) {
                    if (us.getUser() == null) continue;
                    Long uid = us.getUser().getId();
                    if (byUser.containsKey(uid)) continue;
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", us.getUser().getName());
                    m.put("assigned", 0);
                    m.put("completed", 0);
                    m.put("inProgress", 0);
                    m.put("toDo", 0);
                    m.put("inReview", 0);
                    m.put("workedHours", 0L);
                    m.put("rosterOnly", true);
                    byUser.put(uid, m);
                }
            }

            return new ArrayList<>(byUser.values());
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildDevSummaryForSprint: " + e.getMessage());
            return List.of();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROMPT BUILDING
    // ─────────────────────────────────────────────────────────────────────────

    private String buildSystemPrompt(String contextJson, String scope) {
        String scopeDesc = scope.startsWith("sprint_")
            ? "Sprint " + scope.replace("sprint_", "")
            : "all sprints in the project";

        return "You are a helpful project management assistant for a software development team. "
            + "You have access to real-time project data and answer questions from the project manager.\n\n"
            + "## Your behavior\n"
            + "- Answer concisely and directly. Use plain English.\n"
            + "- When the manager asks for counts, lists, or comparisons, use the exact numbers from the data.\n"
            + "- If a question cannot be answered from the data provided, say so clearly.\n"
            + "- For developer-specific questions, refer to them by name.\n"
            + "- Use bullet points or short tables when listing multiple items.\n"
            + "- Never make up data. If a value is null or missing, say it's not recorded.\n"
            + "- Keep responses under 300 words unless more detail is specifically requested.\n"
            + "- Respond in the same language the manager uses (Spanish or English).\n\n"
            + "## Current data scope: " + scopeDesc + "\n\n"
            + "## Project data (JSON)\n"
            + contextJson;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GEMINI HTTP CALL
    // ─────────────────────────────────────────────────────────────────────────

    private String callGemini(String systemPrompt, String userMessage,
                               List<ManagerChatRequest.ChatMessage> history) throws Exception {

        // Build contents array: system context as first user turn, then history, then current message
        List<Map<String, Object>> contents = new ArrayList<>();

        // System instruction as the first user/model exchange (Gemini doesn't have a system role)
        contents.add(buildGeminiTurn("user", systemPrompt));
        contents.add(buildGeminiTurn("model", "Understood. I'm ready to answer questions about the project data."));

        // Chat history (up to last 10 turns to stay within token limits)
        if (history != null) {
            int start = Math.max(0, history.size() - 10);
            for (int i = start; i < history.size(); i++) {
                ManagerChatRequest.ChatMessage msg = history.get(i);
                String role = "assistant".equals(msg.getRole()) ? "model" : "user";
                contents.add(buildGeminiTurn(role, msg.getContent()));
            }
        }

        // Current user message
        contents.add(buildGeminiTurn("user", userMessage));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contents", contents);
        body.put("generationConfig", Map.of(
            "temperature", 0.4,
            "maxOutputTokens", 1024
        ));

        String requestBody = mapper.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(GEMINI_URL + "?key=" + geminiApiKey))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        RuntimeException lastRetryable = null;
        for (int attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int status = response.statusCode();

                if (status == 200) {
                    return extractTextFromGeminiResponse(response.body());
                }
                if (status == 429) throw new RuntimeException("HTTP_429_QUOTA_EXCEEDED");
                if (status == 401 || status == 403) throw new RuntimeException("HTTP_401_403_API_KEY_INVALID");

                boolean retryableHttp = status == 502 || status == 503 || status == 504;
                if (retryableHttp) {
                    lastRetryable = new RuntimeException("HTTP_" + status + "_UPSTREAM_ERROR");
                    if (attempt < GEMINI_MAX_RETRIES) {
                        sleepBeforeRetry(attempt);
                        continue;
                    }
                    throw lastRetryable;
                }

                if (status >= 500) throw new RuntimeException("HTTP_" + status + "_UPSTREAM_ERROR");
                throw new RuntimeException("HTTP_" + status + "_UNEXPECTED");
            } catch (HttpTimeoutException e) {
                lastRetryable = new RuntimeException("GEMINI_TIMEOUT", e);
                if (attempt < GEMINI_MAX_RETRIES) {
                    sleepBeforeRetry(attempt);
                    continue;
                }
                throw lastRetryable;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("REQUEST_INTERRUPTED", e);
            }
        }
        throw lastRetryable != null ? lastRetryable : new RuntimeException("GENERATION_FAILED");
    }

    private void sleepBeforeRetry(int attempt) {
        long waitMs = GEMINI_RETRY_BASE_MS * (1L << Math.max(0, attempt - 1));
        try {
            Thread.sleep(waitMs);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("REQUEST_INTERRUPTED", ie);
        }
    }

    private Map<String, Object> buildGeminiTurn(String role, String text) {
        return Map.of(
            "role", role,
            "parts", List.of(Map.of("text", text))
        );
    }

    private String extractTextFromGeminiResponse(String raw) throws Exception {
        var root = mapper.readTree(raw);
        var candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new RuntimeException("EMPTY_CANDIDATES");
        }
        var first = candidates.get(0);
        var textNode = first.path("content").path("parts").get(0).path("text");
        String text = textNode.isMissingNode() ? "" : textNode.asText("");
        if (text == null || text.trim().isEmpty()) {
            throw new RuntimeException("EMPTY_GEMINI_TEXT");
        }
        return text;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private String resolvePhase(Sprint s) {
        LocalDateTime now = LocalDateTime.now();
        if (s.getStartDate() != null && now.isBefore(s.getStartDate())) return "not_started";
        if (s.getDueDate() != null && now.isAfter(s.getDueDate())) return "ended";
        return "in_progress";
    }

    private String normalizeStatus(String raw) {
        if (raw == null) return "Unknown";
        String n = raw.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        if (n.equals("TODO") || n.equals("TO_DO") || n.equals("PENDING") || n.equals("BACKLOG")) return "To do";
        if (n.equals("IN_PROCESS") || n.equals("IN_PROGRESS") || n.equals("DOING")) return "In progress";
        if (n.equals("IN_REVIEW") || n.equals("REVIEW") || n.equals("QA")) return "In review";
        if (n.equals("DONE") || n.equals("COMPLETED") || n.equals("FINISHED")) return "Done";
        return raw;
    }

    private double toPercent(java.math.BigDecimal value) {
        if (value == null) return 0.0;
        return value.multiply(java.math.BigDecimal.valueOf(100))
            .setScale(1, java.math.RoundingMode.HALF_UP).doubleValue();
    }

    private String sanitizeErrorCode(String msg) {
        if (msg == null) return "UNKNOWN_ERROR";
        String m = msg.toUpperCase(Locale.ROOT);
        if (m.contains("429") || m.contains("QUOTA")) return "QUOTA_EXCEEDED";
        if (m.contains("401") || m.contains("403") || m.contains("API_KEY")) return "API_KEY_INVALID";
        if (m.contains("TIMEOUT")) return "UPSTREAM_TIMEOUT";
        if (m.contains("INTERRUPTED")) return "REQUEST_INTERRUPTED";
        if (m.contains("EMPTY_CANDIDATES") || m.contains("EMPTY_GEMINI_TEXT")) return "EMPTY_AI_RESPONSE";
        if (m.contains("HTTP_5")) return "UPSTREAM_UNAVAILABLE";
        return "GENERATION_FAILED";
    }

    private String friendlyError(String code) {
    if ("QUOTA_EXCEEDED".equals(code)) {
        return "The AI service is temporarily rate-limited. Please try again in a moment.";
    } else if ("API_KEY_INVALID".equals(code)) {
        return "The Gemini API key is invalid or expired.";
    } else if ("UPSTREAM_TIMEOUT".equals(code)) {
        return "The AI service took too long to respond. Please try again in a few seconds.";
    } else if ("REQUEST_INTERRUPTED".equals(code)) {
        return "The request was interrupted before completion. Please send your message again.";
    } else if ("EMPTY_AI_RESPONSE".equals(code)) {
        return "The AI service returned an empty response. Please try rephrasing your message.";
    } else if ("UPSTREAM_UNAVAILABLE".equals(code)) {
        return "The AI service is temporarily unavailable. Please try again shortly.";
    } else {
        return "An error occurred while processing your request. Please try again.";
    }
}}