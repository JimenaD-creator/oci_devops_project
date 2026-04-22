package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.SprintInsight;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserSprint;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
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
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class GeminiService {

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private static final String GEMINI_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent";

    /** Matches DB-injected (or model-following) task-status lead; used to avoid duplicating on re-enrich. */
    private static final Pattern CANONICAL_TASK_STATUS_OVERVIEW_LEAD = Pattern.compile(
        "^(?i)Task status in this sprint:\\s*\\d+\\s+To do,\\s*\\d+\\s+In progress,\\s*\\d+\\s+In review,\\s*\\d+\\s+Done\\."
            + "(\\s*\\d+\\s+task\\(s\\)\\s+use other or unknown statuses\\.)?\\s*");

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
            + "- each sprint has: id, shortLabel, developers[]\n"
            + "- each developer has: name, assigned, completed, hours, assignedHoursEstimate\n\n"
            + "Required output schema:\n"
            + "{\"tasks\":[{\"developerName\":\"...\",\"delta\":2,\"message\":\"...\"}],"
            + "\"hours\":[{\"developerName\":\"...\",\"delta\":1.5,\"message\":\"...\"}],"
            + "\"productivity\":[{\"developerName\":\"...\",\"delta\":0.42,\"message\":\"...\"}]}\n\n"
            + "Rules:\n"
            + "- Use all selected sprints in input order. Compare first vs last, and also consider variation across intermediate sprints.\n"
            + "- Include one row per developer seen in any sprint (missing values treated as 0).\n"
            + "- tasks[].delta = last.completed - first.completed (integer).\n"
            + "- hours[].delta = last.hours - first.hours (number, 1 decimal).\n"
            + "- productivity[].delta = (last.completed/max(last.hours,0.1)) - (first.completed/max(first.hours,0.1)) rounded to 2 decimals.\n"
            + "- productivity message must explain whether efficiency (tasks per hour) improved, worsened, or remained stable.\n"
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

    /**
     * Per-developer aggregates: USER_TASK + TASK for the sprint, plus USER_SPRINT roster members
     * who have no assignment rows (common when the UI shows sprint members but USER_TASK was not synced).
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
                long workedHours;
                long assignedHours;
                boolean fromSprintRosterOnly;
                final List<Map<String, Object>> taskSamples = new ArrayList<>();
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
                String st = t.getStatus();
                if (st != null && "DONE".equalsIgnoreCase(st.trim())) {
                    a.completedTasks++;
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
                row.put("workedHoursSum", a.workedHours);
                row.put("assignedHoursSum", a.assignedHours);
                row.put("taskSamples", a.taskSamples);
                row.put("fromSprintRosterOnly", a.fromSprintRosterOnly);
                out.add(row);
            }
            return mapper.writeValueAsString(out);
        } catch (Exception e) {
            System.err.println("[GeminiService] buildTeamWorkloadJson: " + e.getMessage());
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
            "- All human-readable strings (messages, summaries, insights, predictions) MUST be in English.\n\n" +
            "## Current Sprint (ID: " + currentSprint.getId() + ")\n" +
            String.format(
                "{\"sprintId\":%d,\"completionRate\":%.1f,\"onTimeDelivery\":%.1f," +
                "\"teamParticipation\":%.1f,\"workloadBalance\":%.1f,\"productivityScore\":%.1f}\n\n",
                currentSprint.getId(), cr, otd, tp, wb, ps) +
            "## Sprint timeline (live snapshot; phase is authoritative for whether the sprint has ended)\n" +
            timelineJson + "\n\n" +
            "## Task counts by status (this sprint only)\n" +
            taskStatusJson + "\n\n" +
            "## Canonical status totals (use these exact counts in recommendations)\n" +
            String.format(
                "TODO=%d, IN_PROCESS=%d, IN_REVIEW=%d, DONE=%d, UNKNOWN=%d\n\n",
                todoCount, inProcessCount, inReviewCount, doneCount, unknownCount
            ) +
            "## Historical Data (previous sprints, most recent first)\n" +
            historyJson + "\n\n" +
            "## Team workload (USER_TASK + TASK; developerName from data; fromSprintRosterOnly=true means on USER_SPRINT roster but no USER_TASK rows — still include them in developerInsights)\n" +
            teamWorkloadJson + "\n\n" +
            "## Context\n" +
            "- KPI scale: 0-100 (100 = perfect)\n" +
            "- productivityScore = (completionRate x 0.4) + (onTimeDelivery x 0.3) + (teamParticipation x 0.2) + (workloadBalance x 0.1)\n" +
            "- workloadBalance < 70 means task distribution is uneven across developers\n" +
            "- Task status workflow is strictly: To do → In progress → In review → Done (same order as DB buckets TODO, IN_PROCESS, IN_REVIEW, DONE).\n" +
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
            "\"developerInsights\":[{\"developerName\":\"Carlos\",\"insight\":\"Completed all tasks on time. Strong performance.\"}]," +
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
            "- Mid-sprint: If Sprint timeline.phase is in_progress or not_started, KPIs are a partial snapshot — still produce substantive output. Use severity 'info' for neutral early observations (e.g. pace vs time remaining, scope vs done count). Do not leave executiveSummary fields blank, omit developerInsights when team workload is non-empty, or return empty actionableRecommendations solely because the sprint has not ended or scores are low.\n" +
            "- In all narrative strings (alerts, recommendations, predictions, summaries, developer insights), "
            + "refer to task statuses in plain English with title-style words: \"To do\", \"In progress\", \"In review\", \"Done\". "
            + "Never write TODO, IN_REVIEW, IN_PROCESS, DONE, or snake_case status tokens in user-facing text. "
            + "Counts must still match the integers in \"Canonical status totals\".\n" +
            "- alerts: severity exactly 'critical' (KPI < 40 or dropped 20+ pts in 2+ sprints), 'warning' (KPI < 60), or 'info' (useful positives or context without urgency). Use [] if none.\n" +
            "- actionableRecommendations: 3-8 items when useful; if phase is in_progress or not_started and (task counts show any tasks OR team workload is non-empty), include at least 2 items grounded in Task counts by status, taskSamples, or KPIs. category must be one of: workload_redistribution, estimates, planning, training, blockers. Use [] only when there is truly no task or team data.\n" +
            "  Examples: workload_redistribution → move tasks between people to balance load; estimates → tasks taking much longer than team average; planning → adjust next sprint scope/story points for on-time delivery; training → developer needs support in a skill (infer from task titles/classification when possible); blockers → cite taskId from taskSamples when a task is stalled or blocked.\n" +
            "- executiveSummary: all four fields non-empty strings in English (use KPIs, history, task status counts, and timeline phase; if data is thin, still give concise coaching text — for in_progress, mention remaining time and current pace).\n" +
            "- executiveSummary.overview MUST start with exactly one sentence of the form: \"Task status in this sprint: <n> To do, <n> In progress, <n> In review, <n> Done.\" using the integers from \"Canonical status totals\" above (no estimates). If the unknown count is greater than 0, append: \" <n> task(s) use other or unknown statuses.\" Then continue with narrative after that sentence.\n" +
            "- developerInsights: one object per developer in Team workload JSON (including fromSprintRosterOnly=true); compare assignedTaskRows and workedHoursSum to team averages; for roster-only rows, note they are on the sprint but have no USER_TASK assignment rows in DB. If Team workload is [], set developerInsights to [].\n" +
            "  When completedTasks is 0 for everyone, still return one developerInsights entry per person in Team workload with concise English (workload vs peers, assigned hours/rows, roster-only, or that DB shows no Done tasks yet). Do not omit developers solely because completions are zero.\n" +
            "- predictions: all three string fields in English, grounded in the KPIs/trends and Task counts by status; for in_progress sprints, frame outlook/risks/delivery as conditional on remaining time (not only post-mortem). productivityOutlook may cite score trajectory; risks should mention blockers or delivery gaps when relevant; deliveryEstimate compares pace to plan.\n" +
            "- workloadRecommendations: only if workloadBalance < 70; else [].\n" +
            "- productivityPrediction.predictedScore: integer 0-100; trend: 'up', 'down', or 'stable'; reasoning in English.\n" +
            "- kpiManagerGuide: required for managers. intro: one clear English sentence summarizing how the sprint KPIs read together. " +
            "byMetric must include exactly these five string keys: completionRate, onTimeDelivery, teamParticipation, workloadBalance, productivityScore — " +
            "each 1-2 sentences interpreting the current percentages from \"Current Sprint\" above (reference approximate values); explain practical implications for delivery and team load, not textbook definitions alone.\n" +
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
            JsonNode normalized = camelCaseKeysDeep(insights);
            if (!normalized.isObject()) {
                return insights;
            }
            ObjectNode root = (ObjectNode) normalized;
            normalizeDeveloperInsightRows(root);
            normalizeActionableRecommendationRows(root);
            enrichDeveloperInsightsIfEmpty(root, sprintId);
            Sprint sprint = sprintRepository.findById(sprintId).orElse(null);
            enrichActionableRecommendationsIfEmpty(root, sprint);
            normalizeActionableRecommendationCounts(root, sprintId);
            suppressComparativeTrendsForFirstSprint(root, sprintId);
            enrichExecutiveSummaryIfSparse(root);
            injectTaskStatusBreakdownAndOverviewLead(root, sprintId);
            prettifyHumanProseInInsights(root);
            return root;
        } catch (Exception e) {
            System.err.println("[GeminiService] enrichInsightsForResponse: " + e.getMessage());
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
        node.fields().forEachRemaining(e -> {
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
                insight = "On the sprint roster in the database, but no USER_TASK rows for this sprint — "
                    + "if this person should have assignments, sync task assignees.";
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
            dev.add(o);
        }
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

        Set<String> names = new LinkedHashSet<>();
        for (Map<String, Object> snap : snapshots) {
            names.addAll(mapDevelopersByName(snap.get("developers")).keySet());
        }

        for (String name : names) {
            Map<String, Object> firstDev = firstByName.get(name);
            Map<String, Object> lastDev = lastByName.get(name);
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
            t.put("message", String.format(
                "%s: completed tasks moved from %d in %s to %d in %s (range across selected sprints: %d-%d).",
                name, firstCompleted, firstLabel, lastCompleted, lastLabel, minCompleted, maxCompleted));
            taskRows.add(t);

            ObjectNode h = mapper.createObjectNode();
            h.put("developerName", name);
            h.put("delta", deltaHours);
            h.put("message", String.format(
                "%s: worked hours moved from %.1f in %s to %.1f in %s (range across selected sprints: %.1f-%.1f).",
                name, firstHours, firstLabel, lastHours, lastLabel, minHours, maxHours));
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
                "%s: productivity (%s tasks/hour) %s from %.2f in %s to %.2f in %s (range across selected sprints: %.2f-%.2f).",
                name, "completed", trendText, firstRate, firstLabel, lastRate, lastLabel, minRate, maxRate));
            productivityRows.add(p);
        }
        return root;
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