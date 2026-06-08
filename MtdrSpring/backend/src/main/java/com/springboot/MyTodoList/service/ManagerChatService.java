package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.config.GeminiApiConfiguration;
import com.springboot.MyTodoList.dto.SimilarSprintInsightMatch;
import com.springboot.MyTodoList.model.*;
import com.springboot.MyTodoList.repository.*;
import com.springboot.MyTodoList.util.GeminiInsightKpiAlignUtil;
import com.springboot.MyTodoList.util.ManagerChatInsightContextUtil;
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
    @Autowired private SprintInsightRepository sprintInsightRepository;
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
            Long effectiveSprintId = req.getSprintId();
            if (effectiveSprintId == null && mentionsThisSprint(req.getMessage())) {
                List<Sprint> ordered =
                    sprintRepository.findByAssignedProjectIdOrderByStartDateAsc(req.getProjectId());
                effectiveSprintId = resolveFocalSprintId(ordered);
            }

            String contextJson = buildProjectContext(req.getProjectId(), effectiveSprintId);
            String scope = effectiveSprintId != null
                ? "sprint_" + effectiveSprintId
                : "all_sprints";
            boolean sprintScopeInferred = req.getSprintId() == null && effectiveSprintId != null;
            Long targetSprintId = effectiveSprintId != null ? effectiveSprintId : resolveTargetSprintId(req);
            Map<String, Integer> liveKpis = targetSprintId != null
                ? getLiveKpiSnapshotForSprint(targetSprintId)
                : null;

            Long focalSprintId = effectiveSprintId != null ? effectiveSprintId : targetSprintId;
            if (focalSprintId == null && mentionsSimilarPatterns(req.getMessage())) {
                List<Sprint> ordered =
                    sprintRepository.findByAssignedProjectIdOrderByStartDateAsc(req.getProjectId());
                focalSprintId = resolveFocalSprintId(ordered);
            }
            String ragContext = buildRagContext(
                req.getMessage(), req.getProjectId(), effectiveSprintId, focalSprintId);
            String scopeLabel = resolveSprintLabel(req.getProjectId(), effectiveSprintId);
            String systemPrompt = buildSystemPrompt(
                contextJson, ragContext, scope, scopeLabel, sprintScopeInferred);
            String reply = callGemini(systemPrompt, req.getMessage(), req.getHistory());
            int productivityDelta = 0;
            String previousLabel = null;
            if (effectiveSprintId != null) {
                productivityDelta =
                    productivityDeltaVsPreviousSprint(req.getProjectId(), effectiveSprintId);
                Map<Long, String> sprintLabels = buildSprintLabelMap(req.getProjectId());
                Map<String, Object> vsPrevious =
                    buildProductivityVsPreviousSprint(req.getProjectId(), effectiveSprintId, sprintLabels);
                if (vsPrevious != null) {
                    Object prev = vsPrevious.get("previousSprintLabel");
                    if (prev != null && !String.valueOf(prev).isBlank()) {
                        previousLabel = String.valueOf(prev);
                    }
                }
            }
            List<String> validLabels = effectiveSprintId != null
                ? new ArrayList<>(buildSprintLabelMap(req.getProjectId()).values())
                : List.of();
            reply = ManagerChatReplyUtil.polishManagerChatReply(
                reply,
                liveKpis,
                productivityDelta,
                scopeLabel,
                previousLabel,
                validLabels,
                effectiveSprintId);
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

    private String buildRagContext(String query, Long projectId, Long sprintId, Long focalSprintId) {
        StringBuilder sb = new StringBuilder();
        try {
            List<TaskEmbedding> relevantTasks = embeddingService.findRelevantTasks(query, sprintId, 8);
            if (relevantTasks.isEmpty()) {
                sb.append("No indexed tasks found — using full project data below.\n");
            } else {
                sb.append("Top relevant tasks retrieved by semantic search:\n");
                for (TaskEmbedding te : relevantTasks) {
                    sb.append("- ").append(te.getTextoChunk()).append("\n");
                }
            }
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildRagContext tasks error: " + e.getMessage());
            sb.append("Task vector search unavailable.\n");
        }

        if (projectId != null && sprintId == null) {
            try {
                List<SprintInsightEmbedding> relevantInsights =
                    embeddingService.findRelevantSprintInsights(query, projectId, 4);
                if (!relevantInsights.isEmpty()) {
                    Map<Long, String> labels = buildSprintLabelMap(projectId);
                    sb.append("\nTop relevant sprint AI insights (semantic search):\n");
                    for (SprintInsightEmbedding ie : relevantInsights) {
                        String label = labels.getOrDefault(ie.getSprintId(), "Sprint");
                        sb.append("- ").append(label).append(": ")
                            .append(ie.getTextChunk()).append("\n");
                    }
                }
            } catch (Exception e) {
                System.err.println("[ManagerChatService] buildRagContext insights error: " + e.getMessage());
            }
        }

        if (projectId != null && focalSprintId != null
                && (mentionsSimilarPatterns(query) || sprintId != null)) {
            String similar = buildSimilarSprintPatternsContext(projectId, focalSprintId);
            if (!similar.isBlank()) {
                if (sb.length() > 0) {
                    sb.append("\n\n");
                }
                sb.append(similar);
            }
        }

        return sb.toString().trim();
    }

    private String buildSimilarSprintPatternsContext(Long projectId, Long focalSprintId) {
        try {
            List<SimilarSprintInsightMatch> matches = embeddingService.findSimilarSprintInsights(
                focalSprintId, 5, EmbeddingService.DEFAULT_INSIGHT_SIMILARITY_THRESHOLD);
            if (matches.isEmpty()) {
                return "Similar sprint patterns: no close matches found for this sprint yet "
                    + "(generate AI insights on at least one other sprint in the project).";
            }
            Map<Long, String> labels = buildSprintLabelMap(projectId);
            String focalLabel = labels.getOrDefault(focalSprintId, "the selected sprint");
            StringBuilder sb = new StringBuilder();
            sb.append("Similar sprint patterns (same project, compared to ").append(focalLabel).append("):\n");
            for (SimilarSprintInsightMatch match : matches) {
                String label = labels.getOrDefault(match.getSprintId(), "a prior sprint");
                int matchPct = (int) Math.round(match.getSimilarity() * 100);
                sb.append("- ").append(label).append(" (~").append(matchPct).append("% pattern match)");
                if (match.getTopAlertSeverity() != null && !match.getTopAlertSeverity().isBlank()) {
                    sb.append(", top alert: ").append(match.getTopAlertSeverity());
                }
                if (match.getSnippet() != null && !match.getSnippet().isBlank()) {
                    sb.append(" — ").append(match.getSnippet());
                }
                sb.append("\n");
            }
            sb.append(
                "Use this list when the manager asks about recurring problems, past precedents, "
                    + "or sprints with similar delivery/workload issues. Refer to sprints by label, not database id.");
            return sb.toString();
        } catch (Exception e) {
            System.err.println("[ManagerChatService] buildSimilarSprintPatternsContext: " + e.getMessage());
            return "";
        }
    }

    private List<Sprint> orderedProjectSprints(Long projectId) {
        if (projectId == null) {
            return List.of();
        }
        return sprintRepository.findByAssignedProjectIdOrderByStartDateAsc(projectId);
    }

    private Map<Long, Integer> buildSprintNumberMap(Long projectId) {
        Map<Long, Integer> numbers = new LinkedHashMap<>();
        int index = 0;
        for (Sprint sprint : orderedProjectSprints(projectId)) {
            if (sprint.getId() == null) {
                continue;
            }
            numbers.put(sprint.getId(), index);
            index++;
        }
        return numbers;
    }

    private Map<Long, String> buildSprintLabelMap(Long projectId) {
        Map<Long, String> labels = new LinkedHashMap<>();
        for (Map.Entry<Long, Integer> entry : buildSprintNumberMap(projectId).entrySet()) {
            labels.put(entry.getKey(), "Sprint " + entry.getValue());
        }
        return labels;
    }

    private String resolveSprintLabel(Long projectId, Long sprintId) {
        if (projectId == null || sprintId == null) {
            return null;
        }
        return buildSprintLabelMap(projectId).get(sprintId);
    }

    private Map<String, Object> computeLiveKpisMapForSprint(Long sprintId) {
        if (sprintId == null) {
            return Map.of();
        }
        return sprintRepository.findById(sprintId)
            .map(s -> {
                List<Task> sprintTasks = taskRepository.findByAssignedSprintId(sprintId);
                List<UserTask> sprintUserTasks =
                    userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
                return SprintLiveKpiUtil.computeLiveKpis(s, sprintTasks, sprintUserTasks);
            })
            .orElse(Map.of());
    }

    private int productivityDeltaVsPreviousSprint(Long projectId, Long sprintId) {
        List<Sprint> ordered = orderedProjectSprints(projectId);
        int idx = indexOfSprintId(ordered, sprintId);
        if (idx <= 0) {
            return 0;
        }
        Long previousId = ordered.get(idx - 1).getId();
        if (previousId == null) {
            return 0;
        }
        int currentScore = GeminiInsightKpiAlignUtil.intMetric(
            computeLiveKpisMapForSprint(sprintId), "productivityScore");
        int previousScore = GeminiInsightKpiAlignUtil.intMetric(
            computeLiveKpisMapForSprint(previousId), "productivityScore");
        return currentScore - previousScore;
    }

    private Map<String, Object> buildProductivityVsPreviousSprint(
            Long projectId, Long sprintId, Map<Long, String> sprintLabels) {
        List<Sprint> ordered = orderedProjectSprints(projectId);
        int idx = indexOfSprintId(ordered, sprintId);
        if (idx <= 0) {
            return null;
        }
        Long previousId = ordered.get(idx - 1).getId();
        if (previousId == null) {
            return null;
        }
        int currentScore = GeminiInsightKpiAlignUtil.intMetric(
            computeLiveKpisMapForSprint(sprintId), "productivityScore");
        int previousScore = GeminiInsightKpiAlignUtil.intMetric(
            computeLiveKpisMapForSprint(previousId), "productivityScore");
        int delta = currentScore - previousScore;
        Map<String, Object> comparison = new LinkedHashMap<>();
        comparison.put("previousSprintLabel", sprintLabels.getOrDefault(previousId, "the previous sprint"));
        comparison.put("currentProductivityScore", currentScore);
        comparison.put("previousProductivityScore", previousScore);
        comparison.put("signedDeltaPoints", delta);
        comparison.put("deltaPoints", Math.abs(delta));
        comparison.put("direction", delta >= 0 ? "increased" : "decreased");
        return comparison;
    }

    private String resolvePreviousSprintLabel(Long projectId, Long sprintId, Map<Long, String> sprintLabels) {
        List<Sprint> ordered = orderedProjectSprints(projectId);
        int idx = indexOfSprintId(ordered, sprintId);
        if (idx <= 0) {
            return null;
        }
        Long previousId = ordered.get(idx - 1).getId();
        return previousId == null ? null : sprintLabels.get(previousId);
    }

    private int indexOfSprintId(List<Sprint> ordered, Long sprintId) {
        if (ordered == null || sprintId == null) {
            return -1;
        }
        for (int i = 0; i < ordered.size(); i++) {
            Sprint sprint = ordered.get(i);
            if (sprint.getId() != null && sprint.getId().equals(sprintId)) {
                return i;
            }
        }
        return -1;
    }

    private boolean mentionsSimilarPatterns(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        String lower = message.toLowerCase(Locale.ROOT);
        return lower.contains("similar")
                || lower.contains("parecid")
                || lower.contains("pattern")
                || lower.contains("patron")
                || lower.contains("patrón")
                || lower.contains("recurring")
                || lower.contains("repeat")
                || lower.contains("precedent")
                || lower.contains("before")
                || lower.contains("past sprint")
                || lower.contains("previous sprint")
                || lower.contains("sprint anterior")
                || lower.contains("otro sprint")
                || lower.contains("hemos visto")
                || lower.contains("have we seen")
                || lower.contains("same problem")
                || lower.contains("mismo problema");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONTEXT BUILDER
    // ─────────────────────────────────────────────────────────────────────────

    private String buildProjectContext(Long projectId, Long sprintId) throws Exception {
        List<Sprint> sprints;
        Map<Long, SprintInsight> insightBySprintId = new HashMap<>();
        Map<Long, Integer> sprintNumbers = buildSprintNumberMap(projectId);
        Map<Long, String> sprintLabels = buildSprintLabelMap(projectId);
        if (sprintId != null) {
            sprints = sprintRepository.findById(sprintId)
                .map(List::of)
                .orElse(List.of());
            sprintInsightRepository.findBySprintId(sprintId)
                .ifPresent(insight -> insightBySprintId.put(sprintId, insight));
        } else {
            sprints = orderedProjectSprints(projectId);
            for (SprintInsight insight : sprintInsightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId)) {
                if (insight.getSprintId() != null) {
                    insightBySprintId.putIfAbsent(insight.getSprintId(), insight);
                }
            }
        }

        List<Map<String, Object>> sprintData = new ArrayList<>();
        List<Map<String, Object>> allDevRows = new ArrayList<>();
        for (Sprint s : sprints) {
            int sprintNumber = sprintNumbers.getOrDefault(s.getId(), 0);
            String sprintLabel = sprintLabels.getOrDefault(s.getId(), "Sprint " + sprintNumber);
            Map<String, Object> sd = new LinkedHashMap<>();
            sd.put("sprintNumber", sprintNumber);
            sd.put("sprintLabel", sprintLabel);
            sd.put("startDate", s.getStartDate() != null ? s.getStartDate().toString() : null);
            sd.put("dueDate", s.getDueDate() != null ? s.getDueDate().toString() : null);
            sd.put("goal", s.getGoal());

            List<UserTask> sprintUserTasks = userTaskRepository.findBySprintIdWithUserAndTask(s.getId());
            List<Task> sprintTasks = taskRepository.findByAssignedSprintId(s.getId());
            Map<String, Object> liveKpis = SprintLiveKpiUtil.computeLiveKpis(s, sprintTasks, sprintUserTasks);
            sd.put("kpis", liveKpis);
            sd.put("completionRate", liveKpis.get("completionRate"));
            sd.put("onTimeDelivery", liveKpis.get("onTimeDelivery"));
            sd.put("efficiencyScore", liveKpis.get("efficiencyScore"));
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

            sd.put("blockedTasks", buildBlockedAssignmentsForSprint(s.getId()));

            SprintInsight sprintInsight = insightBySprintId.get(s.getId());
            Map<String, Object> sprintAnalysis =
                ManagerChatInsightContextUtil.compactInsightForChat(sprintInsight, mapper);
            String previousLabelForSprint = resolvePreviousSprintLabel(projectId, s.getId(), sprintLabels);
            List<String> allValidLabels = new ArrayList<>(sprintLabels.values());
            ManagerChatInsightContextUtil.sanitizeSprintLabelsInInsightMap(
                sprintAnalysis, sprintLabel, s.getId(), previousLabelForSprint, allValidLabels);
            sd.put("sprintAnalysis", sprintAnalysis);

            sprintData.add(sd);
        }

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("asOf", LocalDateTime.now().toString());
        context.put("totalSprintsInProject", sprintLabels.size());
        context.put("validSprintLabels", new ArrayList<>(sprintLabels.values()));
        context.put("sprintCount", sprintData.size());
        context.put("sprints", sprintData);
        if (sprintId != null) {
            context.put("managerScope", "single_sprint");
            String answerLabel = sprintLabels.getOrDefault(sprintId, "the selected sprint");
            context.put("answerAboutSprintLabel", answerLabel);
            context.put("activeSprintLabel", answerLabel);
            Integer seqNum = sprintNumbers.get(sprintId);
            if (seqNum != null) {
                context.put("sequentialSprintNumber", seqNum);
            }
            Map<String, Object> vsPrevious = buildProductivityVsPreviousSprint(projectId, sprintId, sprintLabels);
            if (vsPrevious != null) {
                context.put("productivityVsPreviousSprint", vsPrevious);
            }
        }
        if (sprintId == null && sprintData.size() > 1) {
            context.put(
                    "developersAllSprints",
                    SprintDeveloperMetricsUtil.mergeDeveloperRowsByUserId(allDevRows));
            context.put(
                    "developerPerformanceHistory",
                    ManagerChatInsightContextUtil.buildDeveloperPerformanceHistory(sprintData));
        } else if (sprintData.size() == 1) {
            context.put(
                    "developerPerformanceHistory",
                    ManagerChatInsightContextUtil.buildDeveloperPerformanceHistory(sprintData));
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

    private String buildSystemPrompt(
            String contextJson, String ragContext, String scope, String scopeLabel, boolean sprintScopeInferred) {
        String scopeDesc;
        if (scope.startsWith("sprint_") && scopeLabel != null && !scopeLabel.isBlank()) {
            scopeDesc = sprintScopeInferred
                ? scopeLabel + " only (inferred as the current/active sprint from \"this sprint\" in the question)"
                : scopeLabel + " only (manager selected this sprint in the chat dropdown)";
        } else if (scope.startsWith("sprint_")) {
            scopeDesc = "the selected sprint only";
        } else {
            scopeDesc = "all sprints in the project";
        }

        return "You are a helpful project management assistant for a software development team. "
            + "You have access to real-time project data and answer questions from the project manager.\n\n"
            + "## Your behavior\n"
            + "- Answer concisely and directly. Use plain English.\n"
            + "- When the manager asks for counts, lists, or comparisons, use the exact numbers from the data.\n"
            + "- For KPI questions (completion rate, on-time delivery, team participation, workload balance, "
            + "productivity score), always use each sprint's live kpis object — these match KPI Analytics and the "
            + "dashboard. Never use stale numbers from sprintAnalysis (AI notes may be outdated). "
            + "Never mention discrepancies between sprintAnalysis and live KPIs — state only the live KPI value.\n"
            + "- When managerScope is single_sprint or answerAboutSprintLabel is present, \"this sprint\" and "
            + "\"current sprint\" mean answerAboutSprintLabel / activeSprintLabel only — do not answer about other sprints unless asked "
            + "to compare.\n"
            + "- CRITICAL: sequentialSprintNumber and answerAboutSprintLabel are the ONLY valid sprint name for the current answer "
            + "(e.g. the label in answerAboutSprintLabel). validSprintLabels lists all sprints in this project. Never write \"Sprint N\" where N is not in "
            + "validSprintLabels. Never use internal row ids as sprint numbers.\n"
            + "- Only use sprint labels listed in validSprintLabels. This project has totalSprintsInProject sprints; "
            + "never invent a sprint number that is not in validSprintLabels.\n"
            + "- When the manager says Sprint N, use the sprint whose sprintNumber is N (not any internal id).\n"
            + "- Always refer to sprints by sprintLabel (e.g. Sprint 3), never by internal database ids.\n"
            + "- If a question cannot be answered from the data provided, say so clearly.\n"
            + "- For developer-specific questions, refer to them by name.\n"
            + "- In each sprint's developers array, completed is the count of unique tasks where that developer's "
            + "assignment is finished (same as the dashboard Completed Tasks chart). "
            + "pending = assigned minus completed.\n"
            + "- For hours worked per developer, use developers[].workedHours only. When scope is all sprints, use "
            + "developersAllSprints if present.\n"
            + "- Productivity score formula: completion×0.4 + on-time×0.3 + efficiency×0.2 + workload×0.1.\n"
            + "- When productivityVsPreviousSprint is present, use its deltaPoints and direction for "
            + "comparisons vs the previous sprint — this is current live score minus previous live score "
            + "(absolute points, not relative %). Never copy stale numbers from sprintAnalysis.trends.\n"
            + "- Use bullet points or short tables when listing multiple items.\n"
            + "- Never make up data. If a value is null or missing, say it's not recorded.\n"
            + "- Each sprint may include blockedTasks (who is stuck and why). Use for blocker and delivery-risk questions.\n"
            + "- Each sprint may include sprintAnalysis (AI-generated notes): summary, alerts, recommendations, "
            + "developerNotes. Use for trends, coaching, and recommendations. If sprintAnalysis.available is false, "
            + "say AI insights were not generated yet for that sprint.\n"
            + "- developerPerformanceHistory merges developer notes with live metrics across sprints — use for "
            + "how a developer performed over time.\n"
            + "- When asked how to improve team productivity, combine live KPIs, sprintAnalysis recommendations and "
            + "alerts, blockedTasks, and developerPerformanceHistory. Ground advice in this data.\n"
            + "- The vector-search section may include \"Similar sprint patterns\" — use it when the manager asks "
            + "about recurring issues, precedents, or sprints that resembled the current one. Explain what was "
            + "similar (alerts, workload, delivery risk) and what the team could learn, in plain language.\n"
            + "- Write for a manager: plain language only. Never mention JSON field names, database columns, "
            + "camelCase identifiers, or backtick-wrapped technical terms in your reply.\n"
            + "- Keep responses under 300 words unless more detail is specifically requested.\n"
            + "- Respond in the same language the manager uses (Spanish or English).\n\n"
            + "- Any percentage you mention must stay between 0% and 100%.\n\n"
            + "## Current data scope: " + scopeDesc + "\n\n"
            + "## Most relevant tasks and sprint insights (vector search)\n"
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

    private Map<String, Integer> getLiveKpiSnapshotForSprint(Long sprintId) {
        if (sprintId == null) {
            return Map.of();
        }
        return sprintRepository.findById(sprintId)
            .map(s -> {
                List<Task> sprintTasks = taskRepository.findByAssignedSprintId(sprintId);
                List<UserTask> sprintUserTasks =
                        userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
                Map<String, Object> kpis =
                        SprintLiveKpiUtil.computeLiveKpis(s, sprintTasks, sprintUserTasks);
                Map<String, Integer> out = new LinkedHashMap<>();
                putRoundedKpi(out, "productivityScore", kpis.get("productivityScore"));
                putRoundedKpi(out, "completionRate", kpis.get("completionRate"));
                putRoundedKpi(out, "onTimeDelivery", kpis.get("onTimeDelivery"));
                putRoundedKpi(out, "workloadBalance", kpis.get("workloadBalance"));
                return out;
            })
            .orElse(Map.of());
    }

    private void putRoundedKpi(Map<String, Integer> target, String key, Object value) {
        if (value instanceof Number) {
            target.put(key, ((Number) value).intValue());
        }
    }

    private Long resolveTargetSprintId(ManagerChatRequest req) {
        if (req == null || req.getProjectId() == null) {
            return null;
        }
        if (req.getSprintId() != null) {
            return req.getSprintId();
        }

        List<Sprint> projectSprints =
                sprintRepository.findByAssignedProjectIdOrderByStartDateAsc(req.getProjectId());
        Long fromLabel = resolveSprintNumberFromMessage(req.getMessage(), projectSprints);
        if (fromLabel != null) {
            return fromLabel;
        }
        if (mentionsFocalSprint(req.getMessage())) {
            return resolveFocalSprintId(projectSprints);
        }
        return null;
    }

    private Long resolveSprintNumberFromMessage(String message, List<Sprint> orderedSprints) {
        if (message == null || message.isBlank() || orderedSprints == null || orderedSprints.isEmpty()) {
            return null;
        }
        Matcher m = SPRINT_ID_IN_TEXT.matcher(message);
        if (!m.find()) {
            return null;
        }
        try {
            int n = Integer.parseInt(m.group(1));
            if (n >= 1 && n <= orderedSprints.size()) {
                return orderedSprints.get(n - 1).getId();
            }
        } catch (NumberFormatException ignored) {
            return null;
        }
        return null;
    }

    private boolean mentionsThisSprint(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        String lower = message.toLowerCase(Locale.ROOT);
        return lower.contains("current sprint")
                || lower.contains("this sprint")
                || lower.contains("sprint actual")
                || lower.contains("este sprint");
    }

    private boolean mentionsFocalSprint(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }
        if (mentionsThisSprint(message)) {
            return true;
        }
        String lower = message.toLowerCase(Locale.ROOT);
        return lower.contains("productivity")
                || lower.contains("productividad")
                || lower.contains("improve")
                || lower.contains("mejorar")
                || lower.contains("recommend")
                || lower.contains("recomiend");
    }

    private Long resolveFocalSprintId(List<Sprint> orderedSprints) {
        if (orderedSprints == null || orderedSprints.isEmpty()) {
            return null;
        }
        LocalDateTime now = LocalDateTime.now();
        Long activeId = null;
        LocalDateTime activeStart = null;
        for (Sprint sprint : orderedSprints) {
            if (sprint.getStartDate() == null || sprint.getDueDate() == null) {
                continue;
            }
            if (!now.isBefore(sprint.getStartDate()) && !now.isAfter(sprint.getDueDate())) {
                if (activeStart == null || sprint.getStartDate().isAfter(activeStart)) {
                    activeStart = sprint.getStartDate();
                    activeId = sprint.getId();
                }
            }
        }
        if (activeId != null) {
            return activeId;
        }
        Sprint last = orderedSprints.get(orderedSprints.size() - 1);
        return last.getId();
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