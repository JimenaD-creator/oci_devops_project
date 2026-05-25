package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.SprintInsight;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserSprint;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import com.springboot.MyTodoList.repository.UserSprintRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
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
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.Comparator;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GeminiService {

    private static final long ENRICH_RESPONSE_CACHE_MS = 45_000;
    private final ConcurrentHashMap<String, CachedEnrichedInsights> enrichResponseCache =
        new ConcurrentHashMap<>();

    private static final class CachedEnrichedInsights {
        final JsonNode node;
        final long expiresAtMs;

        CachedEnrichedInsights(JsonNode node, long expiresAtMs) {
            this.node = node;
            this.expiresAtMs = expiresAtMs;
        }
    }

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

    /** Matches DB-injected (or model-following) task-status lead; used to avoid duplicating on re-enrich. */
    private static final Pattern CANONICAL_TASK_STATUS_OVERVIEW_LEAD = Pattern.compile(
        "^(?i)Task status in this sprint:\\s*\\d+\\s+To do,\\s*\\d+\\s+In progress,\\s*\\d+\\s+In review,\\s*\\d+\\s+Done\\."
            + "(\\s*\\d+\\s+task\\(s\\)\\s+use other or unknown statuses\\.)?\\s*");

    /** "blocked" / "blocker(s)" in user-facing alert prose (avoids matching arbitrary "block" substrings). */
    private static final Pattern ALERT_BLOCKER_LEXEMES = Pattern.compile(
        "\\b(blocked|blockers|blocker|blocking)\\b", Pattern.CASE_INSENSITIVE);

    /** Prose that claims workload is uneven / imbalanced (EN + ES). */
    private static final Pattern ALERT_WORKLOAD_UNEVEN_LEXEMES = Pattern.compile(
        "\\b(uneven|unbalanced|imbalance|imbalanced|bottleneck|desigual|desbalancead[oa]s?)\\b",
        Pattern.CASE_INSENSITIVE);

    /** JSON keys whose string values must stay machine-readable for the UI / API contract. */
    private static final Set<String> PRETTIFY_SKIP_KEYS = Set.of(
        "category", "severity", "kpi", "trend", "confidence");

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private SprintInsightRepository insightRepository;

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private UserSprintRepository userSprintRepository;

    @Autowired
    private TeamMembersRepository teamMembersRepository;

    @Autowired
    private KpiService kpiService;

    @Autowired
    private TaskRepository taskRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(60))
        .build();

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    public JsonNode generateDeveloperVariationInsights(List<Map<String, Object>> sprintSnapshots) throws Exception {
        if (sprintSnapshots == null || sprintSnapshots.size() < 2) {
            ObjectNode root = mapper.createObjectNode();
            root.set("tasks", mapper.createArrayNode());
            root.set("hours", mapper.createArrayNode());
            root.set("productivity", mapper.createArrayNode());
            return root;
        }

        String inputJson = mapper.writeValueAsString(sprintSnapshots);
        String prompt = "You are an Agile analytics assistant. Return ONLY a valid JSON object with no markdown.\n\n"
            + "Analyze developer variation across sprints from this input JSON:\n"
            + inputJson + "\n\n"
            + "Input schema:\n"
            + "- each sprint has: id, shortLabel, developers[], and optionally blockedReports[]\n"
            + "- each developer has: name, assigned, completed, hours, assignedHoursEstimate\n"
            + "- each blockedReports item (when present): assignee who flagged a blocked assignment, task id/title, and reason text\n\n"
            + "Required output schema:\n"
            + "{\"tasks\":[{\"developerName\":\"...\",\"delta\":2,\"message\":\"...\"}],"
            + "\"hours\":[{\"developerName\":\"...\",\"delta\":1.5,\"message\":\"...\"}],"
            + "\"productivity\":[{\"developerName\":\"...\",\"delta\":0.42,\"message\":\"...\"}]}\n\n"
            + "Rules:\n"
            + "- In every tasks[].message, hours[].message, and productivity[].message: use plain product language only. "
            + "Never mention database tables, columns, SQL, or internal input field names.\n"
            + "- Use all selected sprints in input order. Compare first vs last, and also consider variation across intermediate sprints.\n"
            + "- Include one row per developer seen in any sprint (missing values treated as 0).\n"
            + "- For interpretation, prioritize delivery performance (completed tasks and completed-per-hour efficiency), not total created or assigned scope.\n"
            + "- Do not treat changes in assigned or created task volume as positive/negative performance by themselves; scope can vary by sprint goal.\n"
            + "- tasks[].delta = last.completed - first.completed (integer).\n"
            + "- hours[].delta = last.hours - first.hours (number, 1 decimal).\n"
            + "- productivity[].delta = (last.completed/max(last.hours,0.1)) - (first.completed/max(first.hours,0.1)) rounded to 2 decimals.\n"
            + "- In tasks and hours interpretation, explicitly use delivery completion status (all assigned completed vs pending work), not sprint task-volume swings.\n"
            + "- tasks message must judge variation mainly by completion outcomes (finished vs not finished), even when assigned/created volume changes.\n"
            + "- hours message must relate worked-hour changes to completion outcomes and efficiency; avoid conclusions based only on workload size changes.\n"
            + "- productivity message must explain whether efficiency (tasks per hour) improved, worsened, or remained stable.\n"
            + "- productivity message must use completed-per-hour as the performance basis and must not treat assigned/created task volume changes as productivity by themselves.\n"
            + "- When blockedReports is non-empty in any sprint, explicitly mention which developer reported which task as blocked and summarize the reason text; tie blockers to completion/hours/productivity interpretation where relevant (especially in the last sprint).\n"
            + "- message must be concise English, grounded in the data, mention first/last sprint labels, and mention if intermediate sprints had notable fluctuations.\n"
            + "- Sort tasks, hours, and productivity by absolute delta descending.\n"
            + "- Do not include any extra keys.";

        try {
            String raw = callGemini(prompt);
            String json = extractJsonFromGeminiResponse(raw);
            JsonNode parsed = mapper.readTree(json);
            if (parsed != null && parsed.isObject()) {
                return parsed;
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] generateDeveloperVariationInsights fallback: " + e.getMessage());
        }
        return buildDeveloperVariationFallback(sprintSnapshots);
    }

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

            // Refresh KPIs from current tasks so in-progress sprints get a live snapshot (not stale zeros).
            kpiService.calculateAndSaveKpisForSprint(sprintId);
            sprint = sprintRepository.findById(sprintId).orElse(sprint);

            List<Sprint> historicalSprints = sprintRepository
                .findByAssignedProjectIdOrderByStartDateAsc(projectId);

            String prompt = buildPrompt(sprint, historicalSprints, sprintId);
            System.out.println("[GeminiService] Prompt length: " + prompt.length());
            System.out.println("[GeminiService] Prompt preview: " + prompt.substring(0, Math.min(200, prompt.length())));
            String rawJson = callGemini(prompt);
            String insightsJson = extractJsonFromGeminiResponse(rawJson);
            JsonNode enriched = enrichInsightsForResponse(mapper.readTree(insightsJson), sprintId);
            insightsJson = mapper.writeValueAsString(enriched);

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
        /**
     * Generates a plain-text personal performance summary for a developer (Telegram /myperformance).
     * Returns the AI text directly — not JSON.
     */
    public String generateDeveloperPerformanceSummary(String prompt) throws Exception {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new IllegalStateException("Gemini API key not configured.");
        }

        String requestBody = "{\"contents\":[{\"parts\":[{\"text\":"
            + mapper.writeValueAsString(prompt)
            + "}]}],\"generationConfig\":{\"temperature\":0.5,\"maxOutputTokens\":512}}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(GEMINI_URL + "?key=" + geminiApiKey))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini HTTP " + response.statusCode() + " - " + response.body());
        }

        JsonNode root = mapper.readTree(response.body());
        return root.path("candidates").get(0)
                   .path("content").path("parts").get(0)
                   .path("text").asText("Could not generate summary.");
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
        String msg = raw.toUpperCase(Locale.ROOT);
        if (msg.contains("429") || msg.contains("RESOURCE_EXHAUSTED") || msg.contains("QUOTA")) {
            return "QUOTA_EXCEEDED";
        }
        if (msg.contains("API KEY") || msg.contains("NOT CONFIGURED") || msg.contains("401") || msg.contains("403")) {
            return "API_KEY_MISSING";
        }
        if (msg.contains("404") && msg.contains("NOT FOUND")) {
            return "MODEL_NOT_FOUND";
        }
        if (msg.contains("SPRINT NOT FOUND")) {
            return "SPRINT_NOT_FOUND";
        }
        if (msg.contains("NO PROJECT")) {
            return "NO_PROJECT_ASSIGNED";
        }
        if (msg.contains("TIMEOUT")) {
            return "UPSTREAM_TIMEOUT";
        }
        if (msg.contains("UNAVAILABLE AFTER") || msg.contains("HTTP 503") || msg.contains("HTTP 502") || msg.contains("HTTP 504") || msg.contains("HTTP 500")) {
            return "UPSTREAM_UNAVAILABLE";
        }
        return "GENERATION_FAILED";
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROMPT ENGINEERING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Per-developer aggregates: assignment rows and tasks for the sprint, plus sprint-roster members
     * who have no assignment rows yet (common when the UI shows members but assignments are not synced).
     */
    private String buildTeamWorkloadJson(Long sprintId) {
        try {
            List<UserTask> raw = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (raw == null) {
                raw = new ArrayList<>();
            }
            LinkedHashMap<String, UserTask> deduped = new LinkedHashMap<>();
            for (UserTask ut : raw) {
                if (ut == null || ut.getId() == null) {
                    continue;
                }
                String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
                deduped.putIfAbsent(key, ut);
            }
            List<UserTask> rows = new ArrayList<>(deduped.values());

            class Agg {
                String name;
                int taskRows;
                int completedTasks;
                int onTimeCompletedTasks;
                int lateCompletedTasks;
                int unknownCompletionTiming;
                int completedWithZeroHours;
                long workedHours;
                long assignedHours;
                boolean fromSprintRosterOnly;
                boolean fromProjectTeamOnly;
                final List<Map<String, Object>> taskSamples = new ArrayList<>();
            }
            Map<Long, Integer> assigneeCountByTask = new HashMap<>();
            for (UserTask ut : rows) {
                if (ut.getId() != null) {
                    assigneeCountByTask.merge(ut.getId().getTaskId(), 1, Integer::sum);
                }
            }
            Map<Long, Agg> byUser = new LinkedHashMap<>();
            for (UserTask ut : rows) {
                User u = ut.getUser();
                Task t = ut.getTask();
                if (t == null) {
                    continue;
                }
                Long uid = ut.getId() != null ? ut.getId().getUserId() : null;
                if (uid == null) {
                    continue;
                }
                if (u == null) {
                    System.err.println(
                        "[GeminiService] USER_TASK user FK missing; aggregating by userId=" + uid + " taskId=" + t.getId());
                }
                final Long aggKey = uid;
                Agg a = byUser.computeIfAbsent(aggKey, id -> {
                    Agg x = new Agg();
                    if (u != null) {
                        x.name = u.getName() != null && !u.getName().isBlank()
                            ? u.getName().trim() : ("User " + id);
                    } else {
                        x.name = "User " + id;
                    }
                    return x;
                });
                a.taskRows++;
                if (isUserTaskAssignmentComplete(ut)) {
                    a.completedTasks++;
                    int assigneeCount = assigneeCountByTask.getOrDefault(t.getId(), 1);
                    Boolean onTime = evaluateUserTaskOnTime(ut, t, assigneeCount);
                    if (onTime == null) {
                        a.unknownCompletionTiming++;
                    } else if (onTime) {
                        a.onTimeCompletedTasks++;
                    } else {
                        a.lateCompletedTasks++;
                    }
                    if (ut.getWorkedHours() == null || ut.getWorkedHours() <= 0) {
                        a.completedWithZeroHours++;
                    }
                }
                if (ut.getWorkedHours() != null) {
                    a.workedHours += ut.getWorkedHours();
                }
                if (t.getAssignedHours() != null) {
                    a.assignedHours += t.getAssignedHours();
                }
                if (a.taskSamples.size() < 5) {
                    Map<String, Object> sm = new LinkedHashMap<>();
                    sm.put("taskId", t.getId());
                    sm.put("title", t.getTitle() != null ? t.getTitle() : "");
                    sm.put("status", t.getStatus() != null ? t.getStatus() : "");
                    if (t.getClassification() != null && !t.getClassification().isBlank()) {
                        sm.put("classification", t.getClassification());
                    }
                    if (t.getStartDate() != null) {
                        sm.put("startDate", t.getStartDate().toString());
                    }
                    if (t.getDueDate() != null) {
                        sm.put("dueDate", t.getDueDate().toString());
                    }
                    if (t.getFinishDate() != null) {
                        sm.put("finishDate", t.getFinishDate().toString());
                    }
                    sm.put("workedHours", ut.getWorkedHours() != null ? ut.getWorkedHours() : 0);
                    if (Boolean.TRUE.equals(ut.getIsBlocked())) {
                        sm.put("userTaskBlocked", true);
                        if (ut.getBlockedReason() != null && !ut.getBlockedReason().isBlank()) {
                            sm.put("blockedReason", ut.getBlockedReason().trim());
                        }
                    }
                    a.taskSamples.add(sm);
                }
            }

            List<UserSprint> roster = userSprintRepository.findBySprintIdWithUser(sprintId);
            if (roster != null) {
                for (UserSprint us : roster) {
                    User u = us.getUser();
                    if (u == null) {
                        continue;
                    }
                    Long uid = u.getId();
                    if (byUser.containsKey(uid)) {
                        continue;
                    }
                    Agg a = new Agg();
                    a.name = u.getName() != null && !u.getName().isBlank()
                        ? u.getName().trim() : ("User " + uid);
                    a.fromSprintRosterOnly = true;
                    byUser.put(uid, a);
                }
            }

            Optional<Sprint> sprintOpt = sprintRepository.findById(sprintId);
            if (sprintOpt.isPresent()) {
                Project project = sprintOpt.get().getAssignedProject();
                if (project != null) {
                    Team team = project.getAssignedTeam();
                    if (team != null && team.getId() != null) {
                        List<TeamMember> members = teamMembersRepository.findByTeam_Id(team.getId());
                        if (members != null) {
                            for (TeamMember tm : members) {
                                User u = tm.getUser();
                                if (u == null || !isDeveloperUser(u)) {
                                    continue;
                                }
                                Long uid = u.getId();
                                if (byUser.containsKey(uid)) {
                                    continue;
                                }
                                Agg a = new Agg();
                                a.name = u.getName() != null && !u.getName().isBlank()
                                    ? u.getName().trim() : ("User " + uid);
                                a.fromProjectTeamOnly = true;
                                byUser.put(uid, a);
                            }
                        }
                        User manager = team.getManager();
                        if (manager != null && isDeveloperUser(manager)) {
                            Long uid = manager.getId();
                            if (!byUser.containsKey(uid)) {
                                Agg a = new Agg();
                                a.name = manager.getName() != null && !manager.getName().isBlank()
                                    ? manager.getName().trim() : ("User " + uid);
                                a.fromProjectTeamOnly = true;
                                byUser.put(uid, a);
                            }
                        }
                    }
                }
            }

            if (byUser.isEmpty()) {
                System.err.println("[GeminiService] buildTeamWorkloadJson: no USER_TASK and no USER_SPRINT roster for sprint "
                    + sprintId);
                return "[]";
            }

            List<Map<String, Object>> out = new ArrayList<>();
            for (Agg a : byUser.values()) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("developerName", a.name);
                row.put("assignedTaskRows", a.taskRows);
                row.put("completedTasks", a.completedTasks);
                row.put("onTimeCompletedTasks", a.onTimeCompletedTasks);
                row.put("lateCompletedTasks", a.lateCompletedTasks);
                row.put("unknownCompletionTiming", a.unknownCompletionTiming);
                row.put("completedWithZeroHours", a.completedWithZeroHours);
                row.put("workedHoursSum", a.workedHours);
                row.put("assignedHoursSum", a.assignedHours);
                row.put("taskSamples", a.taskSamples);
                row.put("fromSprintRosterOnly", a.fromSprintRosterOnly);
                row.put("fromProjectTeamOnly", a.fromProjectTeamOnly);
                out.add(row);
            }
            return mapper.writeValueAsString(out);
        } catch (Exception e) {
            System.err.println("[GeminiService] buildTeamWorkloadJson: " + e.getMessage());
            return "[]";
        }
    }

    private static boolean isDeveloperUser(User user) {
        String type = user != null ? user.getType() : null;
        if (type == null) {
            return false;
        }
        return type.trim().toLowerCase(Locale.ROOT).contains("developer");
    }

    /**
     * Assignments currently flagged blocked for the sprint (assignee is who reported the block on that assignment).
     */
    private String buildBlockedUserTaskReportsJson(Long sprintId) {
        try {
            List<UserTask> raw = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (raw == null) {
                raw = new ArrayList<>();
            }
            LinkedHashMap<String, UserTask> deduped = new LinkedHashMap<>();
            for (UserTask ut : raw) {
                if (ut == null || ut.getId() == null) {
                    continue;
                }
                String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
                deduped.putIfAbsent(key, ut);
            }
            List<Map<String, Object>> out = new ArrayList<>();
            for (UserTask ut : deduped.values()) {
                if (!Boolean.TRUE.equals(ut.getIsBlocked())) {
                    continue;
                }
                if (UserTask.isCompletedAssignmentStatus(ut.getStatus())) {
                    continue;
                }
                Task t = ut.getTask();
                if (t == null) {
                    continue;
                }
                User u = ut.getUser();
                Long uid = ut.getId().getUserId();
                String devName = u != null && u.getName() != null && !u.getName().isBlank()
                    ? u.getName().trim()
                    : ("User " + (uid != null ? uid : "?"));
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("reportedByDeveloperName", devName);
                row.put("taskId", t.getId());
                row.put("taskTitle", t.getTitle() != null ? t.getTitle() : "");
                String br = ut.getBlockedReason();
                row.put("blockedReason", br != null ? br.trim() : "");
                out.add(row);
            }
            return mapper.writeValueAsString(out);
        } catch (Exception e) {
            System.err.println("[GeminiService] buildBlockedUserTaskReportsJson: " + e.getMessage());
            return "[]";
        }
    }

    /** ISO local timestamps + phase so the model treats in-progress sprints as a live snapshot. */
    private String buildSprintTimelineJson(Sprint s) {
        try {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime start = s.getStartDate();
            LocalDateTime due = s.getDueDate();
            String phase;
            if (start != null && now.isBefore(start)) {
                phase = "not_started";
            } else if (due != null && now.isAfter(due)) {
                phase = "ended";
            } else {
                phase = "in_progress";
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("phase", phase);
            m.put("startDate", start != null ? start.toString() : "");
            m.put("dueDate", due != null ? due.toString() : "");
            m.put("asOf", now.toString());
            m.put("isEarlySnapshot", isSprintEarlyForProductivityGuide(s));
            if (s.getGoal() != null && !s.getGoal().isBlank()) {
                m.put("sprintGoal", s.getGoal().trim());
            }
            return mapper.writeValueAsString(m);
        } catch (Exception e) {
            return "{\"phase\":\"unknown\"}";
        }
    }

    private Map<String, Long> getCanonicalTaskStatusCounts(Long sprintId) {
        Map<String, Long> canonical = new LinkedHashMap<>();
        canonical.put("TODO", 0L);
        canonical.put("IN_PROCESS", 0L);
        canonical.put("IN_REVIEW", 0L);
        canonical.put("DONE", 0L);
        canonical.put("UNKNOWN", 0L);
        try {
            List<Object[]> rows = taskRepository.countTasksByStatusForSprint(sprintId);
            if (rows != null) {
                for (Object[] row : rows) {
                    String st = row[0] != null ? row[0].toString().trim() : "";
                    long cnt = row[1] instanceof Number ? ((Number) row[1]).longValue() : 0L;
                    String normalized = normalizeWorkflowStatus(st);
                    if (canonical.containsKey(normalized)) {
                        canonical.put(normalized, canonical.get(normalized) + cnt);
                    } else {
                        canonical.put("UNKNOWN", canonical.get("UNKNOWN") + cnt);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] getCanonicalTaskStatusCounts: " + e.getMessage());
        }
        return canonical;
    }

    private String buildTaskStatusCountsJson(Long sprintId) {
        try {
            Map<String, Long> canonical = getCanonicalTaskStatusCounts(sprintId);
            List<Map<String, Object>> out = new ArrayList<>();
            out.add(statusRow("TODO", canonical.get("TODO"), 0));
            out.add(statusRow("IN_PROCESS", canonical.get("IN_PROCESS"), 1));
            out.add(statusRow("IN_REVIEW", canonical.get("IN_REVIEW"), 2));
            out.add(statusRow("DONE", canonical.get("DONE"), 3));
            if (canonical.get("UNKNOWN") != null && canonical.get("UNKNOWN") > 0) {
                out.add(statusRow("UNKNOWN", canonical.get("UNKNOWN"), 4));
            }
            return mapper.writeValueAsString(out);
        } catch (Exception e) {
            System.err.println("[GeminiService] buildTaskStatusCountsJson: " + e.getMessage());
            return "[]";
        }
    }

    private Map<String, Object> statusRow(String status, long count, int flowOrder) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", status);
        m.put("count", count);
        m.put("flowOrder", flowOrder);
        return m;
    }

    private String normalizeWorkflowStatus(String raw) {
        if (raw == null || raw.isBlank()) return "UNKNOWN";
        String n = raw.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        if ("TODO".equals(n) || "TO_DO".equals(n) || "BACKLOG".equals(n) || "PENDING".equals(n)) {
            return "TODO";
        }
        if ("IN_PROCESS".equals(n) || "IN_PROGRESS".equals(n) || "DOING".equals(n) || "WIP".equals(n)) {
            return "IN_PROCESS";
        }
        if ("IN_REVIEW".equals(n) || "REVIEW".equals(n) || "CODE_REVIEW".equals(n) || "QA".equals(n)) {
            return "IN_REVIEW";
        }
        if ("DONE".equals(n) || "COMPLETED".equals(n) || "FINISHED".equals(n) || "CLOSED".equals(n)) {
            return "DONE";
        }
        return "UNKNOWN";
    }

    private String buildPrompt(Sprint currentSprint, List<Sprint> allSprints, Long sprintId) {
        double cr  = toPercent(currentSprint.getCompletionRate());
        double otd = toPercent(currentSprint.getOnTimeDelivery());
        double tp  = toPercent(currentSprint.getTeamParticipation());
        double wb  = toPercent(currentSprint.getWorkloadBalance());
        double ps  = (cr * 0.4) + (otd * 0.3) + (tp * 0.2) + (wb * 0.1);

        String teamWorkloadJson = buildTeamWorkloadJson(sprintId);
        String blockedUserTaskReportsJson = buildBlockedUserTaskReportsJson(sprintId);

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
        String timelineJson = buildSprintTimelineJson(currentSprint);
        String taskStatusJson = buildTaskStatusCountsJson(sprintId);
        Map<String, Long> canonicalTaskCounts = getCanonicalTaskStatusCounts(sprintId);
        long todoCount = canonicalTaskCounts.getOrDefault("TODO", 0L);
        long inProcessCount = canonicalTaskCounts.getOrDefault("IN_PROCESS", 0L);
        long inReviewCount = canonicalTaskCounts.getOrDefault("IN_REVIEW", 0L);
        long doneCount = canonicalTaskCounts.getOrDefault("DONE", 0L);
        long unknownCount = canonicalTaskCounts.getOrDefault("UNKNOWN", 0L);

        return "You are an expert Agile coach analyzing sprint KPI data for a software development team.\n\n" +
            "Analyze the following sprint data and return ONLY a valid JSON object with no markdown, no backticks, no explanation outside the JSON.\n\n" +
            "## Language\n" +
            "- All human-readable strings (messages, summaries, insights, predictions) MUST be in English.\n" +
            "- Prose rule: Write only for managers and engineers. Never name database tables, columns, SQL, storage layers, "
            + "or internal JSON/input field names in any user-facing string (use everyday product language instead).\n\n" +
            "## Current Sprint (ID: " + currentSprint.getId() + ")\n" +
            String.format(
                "{\"sprintId\":%d,\"completionRate\":%.1f,\"onTimeDelivery\":%.1f," +
                "\"teamParticipation\":%.1f,\"workloadBalance\":%.1f,\"productivityScore\":%.1f}\n\n",
                currentSprint.getId(), cr, otd, tp, wb, ps) +
            "## Sprint timeline (live snapshot; phase is authoritative for whether the sprint has ended)\n" +
            timelineJson + "\n\n" +
            "## Task counts by status (this sprint only)\n" +
            taskStatusJson + "\n\n" +
            "## Canonical status totals (match these integers to narrative; do not echo these bucket codes in user-facing text)\n" +
            String.format(
                "TODO=%d, IN_PROCESS=%d, IN_REVIEW=%d, DONE=%d, UNKNOWN=%d\n\n",
                todoCount, inProcessCount, inReviewCount, doneCount, unknownCount
            ) +
            "## Historical Data (previous sprints, most recent first)\n" +
            historyJson + "\n\n" +
            "## Team workload (per developer: assignments, hours, sample tasks with optional startDate/dueDate; compare task startDate to Sprint timeline.asOf before judging delay; fromSprintRosterOnly=true means on sprint roster but no assignment rows yet — still include them in developerInsights)\n" +
            teamWorkloadJson + "\n\n" +
            "## Blocked assignments (assignee flagged their own assignment as blocked, with reason when provided)\n" +
            blockedUserTaskReportsJson + "\n\n" +
            "## Context\n" +
            "- KPI scale: 0-100 (100 = perfect)\n" +
            "- productivityScore = (completionRate x 0.4) + (onTimeDelivery x 0.3) + (teamParticipation x 0.2) + (workloadBalance x 0.1)\n" +
            "- workloadBalance < 70 means task distribution is uneven across developers\n" +
            "- Task status workflow is strictly: To do → In progress → In review → Done (same order as the canonical tally keys above — never print those codes in narrative text).\n" +
            "- Treat status movement as forward only when it follows that order; regressions are moves to an earlier stage.\n" +
            "- " + trendHint + "\n\n" +
            "## Required JSON Response Structure\n" +
            "Return exactly this structure (example values are illustrative):\n" +
            "{\"alerts\":[{\"severity\":\"critical\",\"kpi\":\"onTimeDelivery\"," +
            "\"message\":\"On-Time Delivery has dropped 15% over the last 2 sprints.\",\"value\":40,\"threshold\":60}]," +
            "\"actionableRecommendations\":[{\"category\":\"workload_redistribution\"," +
            "\"text\":\"Move 2 tasks from Maria to Juan to balance workload.\"}," +
            "{\"category\":\"estimates\",\"text\":\"Erick's tasks take 3x longer than average. Review estimates.\"}," +
            "{\"category\":\"planning\",\"text\":\"Reduce next sprint story points by ~20% to improve On-Time Delivery.\"}," +
            "{\"category\":\"training\",\"text\":\"Erick may need support in the stack used on backend tasks — consider mentoring.\"}," +
            "{\"category\":\"blockers\",\"text\":\"Task #45 has been blocked for 3 days — review with the team.\"}]," +
            "\"executiveSummary\":{\"overview\":\"Task status in this sprint: 4 To do, 6 In progress, 2 In review, 18 Done. The team completed 28 of 32 tasks (88% completion rate).\",\"trends\":\"Productivity improved 12% vs the previous sprint.\"," +
            "\"improvementAreas\":\"On-Time Delivery fell to 72%. Focus on meeting deadlines.\",\"nextSteps\":\"Distribute tasks more evenly in the next sprint.\"}," +
            "\"developerInsights\":[{\"developerName\":\"Carlos\",\"insight\":\"Completed all tasks on time. Strong performance.\",\"overloaded\":false}]," +
            "\"predictions\":{\"productivityOutlook\":\"If the current trend holds, Productivity Score may reach 90% next sprint.\"," +
            "\"risks\":\"Risk of missing the current sprint unless active blockers are resolved.\"," +
            "\"deliveryEstimate\":\"At the current pace, the project may finish later than planned.\"}," +
            "\"workloadRecommendations\":[{\"from\":\"Most-loaded developer\",\"to\":\"Least-loaded developer\",\"tasksToMove\":2," +
            "\"reason\":\"Low workload balance; redistribution is recommended.\"}]," +
            "\"productivityPrediction\":{\"predictedScore\":72,\"trend\":\"down\"," +
            "\"confidence\":\"medium\",\"reasoning\":\"Consistent decline in on-time delivery.\"}," +
            "\"kpiManagerGuide\":{\"intro\":\"One-sentence headline for an engineering manager.\",\"byMetric\":{" +
            "\"completionRate\":\"1-2 sentences tied to the current %.\",\"onTimeDelivery\":\"...\"," +
            "\"teamParticipation\":\"...\",\"workloadBalance\":\"...\",\"productivityScore\":\"...\"}}," +
            "\"summary\":\"Brief 2-3 sentence assessment and the top priority action.\"}\n\n" +
            "## Rules\n" +
            "- Sprint not started yet: If Sprint timeline.phase is not_started (asOf before startDate), KPIs are pre-execution baselines — not evidence the team is behind. Do NOT frame low completion, on-time delivery, or productivity as performance problems, delivery risk, or \"missing the sprint\" because work has not begun. Do NOT use 'warning' or 'critical' alerts for KPI shortfalls caused only by the calendar. predictions must be conditional and calm (e.g. revisit after the sprint starts); avoid urgent \"at current pace\" delivery judgments. Still produce workloadRecommendations and overloaded flags when workloadBalance < 70 or planned assignments/assignedHoursSum are clearly uneven across developers — frame as planning guidance (rebalance before the sprint starts), not execution failure. actionableRecommendations: up to 3 preparatory items (workload_redistribution, planning, blockers from the blocked list); use [] only when assignments are balanced and there are no blockers. executiveSummary and summary: briefly state the sprint has not started (plain English dates), acknowledge roster/tasks as planned, and mention workload balance or overload risks when assignment data supports it.\n" +
            "- Mid-sprint (in_progress only): KPIs are a partial snapshot — still produce substantive output. Use severity 'info' for neutral early observations (e.g. pace vs time remaining, scope vs done count). Do not leave executiveSummary fields blank, omit developerInsights when team workload is non-empty, or return empty actionableRecommendations solely because the sprint has not ended or scores are low.\n" +
            "- Tasks not yet in their execution window: Each taskSamples entry may include startDate. Compare Sprint timeline.asOf to that startDate (ISO local). If asOf is strictly before a task's startDate, you MUST NOT treat that task as late, at risk, or poor execution because it is still To do/In progress/In review; do not cite it in alerts, risks, or recommendations as delay or backlog pressure. Ignore \"zero progress\" on those tasks when judging developers or workload. Recommendations must not be driven only by such not-yet-started tasks.\n" +
            "- In all narrative strings (alerts, recommendations, predictions, summaries, developer insights), "
            + "refer to task statuses in plain English with title-style words: \"To do\", \"In progress\", \"In review\", \"Done\". "
            + "Never write TODO, IN_REVIEW, IN_PROCESS, DONE, or snake_case status tokens in user-facing text. "
            + "Counts must still match the integers in \"Canonical status totals\".\n"
            + "- Anti-meta: Do not quote, paraphrase, or paste long internal instructions, metric definitions, or methodology from this prompt into user-facing strings. Write naturally for a PM or engineering lead — short, concrete coaching, not spec language.\n" +
            "- alerts: severity must follow the numeric 'value' on the 0-100 scale for the five main KPIs: 'critical' only if value < 40 (or the message states a 20+ point drop across 2+ sprints), " +
            "'warning' only if 40 <= value < 60, and 'info' if value >= 60. For teamParticipation and productivityScore, 100 is a strong/ideal score, not a problem — never use 'warning' or 'critical' solely because participation or productivity is high; that contradicts the scale. " +
            "For workloadBalance, values >= 70 mean reasonably balanced work distribution; 'warning' typically applies when value is below 70. For blocker-related alerts, prefer severity 'warning' when the blocked-assignment list is non-empty; do not put a 0-100 percentage in 'value' for those — omit 'value' or use the count of blocked rows. Use [] if there are no alerts.\n" +
            "- actionableRecommendations: 3-8 items when useful if phase is in_progress or ended; if phase is not_started, follow the \"Sprint not started yet\" limits above instead. If phase is in_progress and (task counts show any tasks OR team workload is non-empty), include at least 2 items grounded in task counts by status, sample tasks in team workload (respecting task startDate vs asOf), blocked-assignment list above, or KPIs — but do not add filler recommendations for tasks whose startDate is after asOf. category must be one of: workload_redistribution, estimates, planning, training, blockers. Use [] only when there is truly no task or team data, or when not_started rules cap recommendations.\n" +
            "  Examples: workload_redistribution → move tasks between people to balance load; estimates → tasks taking much longer than team average; planning → adjust next sprint scope/story points for on-time delivery; training → developer needs support in a skill (infer from task titles/classification when possible); blockers → name the task and assignee in plain language when blocked work appears in the data above.\n" +
            "  For workload_redistribution, also evaluate worked-hour imbalance: if someone with urgent/open tasks has clearly higher logged hours than peers, recommend moving 1-2 suitable tasks to a teammate with lower logged hours and little/no open work.\n" +
            "- executiveSummary: all four fields non-empty strings in English (use KPIs, history, task status counts, and timeline phase; if data is thin, still give concise coaching text — for in_progress, mention remaining time and current pace).\n" +
            "- executiveSummary.overview MUST start with exactly one sentence of the form: \"Task status in this sprint: <n> To do, <n> In progress, <n> In review, <n> Done.\" using the integers from \"Canonical status totals\" above (no estimates). If the unknown count is greater than 0, append: \" <n> task(s) use other or unknown statuses.\" Then continue with narrative after that sentence.\n" +
            "- Blocked assignments: when that list is non-empty, you MUST reflect it in alerts; default severity to 'warning' (delivery risk) rather than 'info' unless the situation is truly negligible. Use actionableRecommendations (at least one category blockers when material), developerInsights for each affected assignee, predictions.risks, and executiveSummary where relevant. The assignee named there is the developer who flagged their own assignment as blocked.\n" +
            "- developerInsights: one object per developer in the team workload list (including fromSprintRosterOnly=true); compare assignedTaskRows and workedHoursSum to team averages; for roster-only rows, note they are on the sprint roster but have no tracked assignment rows yet. If that list is empty, set developerInsights to [].\n" +
            "  Each object MUST include a boolean field 'overloaded'. Set overloaded=true ONLY when BOTH (a) and (b) are met:\n" +
            "    (a) The developer still has uncompleted work in this sprint — i.e., (assignedTaskRows − completedTasks) ≥ 1. If they have already completed all their assigned work, overloaded MUST be false regardless of how many hours they logged.\n" +
            "    (b) The developer is clearly carrying more in-flight work than peers — for example: workedHoursSum is significantly above the team average (roughly 1.4x+ the team mean) AND/OR assignedTaskRows is significantly above the team average, OR assignedHoursSum (estimated load) is clearly higher than peers with a similar assignment count, OR the developer is juggling multiple blocked or urgent tasks that add real pressure.\n" +
            "  Otherwise set overloaded=false. If another developer has the same assignedTaskRows and similar workedHoursSum and assignedHoursSum, do NOT mark overloaded=true for only one of them — treat parity as not overloaded unless hours/estimates or blocked/urgent pressure clearly skew to one person. Roster-only developers and developers with zero assignment rows MUST have overloaded=false. High logged hours alone do not justify overload when there is no pending work. When the team has 2 or fewer developers, mark overloaded=true only if there is an unmistakable disparity.\n" +
            "  When overloaded=true, the same developer's 'insight' text must explicitly justify it in plain English (cite the higher hours or task count vs the team, or the urgent/blocked work driving the pressure), mention that uncompleted work remains, and name a specific teammate to receive moved tasks (use the least-loaded assignee by assignedTaskRows/assignedHoursSum).\n" +
            "  If the blocked-assignment list includes a developer, mention their blocked task(s) and reason in that developer's insight (plain language only).\n" +
            "  Use completedTasks, onTimeCompletedTasks, and lateCompletedTasks to evaluate delivery quality per developer (on-time vs late outcomes).\n" +
            "  Data-quality guardrail: if completedWithZeroHours > 0 or workedHoursSum is 0 while completedTasks > 0, do NOT praise this as strong performance; explicitly flag missing/inconsistent hour logging and request timesheet validation.\n" +
            "  When completedTasks is 0 for everyone, still return one developerInsights entry per person in Team workload with concise English (workload vs peers, assigned hours/rows, roster-only, or that no completed work appears in the snapshot yet). Do not omit developers solely because completions are zero. If phase is not_started, keep these neutral (planned/upcoming work only; no implied underperformance).\n" +
            "- predictions: all three string fields in English, grounded in the KPIs/trends and Task counts by status; for in_progress sprints, frame outlook/risks/delivery as conditional on remaining time (not only post-mortem). productivityOutlook may cite score trajectory; risks should mention blockers or delivery gaps when relevant; deliveryEstimate compares pace to plan.\n" +
            "- workloadRecommendations: only if workloadBalance < 70 or planned assignment counts/hours are materially uneven; else []. When generated, base from/to on assignedTaskRows and assignedHoursSum (for not_started, prefer planned load over workedHoursSum). For in_progress sprints, also use workedHoursSum and open urgent work. Avoid assigning additional tasks to the most-loaded developer when a teammate has lower planned or logged load.\n" +
            "  Never set 'to' / destination to a developer who has the highest workedHoursSum on the team workload list when another teammate has lower hours and can take work — especially do not move tasks onto someone who already logged the most hours this sprint.\n" +
            "- productivityPrediction.predictedScore: integer 0-100; trend: 'up', 'down', or 'stable'; reasoning in English.\n" +
            "- kpiManagerGuide: required for managers. intro: one clear English sentence summarizing how the sprint KPIs read together. " +
            "byMetric must include exactly these five string keys: completionRate, onTimeDelivery, teamParticipation, workloadBalance, productivityScore — " +
            "each 1-2 sentences interpreting the current percentages from \"Current Sprint\" above (reference approximate values); explain practical implications for delivery and team load, not textbook definitions alone. " +
            "For workloadBalance: if the value is >= 70, state that task assignment is evenly distributed; do NOT claim uneven distribution or uneven execution solely because completion pace differs — that KPI does not measure execution speed.\n" +
            "- kpiManagerGuide.byMetric.productivityScore: same style as completionRate, onTimeDelivery, teamParticipation, and workloadBalance — "
            + "1-2 sentences with the productivityScore %% from \"Current Sprint\" and what that value means for delivery and team load (composite of the four KPIs). "
            + "When Sprint timeline.phase is not_started OR isEarlySnapshot is true: interpret the %% like the other metrics — do NOT justify a low %% "
            + "(no baseline, expected, underperforming, sprint not started, early snapshot, little work completed yet, or similar excuses). "
            + "You MAY add one short sentence that the score will update as the sprint runs and tasks or hours change. "
            + "FORBIDDEN always: \"matching the KPI card above\", formula weights (40%%/30%%/20%%/10%%).\n" +
            "- summary: English; may echo executiveSummary.overview.\n" +
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
    // INSIGHT JSON: normalize Gemini quirks + fill empty sections from DB workload
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Public so GET /api/insights can return the same enriched shape as new generations
     * (snake_case keys, empty developerInsights / recommendations, sparse executiveSummary).
     */
    public JsonNode enrichInsightsForResponse(JsonNode insights, Long sprintId) {
        try {
            if (insights == null || !insights.isObject()) {
                return insights;
            }
            String cacheKey = sprintId + "|" + insights.hashCode();
            long now = System.currentTimeMillis();
            CachedEnrichedInsights hit = enrichResponseCache.get(cacheKey);
            if (hit != null && hit.expiresAtMs > now) {
                return applyLiveDeveloperNarratives(hit.node, sprintId);
            }
            JsonNode enriched = enrichInsightsForResponseUncached(insights, sprintId);
            if (enriched != null) {
                enrichResponseCache.put(
                    cacheKey,
                    new CachedEnrichedInsights(enriched, now + ENRICH_RESPONSE_CACHE_MS));
                if (enrichResponseCache.size() > 80) {
                    enrichResponseCache.entrySet().removeIf(e -> e.getValue().expiresAtMs <= now);
                }
            }
            return applyLiveDeveloperNarratives(enriched, sprintId);
        } catch (Exception e) {
            System.err.println("[GeminiService] enrichInsightsForResponse: " + e.getMessage());
            return insights;
        }
    }

    /** Recomputes developerInsights text from DB on every response (not only at Gemini generation time). */
    private JsonNode applyLiveDeveloperNarratives(JsonNode enriched, Long sprintId) {
        if (enriched == null || !enriched.isObject() || sprintId == null) {
            return enriched;
        }
        ObjectNode copy = ((ObjectNode) enriched).deepCopy();
        syncDeveloperInsightNarrativesFromLiveWorkload(copy, sprintId);
        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
        ensureWorkloadGuidanceFromAssignments(copy, sprintId, sprint);
        return copy;
    }

    private JsonNode enrichInsightsForResponseUncached(JsonNode insights, Long sprintId) {
        try {
            if (insights == null || !insights.isObject()) {
                return insights;
            }
            JsonNode normalized = camelCaseKeysDeep(insights);
            if (!normalized.isObject()) {
                return insights;
            }
            ObjectNode root = (ObjectNode) normalized;
            normalizeDeveloperInsightRows(root);
            normalizeActionableRecommendationRows(root);
            enrichDeveloperInsightsIfEmpty(root, sprintId);
            enforceOverloadFromWorkloadSnapshot(root, sprintId);
            clampOverloadWhenPeerHasSameAssignmentCount(root, sprintId);
            Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
            enrichActionableRecommendationsIfEmpty(root, sprint);
            normalizeActionableRecommendationCounts(root, sprintId);
            refineWorkloadRedistributionRecommendations(root, sprintId);
            ensureWorkloadGuidanceFromAssignments(root, sprintId, sprint);
            suppressComparativeTrendsForFirstSprint(root, sprintId);
            enrichExecutiveSummaryIfSparse(root);
            injectTaskStatusBreakdownAndOverviewLead(root, sprintId);
            injectBlockedAssignmentsSnapshot(root, sprintId);
            normalizeAlertSeverities(root);
            removeContradictoryWorkloadBalanceAlerts(root, sprintId);
            normalizeKpiManagerGuideWorkloadBalance(root, sprintId);
            normalizeKpiManagerGuideProductivityScore(root, sprintId);
            prettifyHumanProseInInsights(root);
            return root;
        } catch (Exception e) {
            System.err.println("[GeminiService] enrichInsightsForResponseUncached: " + e.getMessage());
            return insights;
        }
    }

    private static String snakeToLowerCamel(String snake) {
        String[] p = snake.split("_");
        if (p.length == 0) {
            return snake;
        }
        StringBuilder b = new StringBuilder(p[0]);
        for (int i = 1; i < p.length; i++) {
            if (p[i].isEmpty()) {
                continue;
            }
            b.append(Character.toUpperCase(p[i].charAt(0)));
            if (p[i].length() > 1) {
                b.append(p[i].substring(1));
            }
        }
        return b.toString();
    }

    private JsonNode camelCaseKeysDeep(JsonNode node) {
        if (node.isArray()) {
            ArrayNode out = mapper.createArrayNode();
            for (JsonNode item : node) {
                out.add(camelCaseKeysDeep(item));
            }
            return out;
        }
        if (!node.isObject()) {
            return node;
        }
        ObjectNode out = mapper.createObjectNode();
        ((ObjectNode) node).properties().forEach(e -> {
            String k = e.getKey();
            String nk = k.contains("_") ? snakeToLowerCamel(k) : k;
            out.set(nk, camelCaseKeysDeep(e.getValue()));
        });
        return out;
    }

    private static void renameFieldIfPresent(ObjectNode obj, String oldKey, String newKey) {
        if (oldKey.equals(newKey) || !obj.has(oldKey) || obj.has(newKey)) {
            return;
        }
        obj.set(newKey, obj.remove(oldKey));
    }

    private void normalizeDeveloperInsightRows(ObjectNode root) {
        JsonNode n = root.get("developerInsights");
        if (n == null || !n.isArray()) {
            return;
        }
        for (JsonNode item : n) {
            if (!item.isObject()) {
                continue;
            }
            ObjectNode o = (ObjectNode) item;
            renameFieldIfPresent(o, "developer_name", "developerName");
            renameFieldIfPresent(o, "DeveloperName", "developerName");
            renameFieldIfPresent(o, "Insight", "insight");
            renameFieldIfPresent(o, "Overloaded", "overloaded");
            renameFieldIfPresent(o, "over_loaded", "overloaded");
            renameFieldIfPresent(o, "is_overloaded", "overloaded");
            renameFieldIfPresent(o, "isOverloaded", "overloaded");
            JsonNode flag = o.get("overloaded");
            if (flag == null || flag.isNull()) {
                o.put("overloaded", false);
            } else if (!flag.isBoolean()) {
                String s = flag.asText("").trim().toLowerCase();
                boolean truthy = s.equals("true") || s.equals("yes") || s.equals("1");
                o.put("overloaded", truthy);
            }
        }
    }

    /**
     * Deterministic guardrail: Gemini may still mark overloaded=true when assignedTaskRows equals completedTasks
     * (no incomplete assignments). Force overloaded=false from Team workload JSON so UI stays consistent without
     * requiring regeneration — persisted insights are re-enriched on GET when sprintId is known.
     */
    private void enforceOverloadFromWorkloadSnapshot(ObjectNode root, Long sprintId) {
        try {
            JsonNode wl = mapper.readTree(buildTeamWorkloadJson(sprintId));
            if (wl == null || !wl.isArray()) {
                return;
            }
            Map<String, JsonNode> rowByDevLower = new HashMap<>();
            for (JsonNode row : wl) {
                if (row == null || !row.isObject()) {
                    continue;
                }
                String dn = row.path("developerName").asText("").trim().toLowerCase(Locale.ROOT);
                if (!dn.isEmpty()) {
                    rowByDevLower.put(dn, row);
                }
            }
            JsonNode insights = root.get("developerInsights");
            if (insights == null || !insights.isArray()) {
                return;
            }
            for (JsonNode item : insights) {
                if (item == null || !item.isObject()) {
                    continue;
                }
                ObjectNode o = (ObjectNode) item;
                String nameKey = o.path("developerName").asText("").trim().toLowerCase(Locale.ROOT);
                JsonNode row = nameKey.isEmpty() ? null : rowByDevLower.get(nameKey);
                if (row == null) {
                    continue;
                }
                boolean rosterOnly = row.path("fromSprintRosterOnly").asBoolean(false);
                int assignedRows = row.path("assignedTaskRows").asInt(0);
                int completedTasks = row.path("completedTasks").asInt(0);
                int pendingIncompleteAssignments = assignedRows - completedTasks;
                if (rosterOnly || pendingIncompleteAssignments <= 0) {
                    o.put("overloaded", false);
                    o.put("overloadGuardrailCorrected", true);
                }
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] enforceOverloadFromWorkloadSnapshot: " + e.getMessage());
        }
    }

    /**
     * Gemini may mark overloaded for one developer when a peer has the same assignment row count.
     * Clear overload unless this developer has materially higher logged hours or estimated hours
     * than the highest among tied peers (same assignedTaskRows, non-roster).
     */
    private void clampOverloadWhenPeerHasSameAssignmentCount(ObjectNode root, Long sprintId) {
        try {
            JsonNode wl = mapper.readTree(buildTeamWorkloadJson(sprintId));
            if (wl == null || !wl.isArray() || wl.size() < 2) {
                return;
            }
            class Snap {
                final String nameLower;
                final int assigned;
                final int completed;
                final long workedHours;
                final long assignedHours;
                final boolean rosterOnly;

                Snap(String nameLower, int assigned, int completed, long workedHours, long assignedHours,
                    boolean rosterOnly) {
                    this.nameLower = nameLower;
                    this.assigned = assigned;
                    this.completed = completed;
                    this.workedHours = workedHours;
                    this.assignedHours = assignedHours;
                    this.rosterOnly = rosterOnly;
                }
            }
            List<Snap> snaps = new ArrayList<>();
            for (JsonNode row : wl) {
                if (row == null || !row.isObject()) {
                    continue;
                }
                String dn = row.path("developerName").asText("").trim().toLowerCase(Locale.ROOT);
                if (dn.isEmpty()) {
                    continue;
                }
                boolean rosterOnly = row.path("fromSprintRosterOnly").asBoolean(false);
                int assigned = row.path("assignedTaskRows").asInt(0);
                int completed = row.path("completedTasks").asInt(0);
                long wh = row.path("workedHoursSum").asLong(0);
                long ah = row.path("assignedHoursSum").asLong(0);
                snaps.add(new Snap(dn, assigned, completed, wh, ah, rosterOnly));
            }
            JsonNode insights = root.get("developerInsights");
            if (insights == null || !insights.isArray()) {
                return;
            }
            for (JsonNode item : insights) {
                if (item == null || !item.isObject()) {
                    continue;
                }
                ObjectNode o = (ObjectNode) item;
                if (!o.path("overloaded").asBoolean(false)) {
                    continue;
                }
                String nameKey = o.path("developerName").asText("").trim().toLowerCase(Locale.ROOT);
                Snap self = null;
                for (Snap s : snaps) {
                    if (s.nameLower.equals(nameKey)) {
                        self = s;
                        break;
                    }
                }
                if (self == null || self.rosterOnly || self.assigned <= 0) {
                    continue;
                }
                int pending = self.assigned - self.completed;
                if (pending < 1) {
                    continue;
                }
                long maxPeerWh = 0L;
                long maxPeerAh = 0L;
                int peersWithSameAssigned = 0;
                for (Snap p : snaps) {
                    if (p.rosterOnly || p.assigned != self.assigned) {
                        continue;
                    }
                    peersWithSameAssigned++;
                    if (p.nameLower.equals(self.nameLower)) {
                        continue;
                    }
                    maxPeerWh = Math.max(maxPeerWh, p.workedHours);
                    maxPeerAh = Math.max(maxPeerAh, p.assignedHours);
                }
                if (peersWithSameAssigned < 2) {
                    continue;
                }
                boolean moreLoggedHours =
                    self.workedHours >= maxPeerWh + 8L || (maxPeerWh > 0 && self.workedHours >= (long) (maxPeerWh * 1.35));
                boolean moreEstimatedHours =
                    self.assignedHours >= maxPeerAh + 16L
                        || (maxPeerAh > 0 && self.assignedHours >= (long) (maxPeerAh * 1.35));
                if (!moreLoggedHours && !moreEstimatedHours) {
                    o.put("overloaded", false);
                    o.put("overloadParityGuardrailCorrected", true);
                }
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] clampOverloadWhenPeerHasSameAssignmentCount: " + e.getMessage());
        }
    }

    private void normalizeActionableRecommendationRows(ObjectNode root) {
        JsonNode n = root.get("actionableRecommendations");
        if (n == null || !n.isArray()) {
            return;
        }
        for (JsonNode item : n) {
            if (!item.isObject()) {
                continue;
            }
            ObjectNode o = (ObjectNode) item;
            renameFieldIfPresent(o, "Category", "category");
            renameFieldIfPresent(o, "Text", "text");
        }
    }

    private ArrayNode ensureArrayField(ObjectNode root, String field) {
        JsonNode n = root.get(field);
        if (n != null && n.isArray()) {
            return (ArrayNode) n;
        }
        ArrayNode a = mapper.createArrayNode();
        root.set(field, a);
        return a;
    }

    private void enrichDeveloperInsightsIfEmpty(ObjectNode root, Long sprintId) throws Exception {
        ArrayNode dev = ensureArrayField(root, "developerInsights");
        if (dev.size() > 0) {
            return;
        }
        JsonNode wl = mapper.readTree(buildTeamWorkloadJson(sprintId));
        if (!wl.isArray()) {
            return;
        }
        for (JsonNode row : wl) {
            if (!row.isObject()) {
                continue;
            }
            String name = row.path("developerName").asText("").trim();
            if (name.isEmpty()) {
                continue;
            }
            int completed = row.path("completedTasks").asInt(0);
            int assignedRows = row.path("assignedTaskRows").asInt(0);
            boolean rosterOnly = row.path("fromSprintRosterOnly").asBoolean(false);
            String insight;
            if (rosterOnly) {
                insight = "On the sprint roster, but no assignment rows appear for this sprint in the snapshot — "
                    + "if this person should have work assigned, check assignees and refresh the data.";
            } else if (completed == 0 && assignedRows > 0) {
                insight = String.format(
                    "%d assignment row(s) in this sprint; %d completed (Done) in the current snapshot — "
                        + "work may still be in progress or statuses not updated yet.",
                    assignedRows, completed);
            } else if (completed > 0) {
                insight = String.format("%d completed task(s) recorded on assigned work in this sprint.", completed);
            } else {
                insight = "No assignment rows in the workload snapshot for this sprint.";
            }
            ObjectNode o = mapper.createObjectNode();
            o.put("developerName", name);
            o.put("insight", insight);
            o.put("overloaded", false);
            dev.add(o);
        }
    }

    /**
     * Overwrites persisted Gemini prose with facts from the current USER_TASK / TASK snapshot on every GET.
     * Narrative style is kept similar to AI Insights, but counts and on-time/late come from live DB rows.
     */
    private void syncDeveloperInsightNarrativesFromLiveWorkload(ObjectNode root, Long sprintId) {
        try {
            JsonNode wl = mapper.readTree(buildTeamWorkloadJson(sprintId));
            if (wl == null || !wl.isArray()) {
                return;
            }
            long workedSum = 0;
            int workedDevCount = 0;
            for (JsonNode row : wl) {
                if (row == null || !row.isObject()) {
                    continue;
                }
                if (row.path("fromSprintRosterOnly").asBoolean(false)
                    || row.path("fromProjectTeamOnly").asBoolean(false)) {
                    continue;
                }
                workedSum += row.path("workedHoursSum").asLong(0);
                workedDevCount++;
            }
            long teamAvgWorked = workedDevCount > 0
                ? Math.round((double) workedSum / workedDevCount) : 0L;

            ArrayNode dev = ensureArrayField(root, "developerInsights");
            Map<String, ObjectNode> byNameLower = new HashMap<>();
            for (JsonNode item : dev) {
                if (item != null && item.isObject()) {
                    String key = item.path("developerName").asText("").trim().toLowerCase(Locale.ROOT);
                    if (!key.isEmpty()) {
                        byNameLower.put(key, (ObjectNode) item);
                    }
                }
            }

            for (JsonNode row : wl) {
                if (row == null || !row.isObject()) {
                    continue;
                }
                String name = row.path("developerName").asText("").trim();
                if (name.isEmpty()) {
                    continue;
                }
                String key = name.toLowerCase(Locale.ROOT);
                ObjectNode o = byNameLower.get(key);
                if (o == null) {
                    o = mapper.createObjectNode();
                    o.put("developerName", name);
                    o.put("overloaded", false);
                    dev.add(o);
                    byNameLower.put(key, o);
                }
                o.put("insight", buildLiveDeveloperInsightNarrative(row, teamAvgWorked));
                o.put("liveDataSynced", true);
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] syncDeveloperInsightNarrativesFromLiveWorkload: " + e.getMessage());
        }
    }

    private static String buildLiveDeveloperInsightNarrative(JsonNode row, long teamAvgWorkedHours) {
        boolean rosterOnly = row.path("fromSprintRosterOnly").asBoolean(false);
        boolean projectTeamOnly = row.path("fromProjectTeamOnly").asBoolean(false);
        int completed = row.path("completedTasks").asInt(0);
        int onTime = row.path("onTimeCompletedTasks").asInt(0);
        int late = row.path("lateCompletedTasks").asInt(0);
        int unknown = row.path("unknownCompletionTiming").asInt(0);
        long worked = row.path("workedHoursSum").asLong(0);
        int assignedRows = row.path("assignedTaskRows").asInt(0);

        StringBuilder sb = new StringBuilder();
        if (projectTeamOnly) {
            sb.append("On the project team with no tasks assigned in this sprint.");
        } else if (rosterOnly) {
            sb.append("On the sprint roster with no assignment rows in the current snapshot.");
        } else if (completed == 0 && assignedRows > 0) {
            sb.append(String.format(
                "%d assignment row(s) in this sprint; none marked complete in the current snapshot.",
                assignedRows));
        } else if (completed > 0) {
            sb.append(String.format(
                "Completed %d assignment%s",
                completed,
                completed == 1 ? "" : "s"));
            int known = onTime + late;
            if (known == 0 && unknown > 0) {
                sb.append(
                    "; completion time is not recorded yet (set USER_TASK.COMPLETED_AT or re-complete to judge on-time delivery).");
            } else if (late == 0 && onTime > 0) {
                sb.append(", all finished on or before the due date.");
            } else if (onTime == 0 && late > 0) {
                sb.append(", all finished after the deadline.");
            } else if (late > 0 && onTime > 0) {
                sb.append(String.format(
                    ", with %d on time and %d after the deadline.",
                    onTime,
                    late));
            }
            if (unknown > 0 && known > 0) {
                sb.append(String.format(
                    " %d completed assignment%s lack a recorded completion timestamp.",
                    unknown,
                    unknown == 1 ? "" : "s"));
            }
        } else {
            sb.append("No assignment rows in the workload snapshot for this sprint.");
        }

        String hoursPhrase = describeWorkedHoursVsTeam(worked, teamAvgWorkedHours);
        if (!hoursPhrase.isEmpty()) {
            sb.append(' ').append(hoursPhrase);
        }
        return sb.toString().trim();
    }

    private static String describeWorkedHoursVsTeam(long worked, long teamAvg) {
        if (worked <= 0 && teamAvg <= 0) {
            return "";
        }
        if (teamAvg <= 0) {
            return worked > 0 ? "Hours logged on assignments." : "";
        }
        if (worked > teamAvg + Math.max(2, Math.round(teamAvg * 0.15))) {
            return "Hours logged are above the team average.";
        }
        if (worked > 0 && worked < teamAvg - Math.max(2, Math.round(teamAvg * 0.15))) {
            return "Hours logged are below the team average.";
        }
        return "Hours logged are within a reasonable range.";
    }

    private static boolean isUserTaskAssignmentComplete(UserTask ut) {
        return UserTask.isCompletedAssignmentStatus(ut != null ? ut.getStatus() : null);
    }

    /**
     * Per-assignee on-time: USER_TASK.completedAt vs task due date (calendar day).
     * Returns null when completion time is unknown (typical legacy multi-assignee rows).
     */
    private static Boolean evaluateUserTaskOnTime(UserTask ut, Task t, int assigneeCount) {
        if (t == null || t.getDueDate() == null) {
            return null;
        }
        LocalDateTime doneAt = ut.getCompletedAt();
        if (doneAt == null) {
            if (assigneeCount <= 1 && t.getFinishDate() != null) {
                doneAt = t.getFinishDate();
            } else {
                return null;
            }
        }
        return !doneAt.toLocalDate().isAfter(t.getDueDate().toLocalDate());
    }

    private void addRecommendation(ArrayNode recs, String category, String text) {
        ObjectNode o = mapper.createObjectNode();
        o.put("category", category);
        o.put("text", text);
        recs.add(o);
    }

    private void enrichActionableRecommendationsIfEmpty(ObjectNode root, Sprint sprint) {
        ArrayNode recs = ensureArrayField(root, "actionableRecommendations");
        if (recs.size() > 0) {
            return;
        }
        if (sprint != null) {
            double cr = toPercent(sprint.getCompletionRate());
            double wb = toPercent(sprint.getWorkloadBalance());
            double otd = toPercent(sprint.getOnTimeDelivery());
            if (cr < 60.0 && cr > 0.0) {
                addRecommendation(recs, "planning",
                    "Completion rate is below 60% in the stored KPI snapshot — review scope, blockers, and capacity.");
            }
            if (otd < 60.0 && otd > 0.0) {
                addRecommendation(recs, "planning",
                    "On-time delivery is under 60% among completed tasks — prioritize due dates and unblock stuck work.");
            }
            if (wb > 0.0 && wb < 70.0) {
                addRecommendation(recs, "workload_redistribution",
                    "Workload balance is under 70% — consider redistributing tasks among developers.");
            }
        }
        if (recs.size() == 0) {
            addRecommendation(recs, "planning",
                "Regenerate AI insights after updating tasks or assignments so recommendations stay aligned with the latest sprint data.");
        }
    }

    private void normalizeActionableRecommendationCounts(ObjectNode root, Long sprintId) {
        JsonNode n = root.get("actionableRecommendations");
        if (n == null || !n.isArray()) {
            return;
        }
        Map<String, Long> counts = getCanonicalTaskStatusCounts(sprintId);
        String todo = String.valueOf(counts.getOrDefault("TODO", 0L));
        String inProcess = String.valueOf(counts.getOrDefault("IN_PROCESS", 0L));
        String inReview = String.valueOf(counts.getOrDefault("IN_REVIEW", 0L));
        String done = String.valueOf(counts.getOrDefault("DONE", 0L));
        for (JsonNode item : n) {
            if (!item.isObject()) {
                continue;
            }
            ObjectNode o = (ObjectNode) item;
            String text = o.path("text").asText("");
            if (text.isBlank()) {
                continue;
            }
            String fixed = text;
            fixed = fixed.replaceAll("(?i)\\b\\d+\\s+tasks?\\s+in\\s+TODO\\b", todo + " tasks in To do");
            fixed = fixed.replaceAll(
                "(?i)\\b\\d+\\s+tasks?\\s+in\\s+(IN[_ ]?PROCESS|IN[_ ]?PROGRESS)\\b",
                inProcess + " tasks in In progress");
            fixed = fixed.replaceAll("(?i)\\b\\d+\\s+tasks?\\s+in\\s+IN[_ ]?REVIEW\\b",
                inReview + " tasks in In review");
            fixed = fixed.replaceAll(
                "(?i)\\b\\d+\\s+tasks?\\s+in\\s+(DONE|COMPLETED|FINISHED|CLOSED)\\b",
                done + " tasks in Done");

            fixed = fixed.replaceAll("(?i)\\bTODO\\s+status:\\s*\\d+\\b", "To do status: " + todo);
            fixed = fixed.replaceAll(
                "(?i)\\b(IN[_ ]?PROCESS|IN[_ ]?PROGRESS)\\s+status:\\s*\\d+\\b",
                "In progress status: " + inProcess);
            fixed = fixed.replaceAll("(?i)\\bIN[_ ]?REVIEW\\s+status:\\s*\\d+\\b",
                "In review status: " + inReview);
            fixed = fixed.replaceAll("(?i)\\b(DONE|COMPLETED|FINISHED|CLOSED)\\s+status:\\s*\\d+\\b",
                "Done status: " + done);
            if (!fixed.equals(text)) {
                o.put("text", fixed);
                o.put("guardrailCorrected", true);
            }
        }
    }

    private static class DeveloperStatusLoad {
        String name;
        int todo;
        int inProcess;
        int inReview;
        int done;
        int total;
    }

    private static class DeveloperUrgencyLoad {
        String name;
        int completed;
        int open;
        int urgentPending;
        long workedHours;
        /** Open (not Done) tasks matching {@link #isHighPriorityTask(Task)}. */
        int highPriorityOpen;
        /** Open tasks with due date within ~72h or overdue per {@link #isDueSoon(Task, LocalDateTime)}. */
        int dueSoonOpen;
    }

    private static class StatusSpread {
        String statusKey;
        String statusLabel;
        DeveloperStatusLoad from;
        DeveloperStatusLoad to;
        int spread;
    }

    private Map<String, DeveloperStatusLoad> buildDeveloperStatusLoad(Long sprintId) {
        Map<String, DeveloperStatusLoad> byName = new LinkedHashMap<>();
        try {
            List<UserTask> raw = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (raw == null) {
                return byName;
            }
            LinkedHashMap<String, UserTask> deduped = new LinkedHashMap<>();
            for (UserTask ut : raw) {
                if (ut == null || ut.getId() == null || ut.getTask() == null) {
                    continue;
                }
                String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
                deduped.putIfAbsent(key, ut);
            }
            for (UserTask ut : deduped.values()) {
                Long uid = ut.getId() != null ? ut.getId().getUserId() : null;
                if (uid == null) {
                    continue;
                }
                User u = ut.getUser();
                String name = (u != null && u.getName() != null && !u.getName().isBlank())
                    ? u.getName().trim()
                    : ("User " + uid);
                DeveloperStatusLoad d = byName.computeIfAbsent(name, k -> {
                    DeveloperStatusLoad x = new DeveloperStatusLoad();
                    x.name = k;
                    return x;
                });
                String norm = normalizeWorkflowStatus(ut.getTask().getStatus());
                if ("TODO".equals(norm)) d.todo++;
                else if ("IN_PROCESS".equals(norm)) d.inProcess++;
                else if ("IN_REVIEW".equals(norm)) d.inReview++;
                else if ("DONE".equals(norm)) d.done++;
                // Keep total derived from status buckets so each bucket (including done) is used.
                d.total = d.todo + d.inProcess + d.inReview + d.done;
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] buildDeveloperStatusLoad: " + e.getMessage());
        }
        return byName;
    }

    private StatusSpread computeStatusSpread(List<DeveloperStatusLoad> rows, String statusKey) {
        if (rows == null || rows.size() < 2) {
            return null;
        }
        Comparator<DeveloperStatusLoad> byName = Comparator.comparing(d -> d.name == null ? "" : d.name);
        DeveloperStatusLoad max = rows.stream()
            .max((a, b) -> {
                int va = statusValue(a, statusKey);
                int vb = statusValue(b, statusKey);
                if (va != vb) return Integer.compare(va, vb);
                return -byName.compare(a, b);
            })
            .orElse(null);
        DeveloperStatusLoad min = rows.stream()
            .min((a, b) -> {
                int va = statusValue(a, statusKey);
                int vb = statusValue(b, statusKey);
                if (va != vb) return Integer.compare(va, vb);
                return byName.compare(a, b);
            })
            .orElse(null);
        if (max == null || min == null) {
            return null;
        }
        StatusSpread s = new StatusSpread();
        s.statusKey = statusKey;
        s.statusLabel = statusLabel(statusKey);
        s.from = max;
        s.to = min;
        s.spread = Math.max(0, statusValue(max, statusKey) - statusValue(min, statusKey));
        return s;
    }

    private int statusValue(DeveloperStatusLoad d, String statusKey) {
        if (d == null) return 0;
        if ("TODO".equals(statusKey)) return d.todo;
        if ("IN_PROCESS".equals(statusKey)) return d.inProcess;
        if ("IN_REVIEW".equals(statusKey)) return d.inReview;
        return d.total;
    }

    private String statusLabel(String statusKey) {
        if ("TODO".equals(statusKey)) return "To do";
        if ("IN_PROCESS".equals(statusKey)) return "In progress";
        if ("IN_REVIEW".equals(statusKey)) return "In review";
        return "tasks";
    }

    private boolean isTaskDone(Task t) {
        return t != null && "DONE".equals(normalizeWorkflowStatus(t.getStatus()));
    }

    private boolean isTaskFinishedOnTime(Task t) {
        if (t == null || t.getFinishDate() == null || t.getDueDate() == null) return false;
        return !t.getFinishDate().isAfter(t.getDueDate());
    }

    private boolean isTaskFinishedLate(Task t) {
        if (t == null || t.getFinishDate() == null || t.getDueDate() == null) return false;
        return t.getFinishDate().isAfter(t.getDueDate());
    }

    private boolean isHighPriorityTask(Task t) {
        if (t == null) return false;
        String p = t.getPriority() != null ? t.getPriority().trim().toUpperCase() : "";
        String c = t.getClassification() != null ? t.getClassification().trim().toUpperCase() : "";
        String title = t.getTitle() != null ? t.getTitle().trim().toUpperCase() : "";
        return p.contains("HIGH")
            || p.contains("CRITICAL")
            || p.contains("URGENT")
            || c.contains("HIGH")
            || c.contains("CRITICAL")
            || c.contains("URGENT")
            || title.contains("[HIGH]")
            || title.contains("[URGENT]")
            || title.contains("CRITICAL");
    }

    private boolean isDueSoon(Task t, LocalDateTime now) {
        if (t == null || t.getDueDate() == null || now == null) return false;
        LocalDateTime due = t.getDueDate();
        // within next 72h (or overdue but still open)
        return !due.isAfter(now.plusDays(3));
    }

    private Map<String, DeveloperUrgencyLoad> buildDeveloperUrgencyLoad(Long sprintId) {
        Map<String, DeveloperUrgencyLoad> byName = new LinkedHashMap<>();
        try {
            List<UserTask> raw = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (raw == null) return byName;
            LinkedHashMap<String, UserTask> deduped = new LinkedHashMap<>();
            for (UserTask ut : raw) {
                if (ut == null || ut.getId() == null || ut.getTask() == null) continue;
                String key = ut.getId().getUserId() + ":" + ut.getId().getTaskId();
                deduped.putIfAbsent(key, ut);
            }
            LocalDateTime now = LocalDateTime.now();
            for (UserTask ut : deduped.values()) {
                Long uid = ut.getId() != null ? ut.getId().getUserId() : null;
                if (uid == null) continue;
                User u = ut.getUser();
                String name = (u != null && u.getName() != null && !u.getName().isBlank())
                    ? u.getName().trim()
                    : ("User " + uid);
                DeveloperUrgencyLoad d = byName.computeIfAbsent(name, k -> {
                    DeveloperUrgencyLoad x = new DeveloperUrgencyLoad();
                    x.name = k;
                    return x;
                });
                Task t = ut.getTask();
                if (isTaskDone(t)) {
                    d.completed++;
                    if (ut.getWorkedHours() != null) {
                        d.workedHours += ut.getWorkedHours();
                    }
                    continue;
                }
                d.open++;
                boolean hp = isHighPriorityTask(t);
                boolean dueS = isDueSoon(t, now);
                if (hp) {
                    d.highPriorityOpen++;
                }
                if (dueS) {
                    d.dueSoonOpen++;
                }
                if (hp || dueS) {
                    d.urgentPending++;
                }
                if (ut.getWorkedHours() != null) {
                    d.workedHours += ut.getWorkedHours();
                }
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] buildDeveloperUrgencyLoad: " + e.getMessage());
        }
        return byName;
    }

    /**
     * English prose appended to urgency-based workload {@code reason} (counts from DB task fields).
     */
    private static String formatUrgencyLoadPriorityAndDueSummary(DeveloperUrgencyLoad sender) {
        if (sender == null) {
            return "";
        }
        if (sender.highPriorityOpen > 0 && sender.dueSoonOpen > 0) {
            return String.format(
                " %s still has %d critical/high/urgent items open and %d with due dates in the next ~72 hours or overdue (some may overlap).",
                sender.name, sender.highPriorityOpen, sender.dueSoonOpen);
        }
        if (sender.highPriorityOpen > 0) {
            return String.format(
                " %s still has %d critical/high/urgent items open.",
                sender.name, sender.highPriorityOpen);
        }
        if (sender.dueSoonOpen > 0) {
            return String.format(
                " %s still has %d tasks due within ~72 hours or already overdue.",
                sender.name, sender.dueSoonOpen);
        }
        return "";
    }

    /** Short clause for actionable text: how urgent pending breaks down by priority vs due date. */
    private static String formatUrgencyLoadPriorityDueShort(DeveloperUrgencyLoad sender) {
        if (sender == null) {
            return "from sprint task data";
        }
        if (sender.highPriorityOpen > 0 && sender.dueSoonOpen > 0) {
            return String.format(
                "%d high-priority, %d near-due or overdue",
                sender.highPriorityOpen, sender.dueSoonOpen);
        }
        if (sender.highPriorityOpen > 0) {
            return String.format("%d high-priority", sender.highPriorityOpen);
        }
        if (sender.dueSoonOpen > 0) {
            return String.format("%d near-due or overdue", sender.dueSoonOpen);
        }
        return "from sprint task data";
    }

    private String statusKeyFromRecommendationText(String text) {
        if (text == null) return null;
        String t = text.toLowerCase();
        if (t.contains("to do") || t.contains("todo")) return "TODO";
        if (t.contains("in progress") || t.contains("in-process") || t.contains("in process")) return "IN_PROCESS";
        if (t.contains("in review")) return "IN_REVIEW";
        return null;
    }

    /**
     * Guardrail for redistribution precision:
     * - If status distribution is balanced (spread <= 1), avoid "move tasks from A to B" guidance.
     * - If unbalanced, rewrite recommendations using the actual most/least-loaded developers for that status.
     */
    private void refineWorkloadRedistributionRecommendations(ObjectNode root, Long sprintId) {
        try {
            ArrayNode actionable = ensureArrayField(root, "actionableRecommendations");
            JsonNode wlNode = root.get("workloadRecommendations");
            ArrayNode workloadRecs = (wlNode != null && wlNode.isArray())
                ? (ArrayNode) wlNode
                : mapper.createArrayNode();
            if (wlNode == null || !wlNode.isArray()) {
                root.set("workloadRecommendations", workloadRecs);
            }

            boolean hasWorkloadActionable = false;
            for (JsonNode n : actionable) {
                if (n.isObject() && "workload_redistribution".equalsIgnoreCase(n.path("category").asText(""))) {
                    hasWorkloadActionable = true;
                    break;
                }
            }
            boolean hasWorkloadArray = workloadRecs.size() > 0;
            if (!hasWorkloadActionable && !hasWorkloadArray) {
                return;
            }

            List<DeveloperStatusLoad> rows = new ArrayList<>(buildDeveloperStatusLoad(sprintId).values());
            if (rows.size() < 2) {
                return;
            }

            List<StatusSpread> candidates = new ArrayList<>();
            candidates.add(computeStatusSpread(rows, "TODO"));
            candidates.add(computeStatusSpread(rows, "IN_PROCESS"));
            candidates.add(computeStatusSpread(rows, "IN_REVIEW"));
            candidates = candidates.stream().filter(Objects::nonNull).collect(Collectors.toList());
            if (candidates.isEmpty()) {
                return;
            }
            Map<String, StatusSpread> spreadByStatus = candidates.stream()
                .collect(Collectors.toMap(c -> c.statusKey, c -> c, (a, b) -> a, LinkedHashMap::new));
            StatusSpread best = candidates.stream()
                .max(Comparator.comparingInt(c -> c.spread))
                .orElse(null);
            if (best == null) {
                return;
            }

            if (best.spread <= 1) {
                // Balanced distribution by status: avoid misleading move recommendations.
                for (JsonNode n : actionable) {
                    if (!n.isObject()) continue;
                    ObjectNode o = (ObjectNode) n;
                    if (!"workload_redistribution".equalsIgnoreCase(o.path("category").asText(""))) continue;
                    o.put("text",
                        "Current task status distribution is balanced across developers. Keep assignments stable and focus on unblocking tasks in In progress/In review.");
                    o.put("guardrailCorrected", true);
                }
                workloadRecs.removeAll();
                return;
            }

            int fromCount = statusValue(best.from, best.statusKey);
            int toCount = statusValue(best.to, best.statusKey);
            int tasksToMove = Math.max(1, best.spread / 2);

            for (JsonNode n : actionable) {
                if (!n.isObject()) continue;
                ObjectNode o = (ObjectNode) n;
                if (!"workload_redistribution".equalsIgnoreCase(o.path("category").asText(""))) continue;
                String recommendationText = o.path("text").asText("");
                String mentionedStatus = statusKeyFromRecommendationText(recommendationText);
                StatusSpread targetSpread = mentionedStatus != null
                    ? spreadByStatus.getOrDefault(mentionedStatus, best)
                    : best;
                int targetFrom = statusValue(targetSpread.from, targetSpread.statusKey);
                int targetTo = statusValue(targetSpread.to, targetSpread.statusKey);
                int targetMove = Math.max(1, targetSpread.spread / 2);
                if (targetSpread.spread <= 1) {
                    o.put(
                        "text",
                        String.format(
                            "Current %s distribution is balanced across developers. Keep assignments stable and focus on unblocking tasks in In progress/In review.",
                            targetSpread.statusLabel));
                    o.put("guardrailCorrected", true);
                    continue;
                }
                o.put(
                    "text",
                    String.format(
                        "Shift about %d task(s) toward %s: %s has %d in \"%s\" vs %s with %d — that stage is uneven even if total assignments match.",
                        targetMove,
                        targetSpread.to.name,
                        targetSpread.from.name,
                        targetFrom,
                        targetSpread.statusLabel,
                        targetSpread.to.name,
                        targetTo));
                o.put("guardrailCorrected", true);
            }

            if (workloadRecs.size() == 0) {
                ObjectNode o = mapper.createObjectNode();
                o.put("from", best.from.name);
                o.put("to", best.to.name);
                o.put("tasksToMove", tasksToMove);
                o.put("reason",
                    String.format(
                        "%s has %d in \"%s\" vs %s’s %d; shifting ~%d task(s) spreads that stage more evenly.",
                        best.from.name,
                        fromCount,
                        best.statusLabel,
                        best.to.name,
                        toCount,
                        tasksToMove));
                workloadRecs.add(o);
            } else {
                for (JsonNode n : workloadRecs) {
                    if (!n.isObject()) continue;
                    ObjectNode o = (ObjectNode) n;
                    o.put("from", best.from.name);
                    o.put("to", best.to.name);
                    o.put("tasksToMove", tasksToMove);
                    o.put(
                        "reason",
                        String.format(
                            "%s has %d in \"%s\" vs %s’s %d; shifting ~%d task(s) spreads that stage more evenly.",
                            best.from.name,
                            fromCount,
                            best.statusLabel,
                            best.to.name,
                            toCount,
                            tasksToMove));
                }
            }

            // Precision rule: only when it applies, suggest moving urgent work
            // from developers with zero completed tasks to developers with no open tasks.
            List<DeveloperUrgencyLoad> urg = new ArrayList<>(buildDeveloperUrgencyLoad(sprintId).values());
            long maxWorkedAcrossTeam = urg.stream().mapToLong(d -> d.workedHours).max().orElse(0L);
            DeveloperUrgencyLoad sender = urg.stream()
                .filter(d -> d.completed == 0 && d.urgentPending > 0)
                .max(Comparator.comparingInt((DeveloperUrgencyLoad d) -> d.urgentPending)
                    .thenComparingLong(d -> d.workedHours))
                .orElse(null);
            // Do not move work onto the teammate who already logged the most hours (e.g. finished all tasks
            // with heavy logging while others are idle for other reasons).
            DeveloperUrgencyLoad receiver = urg.stream()
                .filter(d -> d.open == 0 && d.completed > 0)
                .filter(d -> maxWorkedAcrossTeam == 0L || d.workedHours < maxWorkedAcrossTeam)
                .min(Comparator.comparingLong((DeveloperUrgencyLoad d) -> d.workedHours)
                    .thenComparingInt(d -> -d.completed))
                .orElse(null);
            if (sender != null && receiver != null && !Objects.equals(sender.name, receiver.name)) {
                int moveUrgent = Math.max(1, Math.min(2, sender.urgentPending));
                boolean hourGapMaterial = sender.workedHours >= receiver.workedHours + 4;
                String priorityDueShort = formatUrgencyLoadPriorityDueShort(sender);
                String priorityDueReason = formatUrgencyLoadPriorityAndDueSummary(sender);
                boolean rewritten = false;
                for (JsonNode n : actionable) {
                    if (!n.isObject()) continue;
                    ObjectNode o = (ObjectNode) n;
                    if (!"workload_redistribution".equalsIgnoreCase(o.path("category").asText(""))) continue;
                    o.put(
                        "text",
                        String.format(
                            "%s has %d urgent pending task(s) (%s); no completed tasks yet, and %d logged hour(s); %s currently has no open tasks and %d logged hour(s). Reassign ~%d urgent task(s) to balance delivery risk and effort load%s.",
                            sender.name,
                            sender.urgentPending,
                            priorityDueShort,
                            sender.workedHours,
                            receiver.name,
                            receiver.workedHours,
                            moveUrgent,
                            hourGapMaterial ? "" : " (hours are close, so prioritize skill fit)"));
                    o.put("guardrailCorrected", true);
                    rewritten = true;
                    break;
                }
                if (!rewritten && hourGapMaterial) {
                    ObjectNode add = mapper.createObjectNode();
                    add.put("category", "workload_redistribution");
                    add.put(
                        "text",
                        String.format(
                            "%s has %d urgent pending task(s) (%s); no completed tasks yet, and %d logged hour(s); %s currently has no open tasks and %d logged hour(s). Reassign ~%d urgent task(s) to balance delivery risk and effort load.",
                            sender.name,
                            sender.urgentPending,
                            priorityDueShort,
                            sender.workedHours,
                            receiver.name,
                            receiver.workedHours,
                            moveUrgent));
                    add.put("guardrailCorrected", true);
                    actionable.add(add);
                }
                if (workloadRecs.size() == 0) {
                    ObjectNode o = mapper.createObjectNode();
                    o.put("from", sender.name);
                    o.put("to", receiver.name);
                    o.put("tasksToMove", moveUrgent);
                    o.put(
                        "reason",
                        String.format(
                            "%s carries %d urgent pending task(s) with 0 completed and %d logged hour(s), while %s has no open tasks and %d logged hour(s).%s",
                            sender.name,
                            sender.urgentPending,
                            sender.workedHours,
                            receiver.name,
                            receiver.workedHours,
                            priorityDueReason));
                    workloadRecs.add(o);
                } else {
                    for (JsonNode n : workloadRecs) {
                        if (!n.isObject()) continue;
                        ObjectNode o = (ObjectNode) n;
                        o.put("from", sender.name);
                        o.put("to", receiver.name);
                        o.put("tasksToMove", moveUrgent);
                        o.put(
                            "reason",
                            String.format(
                                "%s carries %d urgent pending task(s) with 0 completed and %d logged hour(s), while %s has no open tasks and %d logged hour(s).%s",
                                sender.name,
                                sender.urgentPending,
                                sender.workedHours,
                                receiver.name,
                                receiver.workedHours,
                                priorityDueReason));
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] refineWorkloadRedistributionRecommendations: " + e.getMessage());
        }
    }

    private static String resolveSprintPhase(Sprint sprint) {
        if (sprint == null) {
            return "unknown";
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = sprint.getStartDate();
        LocalDateTime due = sprint.getDueDate();
        if (start == null || due == null) {
            return "unknown";
        }
        java.time.LocalDate today = now.toLocalDate();
        java.time.LocalDate startDay = start.toLocalDate();
        java.time.LocalDate dueDay = due.toLocalDate();
        if (today.isBefore(startDay)) {
            return "not_started";
        }
        if (today.isAfter(dueDay)) {
            return "ended";
        }
        return "in_progress";
    }

    private static boolean isSprintEarlyForProductivityGuide(Sprint sprint) {
        if (sprint == null) {
            return true;
        }
        String phase = resolveSprintPhase(sprint);
        if ("not_started".equals(phase)) {
            return true;
        }
        if ("ended".equals(phase)) {
            return false;
        }
        LocalDateTime start = sprint.getStartDate();
        LocalDateTime due = sprint.getDueDate();
        if (start == null || due == null) {
            return true;
        }
        java.time.LocalDate today = LocalDateTime.now().toLocalDate();
        java.time.LocalDate startDay = start.toLocalDate();
        java.time.LocalDate dueDay = due.toLocalDate();
        long daysTotal = java.time.temporal.ChronoUnit.DAYS.between(startDay, dueDay) + 1;
        long daysElapsed = java.time.temporal.ChronoUnit.DAYS.between(startDay, today) + 1;
        if (daysTotal < 1) {
            daysTotal = 1;
        }
        if (daysElapsed < 1) {
            daysElapsed = 1;
        }
        return daysElapsed <= 4L || ((double) daysElapsed / (double) daysTotal) <= 0.25;
    }

    private static String stripProductivityGuideInstructionEcho(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String out = text.trim();
        out = out.replaceAll("(?i),?\\s*matching the KPI card above\\s*\\([^)]*\\)\\.?", ".");
        out = out.replaceAll("(?i),?\\s*matching the KPI card above\\.?", ".");
        out = out.replaceAll("(?i)\\s*\\(completion\\s*40\\s*%[^)]*workload\\s*balance\\s*10\\s*%\\)\\.?", "");
        out = out.replaceAll("(?i)\\s*\\(completion\\s*×\\s*0\\.4[^)]*\\)\\.?", "");
        out = out.replaceAll("\\s{2,}", " ").replaceAll("\\.\\s*\\.", ".").trim();
        return out;
    }

    private static final Pattern PRODUCTIVITY_NEGATIVE_LABEL = Pattern.compile(
        "\\b(weak|poor|underperform|under-performing|dragging|mixed|behind|at risk|falling short|struggling)\\b",
        Pattern.CASE_INSENSITIVE);

    private static String softenProductivityGuidePerformanceLabels(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        return PRODUCTIVITY_NEGATIVE_LABEL.matcher(text).replaceAll("").replaceAll("\\s{2,}", " ").trim();
    }

    private static final Pattern PRODUCTIVITY_LOW_SCORE_EXCUSE_SENTENCE = Pattern.compile(
        ".*\\b(?:sprint\\s+has\\s+not\\s+started|sprint\\s+not\\s+started|not\\s+started\\s+yet|"
            + "just\\s+begun|only\\s+just\\s+begun|early\\s+snapshot|pre-execution|"
            + "low\\s+(?:value|score|figure|percentage)[^.]{0,120}(?:expected|normal|baseline)|"
            + "baseline\\s+from|does\\s+not\\s+mean|underperform|"
            + "little\\s+completed\\s+work|not\\s+poor\\s+delivery\\s+yet|"
            + "a\\s+low\\s+value\\s+is\\s+expected|few\\s+days\\s+in)\\b.*",
        Pattern.CASE_INSENSITIVE);

    /** Drops sentences that excuse a low productivityScore before the sprint is mature. */
    private static String stripProductivityLowScoreExcuses(String text, Sprint sprint) {
        if (text == null || text.isBlank()) {
            return text;
        }
        if (!"not_started".equals(resolveSprintPhase(sprint)) && !isSprintEarlyForProductivityGuide(sprint)) {
            return text;
        }
        String[] parts = text.split("(?<=[.!?])\\s+");
        if (parts.length <= 1) {
            return PRODUCTIVITY_LOW_SCORE_EXCUSE_SENTENCE.matcher(text).matches() ? "" : text;
        }
        StringBuilder kept = new StringBuilder();
        for (String part : parts) {
            String s = part.trim();
            if (s.isEmpty()) {
                continue;
            }
            if (!PRODUCTIVITY_LOW_SCORE_EXCUSE_SENTENCE.matcher(s).matches()) {
                if (kept.length() > 0) {
                    kept.append(' ');
                }
                kept.append(s);
            }
        }
        String out = kept.toString().trim();
        return out.isEmpty() ? text.trim() : out;
    }

    private static final Pattern PRODUCTIVITY_EVOLUTION_NOTE_ALREADY = Pattern.compile(
        "\\b(?:will\\s+update|will\\s+change|keeps?\\s+updating|continues?\\s+to\\s+update|"
            + "as\\s+the\\s+sprint\\s+(?:runs|progresses)|task\\s+(?:progress|updates?)|"
            + "once\\s+(?:the\\s+)?sprint\\s+begins|once\\s+work\\s+begins)\\b",
        Pattern.CASE_INSENSITIVE);

    private static String productivityEvolutionNote(Sprint sprint) {
        String phase = resolveSprintPhase(sprint);
        if ("not_started".equals(phase)) {
            return "It will update once the sprint begins and tasks move through statuses, "
                + "assignments, and logged hours feed the four KPIs.";
        }
        if (isSprintEarlyForProductivityGuide(sprint)) {
            return "It will keep updating as tasks progress and completion, on-time delivery, "
                + "participation, and workload balance change during the sprint.";
        }
        return "";
    }

    private static String appendProductivityEvolutionNote(String text, Sprint sprint) {
        if (text == null || text.isBlank()) {
            return productivityEvolutionNote(sprint);
        }
        String note = productivityEvolutionNote(sprint);
        if (note.isBlank()) {
            return text.trim();
        }
        String raw = text.trim();
        if (PRODUCTIVITY_EVOLUTION_NOTE_ALREADY.matcher(raw).find()) {
            return raw;
        }
        return raw + " " + note;
    }

    /** Align %% with KPI card; keep Gemini prose like other metrics (strip prompt echoes only). */
    private static String normalizeProductivityScoreGuideText(String existing, int scorePct, Sprint sprint) {
        int clamped = Math.min(100, Math.max(0, scorePct));
        if (existing == null || existing.isBlank()) {
            return appendProductivityEvolutionNote(
                String.format(
                    Locale.ROOT,
                    "The Productivity Score is %d%%, combining completion rate, on-time delivery, "
                        + "team participation, and workload balance into one indicator for overall sprint performance.",
                    clamped),
                sprint);
        }
        String out = stripProductivityGuideInstructionEcho(existing);
        out = stripProductivityLowScoreExcuses(out, sprint);
        if ("not_started".equals(resolveSprintPhase(sprint)) || isSprintEarlyForProductivityGuide(sprint)) {
            out = softenProductivityGuidePerformanceLabels(out);
        }
        out = replaceProductivityScoreMentionsInProse(out, clamped);
        return appendProductivityEvolutionNote(out, sprint);
    }

    private static final class AssignmentLoadSnap {
        final String name;
        final String nameLower;
        final int assignedRows;
        final int completed;
        final long assignedHours;
        final long workedHours;
        final boolean rosterOnly;

        AssignmentLoadSnap(String name, int assignedRows, int completed, long assignedHours, long workedHours,
            boolean rosterOnly) {
            this.name = name;
            this.nameLower = name.trim().toLowerCase(Locale.ROOT);
            this.assignedRows = assignedRows;
            this.completed = completed;
            this.assignedHours = assignedHours;
            this.workedHours = workedHours;
            this.rosterOnly = rosterOnly;
        }

        int pending() {
            return Math.max(0, assignedRows - completed);
        }
    }

    /**
     * Ensures workload balance redistribution and overload flags exist from assignment data,
     * including before the sprint starts (planned load only).
     */
    private void ensureWorkloadGuidanceFromAssignments(ObjectNode root, Long sprintId, Sprint sprint) {
        try {
            JsonNode wl = mapper.readTree(buildTeamWorkloadJson(sprintId));
            if (wl == null || !wl.isArray() || wl.size() < 2) {
                return;
            }
            List<AssignmentLoadSnap> snaps = new ArrayList<>();
            for (JsonNode row : wl) {
                if (row == null || !row.isObject()) {
                    continue;
                }
                String name = row.path("developerName").asText("").trim();
                if (name.isEmpty()) {
                    continue;
                }
                boolean rosterOnly = row.path("fromSprintRosterOnly").asBoolean(false)
                    || row.path("fromProjectTeamOnly").asBoolean(false);
                snaps.add(new AssignmentLoadSnap(
                    name,
                    row.path("assignedTaskRows").asInt(0),
                    row.path("completedTasks").asInt(0),
                    row.path("assignedHoursSum").asLong(0),
                    row.path("workedHoursSum").asLong(0),
                    rosterOnly));
            }
            List<AssignmentLoadSnap> active = snaps.stream()
                .filter(s -> !s.rosterOnly)
                .collect(Collectors.toList());
            List<AssignmentLoadSnap> withWork = active.stream()
                .filter(s -> s.assignedRows > 0)
                .collect(Collectors.toList());
            if (withWork.size() < 2) {
                return;
            }

            String phase = resolveSprintPhase(sprint);
            boolean notStarted = "not_started".equals(phase);
            double wb = sprint != null && sprint.getWorkloadBalance() != null
                ? toPercent(sprint.getWorkloadBalance()) : -1.0;

            double avgRows = withWork.stream().mapToInt(s -> s.assignedRows).average().orElse(0.0);
            double avgHours = withWork.stream().mapToLong(s -> s.assignedHours).average().orElse(0.0);
            AssignmentLoadSnap heaviest = withWork.stream()
                .max(Comparator.comparingLong((AssignmentLoadSnap s) -> s.assignedHours)
                    .thenComparingInt(s -> s.assignedRows))
                .orElse(null);
            AssignmentLoadSnap lightest = withWork.stream()
                .min(Comparator.comparingLong((AssignmentLoadSnap s) -> s.assignedHours)
                    .thenComparingInt(s -> s.assignedRows))
                .orElse(null);
            if (heaviest == null || lightest == null || heaviest.nameLower.equals(lightest.nameLower)) {
                return;
            }

            int spreadRows = heaviest.assignedRows - lightest.assignedRows;
            boolean imbalancedByKpi = wb >= 0.0 && wb < 70.0;
            boolean imbalancedByRows = spreadRows >= 2;
            boolean imbalancedByHours = heaviest.assignedHours >= lightest.assignedHours + 8L
                && (avgHours <= 0.0 || heaviest.assignedHours >= avgHours * 1.35);
            if (!imbalancedByKpi && !imbalancedByRows && !imbalancedByHours) {
                return;
            }

            int tasksToMove = Math.max(1, spreadRows / 2);
            String planningPrefix = notStarted
                ? "Sprint has not started yet; planned assignments are uneven — "
                : "";

            ArrayNode workloadRecs = ensureArrayField(root, "workloadRecommendations");
            if (workloadRecs.size() == 0) {
                ObjectNode rec = mapper.createObjectNode();
                rec.put("from", heaviest.name);
                rec.put("to", lightest.name);
                rec.put("tasksToMove", tasksToMove);
                rec.put(
                    "reason",
                    String.format(
                        "%s%s has %d planned assignment row(s) (~%d estimated hour(s)) vs %s with %d row(s) (~%d hour(s)); "
                            + "moving ~%d task(s) before execution spreads load more evenly.",
                        planningPrefix,
                        heaviest.name,
                        heaviest.assignedRows,
                        heaviest.assignedHours,
                        lightest.name,
                        lightest.assignedRows,
                        lightest.assignedHours,
                        tasksToMove));
                rec.put("assignmentGuidanceEnriched", true);
                workloadRecs.add(rec);
            }

            ArrayNode actionable = ensureArrayField(root, "actionableRecommendations");
            boolean hasWorkloadActionable = false;
            for (JsonNode n : actionable) {
                if (n.isObject()
                    && "workload_redistribution".equalsIgnoreCase(n.path("category").asText(""))) {
                    hasWorkloadActionable = true;
                    break;
                }
            }
            if (!hasWorkloadActionable) {
                ObjectNode add = mapper.createObjectNode();
                add.put("category", "workload_redistribution");
                add.put(
                    "text",
                    String.format(
                        "%sRebalance ~%d task(s) from %s to %s: %d planned assignment row(s) vs %d on the lighter side.",
                        planningPrefix,
                        tasksToMove,
                        heaviest.name,
                        lightest.name,
                        heaviest.assignedRows,
                        lightest.assignedRows));
                add.put("assignmentGuidanceEnriched", true);
                actionable.add(add);
            }

            ArrayNode devInsights = ensureArrayField(root, "developerInsights");
            for (AssignmentLoadSnap s : withWork) {
                if (s.pending() < 1) {
                    continue;
                }
                boolean overloaded;
                if (notStarted) {
                    if (withWork.size() <= 2) {
                        overloaded = s.nameLower.equals(heaviest.nameLower) && spreadRows >= 2;
                    } else {
                        overloaded = (avgRows > 0.0 && s.assignedRows >= avgRows * 1.4)
                            || (avgHours > 0.0 && s.assignedHours >= avgHours * 1.35);
                    }
                } else {
                    overloaded = (avgRows > 0.0 && s.assignedRows >= avgRows * 1.4)
                        || (avgHours > 0.0 && s.assignedHours >= avgHours * 1.35)
                        || (avgHours > 0.0 && s.workedHours >= avgHours * 1.4 && s.workedHours >= 8L);
                }
                if (!overloaded) {
                    continue;
                }
                AssignmentLoadSnap receiver = withWork.stream()
                    .filter(p -> !p.nameLower.equals(s.nameLower))
                    .min(Comparator.comparingLong((AssignmentLoadSnap p) -> p.assignedHours)
                        .thenComparingInt(p -> p.assignedRows))
                    .orElse(lightest);
                int suggestMove = Math.max(
                    1,
                    Math.max(spreadRows, s.assignedRows - receiver.assignedRows) / 2);
                ObjectNode insightRow = findOrCreateDeveloperInsight(devInsights, s.name);
                insightRow.put("overloaded", true);
                insightRow.put("assignmentGuidanceEnriched", true);
                insightRow.put("suggestedMoveTo", receiver.name);
                insightRow.put("suggestedTasksToMove", suggestMove);
                String note = notStarted
                    ? String.format(
                        "Planned load before sprint start: %d assignment row(s), ~%d estimated hour(s) "
                            + "(team averages ~%.0f rows, ~%.0f hours) — consider moving ~%d task(s) to %s "
                            + "(%d planned row(s), ~%d estimated hour(s)).",
                        s.assignedRows,
                        s.assignedHours,
                        avgRows,
                        avgHours,
                        suggestMove,
                        receiver.name,
                        receiver.assignedRows,
                        receiver.assignedHours)
                    : String.format(
                        "Carrying more than peers: %d open assignment row(s), ~%d estimated hour(s), "
                            + "%d logged hour(s) — consider moving ~%d task(s) to %s "
                            + "(%d planned row(s), ~%d estimated hour(s)).",
                        s.pending(),
                        s.assignedHours,
                        s.workedHours,
                        suggestMove,
                        receiver.name,
                        receiver.assignedRows,
                        receiver.assignedHours);
                insightRow.put("insight", note);
            }

            if (imbalancedByKpi) {
                JsonNode guideNode = root.get("kpiManagerGuide");
                if (guideNode != null && guideNode.isObject()) {
                    ObjectNode guide = (ObjectNode) guideNode;
                    JsonNode byMetricNode = guide.get("byMetric");
                    ObjectNode byMetric = byMetricNode != null && byMetricNode.isObject()
                        ? (ObjectNode) byMetricNode
                        : mapper.createObjectNode();
                    String wbText = notStarted
                        ? String.format(
                            "Workload balance is at %.0f%% — planned task assignments are uneven across the team. "
                                + "Rebalance assignments before the sprint starts.",
                            wb)
                        : String.format(
                            "Workload balance is at %.0f%% — task assignments are uneven; consider redistributing work.",
                            wb);
                    byMetric.put("workloadBalance", wbText);
                    guide.set("byMetric", byMetric);
                }
            }
        } catch (Exception e) {
            System.err.println("[GeminiService] ensureWorkloadGuidanceFromAssignments: " + e.getMessage());
        }
    }

    private ObjectNode findOrCreateDeveloperInsight(ArrayNode dev, String developerName) {
        String key = developerName.trim().toLowerCase(Locale.ROOT);
        for (JsonNode item : dev) {
            if (item != null && item.isObject()) {
                String dn = item.path("developerName").asText("").trim().toLowerCase(Locale.ROOT);
                if (dn.equals(key)) {
                    return (ObjectNode) item;
                }
            }
        }
        ObjectNode o = mapper.createObjectNode();
        o.put("developerName", developerName.trim());
        o.put("overloaded", false);
        dev.add(o);
        return o;
    }

    private void suppressComparativeTrendsForFirstSprint(ObjectNode root, Long sprintId) {
        if (!isFirstSprintInProject(sprintId)) {
            return;
        }
        JsonNode esNode = root.get("executiveSummary");
        if (esNode != null && esNode.isObject()) {
            ObjectNode es = (ObjectNode) esNode;
            if (es.has("trends")) {
                es.remove("trends");
            }
        }
    }

    private boolean isFirstSprintInProject(Long sprintId) {
        try {
            Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
            if (sprint == null || sprint.getAssignedProject() == null || sprint.getAssignedProject().getId() == null) {
                return false;
            }
            Long projectId = sprint.getAssignedProject().getId();
            List<Sprint> all = sprintRepository.findByAssignedProjectIdOrderByStartDateAsc(projectId);
            if (all == null || all.isEmpty()) {
                return false;
            }
            Sprint first = all.get(0);
            return first != null && first.getId() != null && first.getId().equals(sprintId);
        } catch (Exception e) {
            return false;
        }
    }

    private void enrichExecutiveSummaryIfSparse(ObjectNode root) {
        String summary = root.path("summary").asText("").trim();
        JsonNode esNode = root.get("executiveSummary");
        ObjectNode es;
        if (esNode != null && esNode.isObject()) {
            es = (ObjectNode) esNode;
        } else {
            es = mapper.createObjectNode();
            root.set("executiveSummary", es);
        }
        boolean overviewBlank = es.path("overview").asText("").trim().isEmpty();
        boolean trendsBlank = es.path("trends").asText("").trim().isEmpty();
        boolean impBlank = es.path("improvementAreas").asText("").trim().isEmpty();
        boolean nextBlank = es.path("nextSteps").asText("").trim().isEmpty();
        boolean allBlank = overviewBlank && trendsBlank && impBlank && nextBlank;

        if (allBlank) {
            if (!summary.isEmpty()) {
                es.put("overview", summary);
                es.put("trends", "Compare this sprint with prior sprints in KPI Analytics to see directional changes.");
                es.put("improvementAreas",
                    "Use alerts and recommendations above for the highest-impact focus areas.");
                es.put("nextSteps",
                    "Review workload and near-due tasks with the team; regenerate insights after major updates.");
            } else {
                es.put("overview", "KPI snapshot is available; detailed narrative fields were not returned by the model.");
                es.put("trends", "Open KPI Analytics and the sprint task board to complement this summary.");
                es.put("improvementAreas", "Align scope, assignments, and deadlines based on current metrics.");
                es.put("nextSteps", "Regenerate insights or update task data to refresh this section.");
            }
        } else if (overviewBlank && !summary.isEmpty()) {
            es.put("overview", summary);
        }
    }

    /**
     * Strips a prior canonical task-status lead so re-enrichment does not duplicate it.
     */
    private static String stripCanonicalTaskStatusLead(String overview) {
        if (overview == null) {
            return "";
        }
        return CANONICAL_TASK_STATUS_OVERVIEW_LEAD.matcher(overview.trim()).replaceFirst("").trim();
    }

    private static String buildCanonicalTaskStatusOverviewLead(Map<String, Long> canonical) {
        long todo = canonical.getOrDefault("TODO", 0L);
        long inProcess = canonical.getOrDefault("IN_PROCESS", 0L);
        long inReview = canonical.getOrDefault("IN_REVIEW", 0L);
        long done = canonical.getOrDefault("DONE", 0L);
        long unknown = canonical.getOrDefault("UNKNOWN", 0L);
        StringBuilder b = new StringBuilder();
        b.append("Task status in this sprint: ")
            .append(todo).append(" To do, ")
            .append(inProcess).append(" In progress, ")
            .append(inReview).append(" In review, ")
            .append(done).append(" Done.");
        if (unknown > 0) {
            b.append(" ").append(unknown).append(" task(s) use other or unknown statuses.");
        }
        return b.toString();
    }

    /**
     * Live blocked assignments for this sprint (refreshed on every GET enrich). AI Insights UI shows this list;
     * assignee is the developer who reported the block on that assignment.
     */
    private void injectBlockedAssignmentsSnapshot(ObjectNode root, Long sprintId) throws Exception {
        JsonNode blocked = mapper.readTree(buildBlockedUserTaskReportsJson(sprintId));
        if (blocked != null && blocked.isArray()) {
            root.set("blockedAssignments", blocked);
        } else {
            root.set("blockedAssignments", mapper.createArrayNode());
        }
    }

    /**
     * Aligns severities with prompt rules: high scores on "higher is better" KPIs are not warnings;
     * when {@code blockedAssignments} is non-empty, blocker-themed alerts are {@code warning}, not info.
     */
    private void normalizeAlertSeverities(ObjectNode root) {
        JsonNode alertsNode = root.get("alerts");
        if (alertsNode == null || !alertsNode.isArray()) {
            return;
        }
        int blockedCount = 0;
        JsonNode blockedArr = root.get("blockedAssignments");
        if (blockedArr != null && blockedArr.isArray()) {
            blockedCount = blockedArr.size();
        }
        ArrayNode alerts = (ArrayNode) alertsNode;
        for (int i = 0; i < alerts.size(); i++) {
            JsonNode item = alerts.get(i);
            if (item == null || !item.isObject()) {
                continue;
            }
            ObjectNode o = (ObjectNode) item;
            String kpiRaw = o.path("kpi").isTextual() ? o.get("kpi").asText("").trim() : "";
            String kpi = kpiRaw.toLowerCase(Locale.ROOT).replace("_", "");
            if (o.has("value") && o.get("value").isNumber()) {
                double v = o.get("value").asDouble();
                if ("teamparticipation".equals(kpi)
                    || "completionrate".equals(kpi)
                    || "ontimedelivery".equals(kpi)
                    || "productivityscore".equals(kpi)) {
                    if (v >= 60.0) {
                        o.put("severity", "info");
                    }
                } else if ("workloadbalance".equals(kpi) && v >= 70.0) {
                    o.put("severity", "info");
                }
            }
        }
        // Blocker-themed alerts are warnings when the sprint snapshot still has blocked assignments; apply last so it wins.
        if (blockedCount <= 0) {
            return;
        }
        for (int i = 0; i < alerts.size(); i++) {
            JsonNode item = alerts.get(i);
            if (item == null || !item.isObject()) {
                continue;
            }
            ObjectNode o = (ObjectNode) item;
            String kpiRaw = o.path("kpi").isTextual() ? o.get("kpi").asText("").trim() : "";
            String kpi = kpiRaw.toLowerCase(Locale.ROOT).replace("_", "");
            String message = o.path("message").isTextual() ? o.get("message").asText("") : "";
            boolean kpiIsBlocker = kpi.contains("block");
            boolean messageMentionsBlocker = ALERT_BLOCKER_LEXEMES.matcher(message).find();
            if (kpiIsBlocker) {
                o.put("severity", "warning");
                o.remove("value");
            } else if (kpiRaw.isEmpty() && messageMentionsBlocker) {
                o.put("severity", "warning");
                o.put("kpi", "blockers");
                o.remove("value");
            } else if (messageMentionsBlocker) {
                o.put("severity", "warning");
            }
        }
    }

    /**
     * Drops alerts that claim uneven workload when the sprint KPI is already balanced (&gt;= 70).
     * Gemini sometimes contradicts the numeric workloadBalance score (e.g. 98% + "uneven distribution").
     */
    private void removeContradictoryWorkloadBalanceAlerts(ObjectNode root, Long sprintId) {
        JsonNode alertsNode = root.get("alerts");
        if (alertsNode == null || !alertsNode.isArray()) {
            return;
        }
        double sprintWb = -1.0;
        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
        if (sprint != null && sprint.getWorkloadBalance() != null) {
            sprintWb = toPercent(sprint.getWorkloadBalance());
        }
        ArrayNode in = (ArrayNode) alertsNode;
        ArrayNode out = mapper.createArrayNode();
        for (int i = 0; i < in.size(); i++) {
            JsonNode item = in.get(i);
            if (item == null || !item.isObject()) {
                continue;
            }
            ObjectNode o = (ObjectNode) item;
            String kpiRaw = o.path("kpi").isTextual() ? o.get("kpi").asText("").trim() : "";
            String kpi = kpiRaw.toLowerCase(Locale.ROOT).replace("_", "");
            double alertVal = o.has("value") && o.get("value").isNumber()
                ? o.get("value").asDouble()
                : sprintWb;
            double effectiveWb = Math.max(sprintWb, alertVal);
            String message = o.path("message").isTextual() ? o.get("message").asText("") : "";
            boolean workloadKpi = "workloadbalance".equals(kpi);
            boolean unevenProse = ALERT_WORKLOAD_UNEVEN_LEXEMES.matcher(message).find();
            boolean mentionsWorkloadBalance = message.toLowerCase(Locale.ROOT).contains("workload balance")
                || message.toLowerCase(Locale.ROOT).contains("workload distribution")
                || message.toLowerCase(Locale.ROOT).contains("balance del trabajo")
                || message.toLowerCase(Locale.ROOT).contains("carga de trabajo");
            if (effectiveWb >= 70.0) {
                if (workloadKpi) {
                    continue;
                }
                if (unevenProse && (mentionsWorkloadBalance || workloadKpi)) {
                    continue;
                }
            }
            out.add(item);
        }
        root.set("alerts", out);
    }

    /**
     * Rewrites kpiManagerGuide.byMetric.workloadBalance when the sprint score is high but Gemini
     * claims uneven assignment or uneven execution (common confusion with completion pace).
     */
    private void normalizeKpiManagerGuideWorkloadBalance(ObjectNode root, Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
        if (sprint == null || sprint.getWorkloadBalance() == null) {
            return;
        }
        double wb = toPercent(sprint.getWorkloadBalance());
        if (wb < 70.0) {
            return;
        }
        JsonNode guideNode = root.get("kpiManagerGuide");
        if (guideNode == null || !guideNode.isObject()) {
            return;
        }
        ObjectNode guide = (ObjectNode) guideNode;
        JsonNode byMetricNode = guide.get("byMetric");
        ObjectNode byMetric;
        if (byMetricNode == null || !byMetricNode.isObject()) {
            byMetric = mapper.createObjectNode();
            guide.set("byMetric", byMetric);
        } else {
            byMetric = (ObjectNode) byMetricNode;
        }
        String existing = byMetric.path("workloadBalance").asText("");
        if (existing.isBlank()
            || ALERT_WORKLOAD_UNEVEN_LEXEMES.matcher(existing).find()
            || existing.toLowerCase(Locale.ROOT).contains("not being executed evenly")
            || existing.toLowerCase(Locale.ROOT).contains("not executed evenly")) {
            byMetric.put("workloadBalance", buildBalancedWorkloadGuideText(wb));
        }
    }

    private static String buildBalancedWorkloadGuideText(double wb) {
        int pct = (int) Math.round(Math.min(100.0, Math.max(0.0, wb)));
        return String.format(
            Locale.ROOT,
            "At %d%%, task assignments are well balanced across developers with work in this sprint. "
                + "This KPI measures how evenly tasks are distributed, not how fast each person completes them — "
                + "use completion rate or developer insights if execution pace differs between teammates.",
            pct);
    }

    /**
     * Overwrites stale Gemini productivity decimals (e.g. 67.9) with the canonical composite score
     * from sprint KPI fields — same formula as the Productivity Score KPI card.
     */
    private void normalizeKpiManagerGuideProductivityScore(ObjectNode root, Long sprintId) {
        Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
        if (sprint == null) {
            return;
        }
        int ps = (int) Math.round(computeProductivityScore(sprint));
        JsonNode guideNode = root.get("kpiManagerGuide");
        if (guideNode == null || !guideNode.isObject()) {
            return;
        }
        ObjectNode guide = (ObjectNode) guideNode;
        JsonNode byMetricNode = guide.get("byMetric");
        ObjectNode byMetric;
        if (byMetricNode == null || !byMetricNode.isObject()) {
            byMetric = mapper.createObjectNode();
            guide.set("byMetric", byMetric);
        } else {
            byMetric = (ObjectNode) byMetricNode;
        }
        String existing = byMetric.path("productivityScore").asText("");
        byMetric.put("productivityScore", normalizeProductivityScoreGuideText(existing, ps, sprint));
        String intro = guide.path("intro").asText("");
        if (!intro.isBlank() && PRODUCTIVITY_SCORE_IN_INTRO.matcher(intro).find()) {
            guide.put("intro", replaceProductivityScoreMentionsInProse(intro, ps));
        }
    }

    private static final Pattern PRODUCTIVITY_SCORE_IN_INTRO = Pattern.compile(
        "productiv|composite\\s+score|weighted\\s+(?:kpi|score)",
        Pattern.CASE_INSENSITIVE);

    private static String replaceProductivityScoreMentionsInProse(String text, int scorePct) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String display = scorePct + "%";
        String out = text.replaceAll(
            "(?i)(productivity\\s*score[^0-9]{0,48}?)-?\\d+(?:\\.\\d+)?\\s*(?:%|points?)?",
            "$1" + display);
        out = out.replaceAll("(?i)^\\s*At\\s+-?\\d+(?:\\.\\d+)?\\s*%", "At " + display);
        out = out.replaceAll(
            "(?i)(composite[^0-9]{0,40}?)-?\\d+(?:\\.\\d+)?\\s*%?",
            "$1" + display);
        return out;
    }

    /**
     * Adds {@code taskStatusBreakdown} from DB counts and forces the executive overview to open with
     * the same canonical sentence (idempotent on repeated GET enrich).
     */
    private void injectTaskStatusBreakdownAndOverviewLead(ObjectNode root, Long sprintId) {
        Map<String, Long> c = getCanonicalTaskStatusCounts(sprintId);
        ObjectNode breakdown = mapper.createObjectNode();
        long todo = c.getOrDefault("TODO", 0L);
        long inProcess = c.getOrDefault("IN_PROCESS", 0L);
        long inReview = c.getOrDefault("IN_REVIEW", 0L);
        long done = c.getOrDefault("DONE", 0L);
        long unknown = c.getOrDefault("UNKNOWN", 0L);
        long total = todo + inProcess + inReview + done + unknown;
        breakdown.put("toDo", todo);
        breakdown.put("inProgress", inProcess);
        breakdown.put("inReview", inReview);
        breakdown.put("done", done);
        breakdown.put("unknown", unknown);
        breakdown.put("total", total);
        root.set("taskStatusBreakdown", breakdown);

        JsonNode esNode = root.get("executiveSummary");
        ObjectNode es;
        if (esNode != null && esNode.isObject()) {
            es = (ObjectNode) esNode;
        } else {
            es = mapper.createObjectNode();
            root.set("executiveSummary", es);
        }
        String lead = buildCanonicalTaskStatusOverviewLead(c);
        String existing = es.path("overview").asText("").trim();
        String remainder = stripCanonicalTaskStatusLead(existing);
        if (remainder.isEmpty()) {
            es.put("overview", lead);
        } else {
            es.put("overview", lead + " " + remainder);
        }
    }

    /** Replaces DB-style status tokens in user-facing prose (e.g. IN_REVIEW → In review). */
    static String prettifyWorkflowStatusTokens(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        String t = text;
        t = t.replaceAll("(?i)\\bIN_REVIEW\\b", "In review");
        t = t.replaceAll("(?i)\\bIN_PROGRESS\\b", "In progress");
        t = t.replaceAll("(?i)\\bIN_PROCESS\\b", "In progress");
        t = t.replaceAll("(?i)\\bin_review\\b", "In review");
        t = t.replaceAll("(?i)\\bin_progress\\b", "In progress");
        t = t.replaceAll("(?i)\\bin_process\\b", "In progress");
        t = t.replaceAll("(?i)\\bto_do\\b", "To do");
        t = t.replaceAll("(?i)\\bTODO\\b", "To do");
        t = t.replaceAll("(?i)\\bDONE\\b", "Done");
        t = t.replaceAll("(?i)\\bPENDING\\b", "Pending");
        return t;
    }

    private void prettifyHumanProseInInsights(JsonNode node) {
        if (node == null) {
            return;
        }
        if (node.isObject()) {
            ObjectNode o = (ObjectNode) node;
            List<String> keys = new ArrayList<>();
            o.fieldNames().forEachRemaining(keys::add);
            for (String k : keys) {
                JsonNode v = o.get(k);
                if (v == null) {
                    continue;
                }
                if (v.isTextual() && !PRETTIFY_SKIP_KEYS.contains(k)) {
                    o.put(k, prettifyWorkflowStatusTokens(v.asText()));
                } else if (v.isObject()) {
                    prettifyHumanProseInInsights(v);
                } else if (v.isArray()) {
                    for (JsonNode el : v) {
                        prettifyHumanProseInInsights(el);
                    }
                }
            }
        } else if (node.isArray()) {
            for (JsonNode el : node) {
                prettifyHumanProseInInsights(el);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private double toPercent(BigDecimal value) {
        if (value == null) return 0.0;
        // KPI sources are mixed in this project: some persist ratios [0..1], others store percentages [0..100].
        // Normalize both formats into the same 0..100 scale used by KPI cards in the frontend.
        double raw = value.doubleValue();
        double normalized = Math.abs(raw) <= 1.0 ? raw * 100.0 : raw;
        double clamped = Math.max(0.0, Math.min(100.0, normalized));
        return BigDecimal.valueOf(clamped)
            .setScale(0, RoundingMode.HALF_UP)
            .doubleValue();
    }

    private double computeProductivityScore(Sprint s) {
        double cr  = toPercent(s.getCompletionRate());
        double otd = toPercent(s.getOnTimeDelivery());
        double tp  = toPercent(s.getTeamParticipation());
        double wb  = toPercent(s.getWorkloadBalance());
        double score = (cr * 0.4) + (otd * 0.3) + (tp * 0.2) + (wb * 0.1);
        return Math.max(0.0, Math.min(100.0, Math.round(score)));
    }

    private JsonNode buildDeveloperVariationFallback(List<Map<String, Object>> sprintSnapshots) {
        ObjectNode root = mapper.createObjectNode();
        ArrayNode taskRows = mapper.createArrayNode();
        ArrayNode hourRows = mapper.createArrayNode();
        ArrayNode productivityRows = mapper.createArrayNode();
        root.set("tasks", taskRows);
        root.set("hours", hourRows);
        root.set("productivity", productivityRows);
        if (sprintSnapshots == null || sprintSnapshots.size() < 2) {
            return root;
        }

        List<Map<String, Object>> snapshots = sprintSnapshots.stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        if (snapshots.size() < 2) {
            return root;
        }
        Map<String, Object> first = snapshots.get(0);
        Map<String, Object> last = snapshots.get(snapshots.size() - 1);
        String firstLabel = String.valueOf(first.getOrDefault("shortLabel", "first sprint"));
        String lastLabel = String.valueOf(last.getOrDefault("shortLabel", "last sprint"));
        Map<String, Map<String, Object>> firstByName = mapDevelopersByName(first.get("developers"));
        Map<String, Map<String, Object>> lastByName = mapDevelopersByName(last.get("developers"));
        List<Map<String, Object>> lastBlockedReports = readBlockedReportsFromSnapshot(last);

        Set<String> names = new LinkedHashSet<>();
        for (Map<String, Object> snap : snapshots) {
            names.addAll(mapDevelopersByName(snap.get("developers")).keySet());
        }

        for (String name : names) {
            Map<String, Object> firstDev = firstByName.get(name);
            Map<String, Object> lastDev = lastByName.get(name);
            int firstAssigned = asInt(firstDev != null ? firstDev.get("assigned") : null);
            int lastAssigned = asInt(lastDev != null ? lastDev.get("assigned") : null);
            int firstCompleted = asInt(firstDev != null ? firstDev.get("completed") : null);
            int lastCompleted = asInt(lastDev != null ? lastDev.get("completed") : null);
            double firstHours = asDouble(firstDev != null ? firstDev.get("hours") : null);
            double lastHours = asDouble(lastDev != null ? lastDev.get("hours") : null);
            double firstRate = firstCompleted / Math.max(0.1, firstHours);
            double lastRate = lastCompleted / Math.max(0.1, lastHours);

            int deltaTasks = lastCompleted - firstCompleted;
            double deltaHours = BigDecimal.valueOf(lastHours - firstHours)
                .setScale(1, RoundingMode.HALF_UP).doubleValue();
            double deltaProductivity = BigDecimal.valueOf(lastRate - firstRate)
                .setScale(2, RoundingMode.HALF_UP).doubleValue();

            int minCompleted = Integer.MAX_VALUE;
            int maxCompleted = Integer.MIN_VALUE;
            double minHours = Double.POSITIVE_INFINITY;
            double maxHours = Double.NEGATIVE_INFINITY;
            double minRate = Double.POSITIVE_INFINITY;
            double maxRate = Double.NEGATIVE_INFINITY;
            for (Map<String, Object> snap : snapshots) {
                Map<String, Object> dev = mapDevelopersByName(snap.get("developers")).get(name);
                int c = asInt(dev != null ? dev.get("completed") : null);
                double h = asDouble(dev != null ? dev.get("hours") : null);
                double r = c / Math.max(0.1, h);
                minCompleted = Math.min(minCompleted, c);
                maxCompleted = Math.max(maxCompleted, c);
                minHours = Math.min(minHours, h);
                maxHours = Math.max(maxHours, h);
                minRate = Math.min(minRate, r);
                maxRate = Math.max(maxRate, r);
            }

            ObjectNode t = mapper.createObjectNode();
            t.put("developerName", name);
            t.put("delta", deltaTasks);
            String blockSuffix = blockerSuffixForDeveloper(name, lastBlockedReports);
            t.put("message", String.format(
                "%s: completion outcome moved from %d/%d done in %s to %d/%d in %s "
                    + "(range across selected sprints: %d-%d done). Variation is interpreted primarily from delivery outcomes.",
                name, firstCompleted, Math.max(firstAssigned, 0), firstLabel,
                lastCompleted, Math.max(lastAssigned, 0), lastLabel, minCompleted, maxCompleted)
                + blockSuffix);
            taskRows.add(t);

            ObjectNode h = mapper.createObjectNode();
            h.put("developerName", name);
            h.put("delta", deltaHours);
            String hoursPerformanceContext;
            if (lastCompleted > firstCompleted && lastHours <= firstHours) {
                hoursPerformanceContext = "better delivery efficiency";
            } else if (lastCompleted < firstCompleted && lastHours >= firstHours) {
                hoursPerformanceContext = "weaker delivery efficiency";
            } else {
                hoursPerformanceContext = "mixed delivery signal";
            }
            h.put("message", String.format(
                "%s: worked hours moved from %.1f in %s to %.1f in %s (range across selected sprints: %.1f-%.1f), "
                    + "with %s based on completed outcomes (%d -> %d done tasks).",
                name, firstHours, firstLabel, lastHours, lastLabel, minHours, maxHours,
                hoursPerformanceContext, firstCompleted, lastCompleted)
                + blockSuffix);
            if (lastCompleted > 0 && lastHours <= 0) {
                h.put("message", h.path("message").asText()
                    + " Data warning: completed tasks with zero logged hours indicate missing hour tracking.");
            }
            hourRows.add(h);

            ObjectNode p = mapper.createObjectNode();
            p.put("developerName", name);
            p.put("delta", deltaProductivity);
            String trendText = deltaProductivity > 0
                ? "improved"
                : deltaProductivity < 0
                    ? "decreased"
                    : "stayed stable";
            p.put("message", String.format(
                "%s: productivity (completed tasks/hour) %s from %.2f in %s to %.2f in %s "
                    + "(range across selected sprints: %.2f-%.2f). Assessment is based on completion efficiency, "
                    + "not on task creation/assignment volume changes.",
                name, trendText, firstRate, firstLabel, lastRate, lastLabel, minRate, maxRate)
                + blockSuffix);
            if (lastCompleted > 0 && lastHours <= 0) {
                p.put("message", p.path("message").asText()
                    + " Data warning: zero logged hours can inflate efficiency and must be validated.");
            }
            productivityRows.add(p);
        }
        return root;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> readBlockedReportsFromSnapshot(Map<String, Object> snap) {
        if (snap == null) {
            return List.of();
        }
        Object raw = snap.get("blockedReports");
        if (!(raw instanceof List<?>)) {
            return List.of();
        }
        List<?> list = (List<?>) raw;
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof Map<?, ?>)) {
                continue;
            }
            out.add((Map<String, Object>) o);
        }
        return out;
    }

    private String blockerSuffixForDeveloper(String name, List<Map<String, Object>> blocks) {
        if (name == null || blocks == null || blocks.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> b : blocks) {
            Object repObj = b.get("reportedByDeveloperName");
            String rep = repObj != null ? String.valueOf(repObj).trim() : "";
            if (!name.equals(rep)) {
                continue;
            }
            Object tid = b.get("taskId");
            Object titleObj = b.get("taskTitle");
            String title = titleObj != null ? String.valueOf(titleObj).trim() : "";
            Object reasonObj = b.get("blockedReason");
            String reason = reasonObj != null ? String.valueOf(reasonObj).trim() : "";
            sb.append(" Blocked (reported by assignee): ");
            sb.append(title.isEmpty() ? ("task " + tid) : title);
            if (!reason.isEmpty()) {
                sb.append(" — ").append(reason);
            }
            sb.append(".");
        }
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Map<String, Object>> mapDevelopersByName(Object developersRaw) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        if (!(developersRaw instanceof List<?>)) {
            return out;
        }
        List<?> list = (List<?>) developersRaw;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> row = (Map<?, ?>) item;
            Object nameObj = row.get("name");
            String name = nameObj != null ? String.valueOf(nameObj).trim() : "";
            if (name.isEmpty()) {
                continue;
            }
            out.put(name, (Map<String, Object>) row);
        }
        return out;
    }

    private int asInt(Object v) {
        if (v == null) return 0;
        try {
            return (int) Math.round(Double.parseDouble(String.valueOf(v)));
        } catch (Exception e) {
            return 0;
        }
    }

    private double asDouble(Object v) {
        if (v == null) return 0.0;
        try {
            return Double.parseDouble(String.valueOf(v));
        } catch (Exception e) {
            return 0.0;
        }
    }
}