package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.config.GeminiApiConfiguration;
import com.springboot.MyTodoList.model.*;
import com.springboot.MyTodoList.repository.*;
import com.springboot.MyTodoList.util.ManagerChatReplyUtil;
import com.springboot.MyTodoList.util.SprintDeveloperMetricsUtil;
import com.springboot.MyTodoList.util.SprintLiveKpiUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ManagerChatService {

    @Autowired
    private GeminiApiConfiguration geminiApiConfiguration;

    @Autowired private SprintRepository sprintRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private UserTaskRepository userTaskRepository;
    @Autowired private UserSprintRepository userSprintRepository;
    @Autowired private EmbeddingService embeddingService;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();
    private static final int GEMINI_MAX_RETRIES = 3;
    private static final long GEMINI_RETRY_BASE_MS = 1000L;
    private static final Pattern SPRINT_ID_IN_TEXT =
        Pattern.compile("\\bsprint\\s*#?\\s*(\\d+)\\b", Pattern.CASE_INSENSITIVE);

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC ENTRY POINT
    // ─────────────────────────────────────────────────────────────────────────

    public ManagerChatResponse chat(ManagerChatRequest req) {
        if (!geminiApiConfiguration.isConfigured()) {
            return ManagerChatResponse.error(
                GeminiApiConfiguration.ERROR_CODE,
                GeminiApiConfiguration.USER_MESSAGE);
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
            Long targetSprintId = resolveTargetSprintId(req);
            Integer sprintProductivityScore = targetSprintId != null
                ? getRoundedProductivityScoreForSprint(targetSprintId)
                : null;

            String ragContext = buildRagContext(req.getMessage(), req.getSprintId());
            String systemPrompt = buildSystemPrompt(contextJson, ragContext, scope);
            String reply = callGemini(systemPrompt, req.getMessage(), req.getHistory());
            reply = ManagerChatReplyUtil.clampPercentagesToRange(reply);
            reply = ManagerChatReplyUtil.alignProductivityScoreMentions(reply, sprintProductivityScore);
            return ManagerChatResponse.of(reply, scope);

        } catch (Exception e) {
            System.err.println("[ManagerChatService] Error: " + e.getMessage());
            String code = sanitizeErrorCode(e.getMessage());
            return ManagerChatResponse.error(code, friendlyError(code));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RAG CONTEXT
    // ─────────────────────────────────────────────────────────────────────────

    private String buildRagContext(String query, Long sprintId) {
        try {
            List<TaskEmbedding> relevant = embeddingService.findRelevantTasks(query, sprintId, 8);
            if (relevant.isEmpty()) {
                return "No indexed tasks found — using full project data below.";
            }
            StringBuilder sb = new StringBuilder();
            sb.append("Top relevant tasks retrieved by semantic search:\n");
            for (TaskEmbedding te : relevant) {
                sb.append("- ").append(te.getTextoChunk()).append("\n");
            }
            return sb.toString();
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildRagContext error: " + e.getMessage());
            return "Vector search unavailable — using full project data below.";
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
        List<Map<String, Object>> allDevRows = new ArrayList<>();
        for (Sprint s : sprints) {
            Map<String, Object> sd = new LinkedHashMap<>();
            sd.put("sprintId", s.getId());
            sd.put("startDate", s.getStartDate() != null ? s.getStartDate().toString() : null);
            sd.put("dueDate", s.getDueDate() != null ? s.getDueDate().toString() : null);
            sd.put("goal", s.getGoal());

            List<UserTask> sprintUserTasks = userTaskRepository.findBySprintIdWithUserAndTask(s.getId());
            List<Task> sprintTasks = taskRepository.findByAssignedSprintId(s.getId());
            Map<String, Object> liveKpis = SprintLiveKpiUtil.computeLiveKpis(s, sprintTasks, sprintUserTasks);
            sd.put("kpis", liveKpis);
            sd.put("completionRate", liveKpis.get("completionRate"));
            sd.put("onTimeDelivery", liveKpis.get("onTimeDelivery"));
            sd.put("teamParticipation", liveKpis.get("teamParticipation"));
            sd.put("workloadBalance", liveKpis.get("workloadBalance"));
            sd.put("productivityScore", liveKpis.get("productivityScore"));
            sd.put("totalTasks", liveKpis.get("totalTasks"));
            sd.put("totalCompleted", liveKpis.get("totalCompleted"));
            sd.put("totalWorkedHours", liveKpis.get("totalWorkedHours"));

            List<Map<String, Object>> tasks = buildTasksForSprint(sprintUserTasks, sprintTasks);
            sd.put("tasks", tasks);
            sd.put("phase", resolvePhase(s, tasks, liveKpis));

            List<Map<String, Object>> devSummary = buildDevSummaryForSprint(s.getId(), sprintUserTasks);
            sd.put("developers", devSummary);
            allDevRows.addAll(devSummary);

            sd.put("blockedAssignments", buildBlockedAssignmentsForSprint(s.getId()));

            sprintData.add(sd);
        }

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("projectId", projectId);
        context.put("asOf", LocalDateTime.now().toString());
        context.put("sprintCount", sprintData.size());
        context.put("sprints", sprintData);
        if (sprintId == null && sprintData.size() > 1) {
            context.put(
                    "developersAggregatedAllSprints",
                    SprintDeveloperMetricsUtil.mergeDeveloperRowsByUserId(allDevRows));
        }

        return mapper.writeValueAsString(context);
    }

    private List<Map<String, Object>> buildBlockedAssignmentsForSprint(Long sprintId) {
        try {
            List<UserTask> userTasks = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (userTasks == null) return List.of();
            List<Map<String, Object>> out = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (UserTask ut : userTasks) {
                if (ut == null || ut.getId() == null || !Boolean.TRUE.equals(ut.getIsBlocked())) continue;
                if (UserTask.isCompletedAssignmentStatus(ut.getStatus())) continue;
                String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
                if (!seen.add(key)) continue;
                Task t = ut.getTask();
                if (t == null) continue;
                User u = ut.getUser();
                String name = (u != null && u.getName() != null && !u.getName().isBlank())
                    ? u.getName().trim()
                    : ("User " + ut.getId().getUserId());
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("reportedByDeveloperName", name);
                row.put("taskId", t.getId());
                row.put("taskTitle", t.getTitle());
                row.put("blockedReason", ut.getBlockedReason() != null ? ut.getBlockedReason().trim() : "");
                out.add(row);
            }
            return out;
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildBlockedAssignmentsForSprint: " + e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> buildTasksForSprint(
            List<UserTask> userTasks, List<Task> sprintTasks) {
        try {
            Map<Long, String> assigneeByTask = new LinkedHashMap<>();
            if (userTasks != null) {
                for (UserTask ut : userTasks) {
                    if (ut == null || ut.getTask() == null || ut.getTask().getId() == null) {
                        continue;
                    }
                    assigneeByTask.putIfAbsent(
                            ut.getTask().getId(),
                            ut.getUser() != null ? ut.getUser().getName() : "Unassigned");
                }
            }

            List<Map<String, Object>> result = new ArrayList<>();
            if (sprintTasks == null) {
                return result;
            }
            for (Task t : sprintTasks) {
                if (t == null) {
                    continue;
                }
                Map<String, Object> tm = new LinkedHashMap<>();
                tm.put("taskId", t.getId());
                tm.put("title", t.getTitle());
                tm.put("status", normalizeStatus(t.getStatus()));
                tm.put("priority", t.getPriority());
                tm.put("classification", t.getClassification());
                tm.put("assignedHours", t.getAssignedHours());
                tm.put("dueDate", t.getDueDate() != null ? t.getDueDate().toString() : null);
                tm.put("finishDate", t.getFinishDate() != null ? t.getFinishDate().toString() : null);
                tm.put("assignee", assigneeByTask.getOrDefault(t.getId(), "Unassigned"));
                result.add(tm);
            }
            return result;
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildTasksForSprint: " + e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> buildDevSummaryForSprint(
            Long sprintId, List<UserTask> userTasks) {
        try {
            if (userTasks == null) {
                userTasks = List.of();
            }

            List<Map<String, Object>> out = new ArrayList<>(
                    SprintDeveloperMetricsUtil.buildDeveloperSummaryRows(userTasks));

            Set<Long> present = new LinkedHashSet<>();
            for (Map<String, Object> row : out) {
                Object uid = row.get("userId");
                if (uid instanceof Number) {
                    present.add(((Number) uid).longValue());
                }
            }

            List<UserSprint> roster = userSprintRepository.findBySprintIdWithUser(sprintId);
            if (roster != null) {
                for (UserSprint us : roster) {
                    if (us.getUser() == null) continue;
                    Long uid = us.getUser().getId();
                    if (present.contains(uid)) continue;
                    out.add(SprintDeveloperMetricsUtil.rosterOnlyRow(uid, us.getUser().getName()));
                }
            }
            return out;
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildDevSummaryForSprint: " + e.getMessage());
            return List.of();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROMPT BUILDING
    // ─────────────────────────────────────────────────────────────────────────

    private String buildSystemPrompt(String contextJson, String ragContext, String scope) {
        String scopeDesc = scope.startsWith("sprint_")
            ? "Sprint " + scope.replace("sprint_", "")
            : "all sprints in the project";

        return "You are a helpful project management assistant for a software development team. "
            + "You have access to real-time project data and answer questions from the project manager.\n\n"
            + "## Your behavior\n"
            + "- Answer concisely and directly. Use plain English.\n"
            + "- When the manager asks for counts, lists, or comparisons, use the exact numbers from the data.\n"
            + "- If asked for productivity score, report the exact `productivityScore` value from sprint data (do not infer a different number).\n"
            + "- If a question cannot be answered from the data provided, say so clearly.\n"
            + "- For developer-specific questions, refer to them by name.\n"
            + "- In each sprint's `developers` array, `completed` is the count of unique tasks where that developer's "
            + "assignment is finished (same as the dashboard Completed Tasks chart). "
            + "`pending` = assigned minus completed. Do not use TASK.status Done for per-developer completed counts "
            + "on shared tasks.\n"
            + "- For hours worked per developer, use `developers[].workedHours` only (sum of USER_TASK.WORKED_HOURS, "
            + "same as the dashboard Hours Worked chart, one decimal). When scope is all sprints, use "
            + "`developersAggregatedAllSprints` if present. Do not infer hours from `tasks` or TASK.assignedHours.\n"
            + "- `assignedHoursEstimate` is planned task hours per developer (lighter bar on the hours chart).\n"
            + "- For KPI questions (completion rate, on-time delivery, team participation, workload balance, "
            + "productivity score), use each sprint's `kpis` object — these are live values matching KPI Analytics "
            + "and the dashboard (not stale DB snapshots). Report integers as shown (0–100).\n"
            + "- Productivity score formula: completion×0.4 + on-time×0.3 + participation×0.2 + workload×0.1.\n"
            + "- Use bullet points or short tables when listing multiple items.\n"
            + "- Never make up data. If a value is null or missing, say it's not recorded.\n"
            + "- Each sprint may include \"blockedAssignments\": who flagged an assignment as blocked, task id/title, and reason. "
            + "Use it when asked about blockers, who is stuck, or delivery risk. In your replies, never name database tables or columns.\n"
            + "- Keep responses under 300 words unless more detail is specifically requested.\n"
            + "- Respond in the same language the manager uses (Spanish or English).\n\n"
            + "- Any percentage you mention must stay between 0% and 100%.\n\n"
            + "## Current data scope: " + scopeDesc + "\n\n"
            + "## Most relevant tasks (vector search)\n"
            + ragContext + "\n\n"
            + "## Full project data (JSON)\n"
            + contextJson;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GEMINI HTTP CALL
    // ─────────────────────────────────────────────────────────────────────────

    private String callGemini(String systemPrompt, String userMessage,
                               List<ManagerChatRequest.ChatMessage> history) throws Exception {

        List<Map<String, Object>> contents = new ArrayList<>();

        contents.add(buildGeminiTurn("user", systemPrompt));
        contents.add(buildGeminiTurn("model", "Understood. I'm ready to answer questions about the project data."));

        if (history != null) {
            int start = Math.max(0, history.size() - 10);
            for (int i = start; i < history.size(); i++) {
                ManagerChatRequest.ChatMessage msg = history.get(i);
                String role = "assistant".equals(msg.getRole()) ? "model" : "user";
                contents.add(buildGeminiTurn(role, msg.getContent()));
            }
        }

        contents.add(buildGeminiTurn("user", userMessage));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("contents", contents);
        body.put("generationConfig", Map.of(
            "temperature", 0.4,
            "maxOutputTokens", 1024
        ));

        String requestBody = mapper.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(geminiApiConfiguration.getApiUrl() + "?key=" + geminiApiConfiguration.getApiKey()))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        RuntimeException lastRetryable = null;
        for (int attempt = 1; attempt <= GEMINI_MAX_RETRIES; attempt++) {
            try {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                int status = response.statusCode();

                if (status == 200) return extractTextFromGeminiResponse(response.body());
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

    private String resolvePhase(Sprint s, List<Map<String, Object>> tasks, Map<String, Object> liveKpis) {
        if (liveKpis != null) {
            Object cr = liveKpis.get("completionRate");
            if (cr instanceof Number && ((Number) cr).intValue() >= 100) {
                return "completed";
            }
            Object total = liveKpis.get("totalTasks");
            Object done = liveKpis.get("totalCompleted");
            if (total instanceof Number && done instanceof Number
                    && ((Number) total).intValue() > 0
                    && ((Number) done).intValue() >= ((Number) total).intValue()) {
                return "completed";
            }
        }
        if (tasks != null && !tasks.isEmpty()) {
            boolean allDone = true;
            for (Map<String, Object> t : tasks) {
                String st = t != null ? String.valueOf(t.get("status")) : "";
                if (!"Done".equalsIgnoreCase(st)) {
                    allDone = false;
                    break;
                }
            }
            if (allDone) return "completed";
        }
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

    private Integer getRoundedProductivityScoreForSprint(Long sprintId) {
        if (sprintId == null) {
            return null;
        }
        return sprintRepository.findById(sprintId)
            .map(s -> {
                List<Task> sprintTasks = taskRepository.findByAssignedSprintId(sprintId);
                List<UserTask> sprintUserTasks =
                        userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
                Map<String, Object> kpis =
                        SprintLiveKpiUtil.computeLiveKpis(s, sprintTasks, sprintUserTasks);
                Object score = kpis.get("productivityScore");
                return score instanceof Number ? ((Number) score).intValue() : null;
            })
            .orElse(null);
    }

    private Long resolveTargetSprintId(ManagerChatRequest req) {
        if (req == null) return null;
        if (req.getSprintId() != null) return req.getSprintId();
        String msg = req.getMessage();
        if (msg == null || msg.isBlank()) return null;
        Matcher m = SPRINT_ID_IN_TEXT.matcher(msg);
        if (!m.find()) return null;
        try {
            return Long.parseLong(m.group(1));
        } catch (NumberFormatException ex) {
            return null;
        }
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
    }
}