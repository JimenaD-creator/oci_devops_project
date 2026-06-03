package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.springboot.MyTodoList.config.GeminiApiConfiguration;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserSprintRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class GeminiServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Mock
    private SprintRepository sprintRepository;

    @Mock
    private SprintInsightRepository insightRepository;

    @Mock
    private UserTaskRepository userTaskRepository;

    @Mock
    private UserSprintRepository userSprintRepository;

    @Mock
    private KpiService kpiService;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private GeminiApiConfiguration geminiApiConfiguration;

    @InjectMocks
    private GeminiService geminiService;

    @Test
    void generateDeveloperVariationInsights_withFewerThanTwoSnapshots_returnsEmptyArrays() throws Exception {
        JsonNode result = geminiService.generateDeveloperVariationInsights(List.of(Map.of("id", 1)));

        assertTrue(result.has("tasks"));
        assertTrue(result.has("hours"));
        assertTrue(result.has("productivity"));
        assertEquals(0, result.get("tasks").size());
        assertEquals(0, result.get("hours").size());
        assertEquals(0, result.get("productivity").size());
    }

    @Test
    void generateDeveloperVariationInsights_withNullSnapshots_returnsEmptyArrays() throws Exception {
        JsonNode result = geminiService.generateDeveloperVariationInsights(null);

        assertEquals(0, result.get("tasks").size());
    }

    @Test
    void generateDeveloperVariationInsights_fallback_computesDeltasWithoutApi() throws Exception {
        when(geminiApiConfiguration.isConfigured()).thenReturn(false);

        List<Map<String, Object>> snapshots = twoSprintSnapshotsForAlice();

        JsonNode result = geminiService.generateDeveloperVariationInsights(snapshots);

        assertEquals(1, result.get("tasks").size());
        assertEquals("Alice", result.get("tasks").get(0).get("developerName").asText());
        assertEquals(1, result.get("tasks").get(0).get("delta").asInt());

        assertEquals(1, result.get("hours").size());
        assertEquals(1.0, result.get("hours").get(0).get("delta").asDouble(), 0.01);

        assertEquals(1, result.get("productivity").size());
        assertTrue(result.get("productivity").get(0).has("delta"));
    }

    @Test
    void enrichInsightsForResponse_convertsSnakeCaseKeys() throws Exception {
        when(userTaskRepository.findBySprintIdWithUserAndTask(anyLong())).thenReturn(Collections.emptyList());
        when(taskRepository.countTasksByStatusForSprint(anyLong())).thenReturn(Collections.emptyList());
        when(sprintRepository.findById(anyLong())).thenReturn(Optional.empty());
        when(userSprintRepository.findBySprintIdWithUser(anyLong())).thenReturn(Collections.emptyList());

        JsonNode input = loadFixture("gemini/insights-snake-case-input.json");

        JsonNode enriched = geminiService.enrichInsightsForResponse(input, 1L);

        assertTrue(enriched.isObject());
        assertTrue(enriched.has("developerInsights"), "expected camelCase developerInsights");
        assertFalse(enriched.has("developer_insights"));
        assertEquals("Alice", enriched.get("developerInsights").get(0).get("developerName").asText());
        assertTrue(enriched.has("executiveSummary"));
    }

    @Test
    void enrichInsightsForResponse_nullInput_returnsNull() {
        assertNull(geminiService.enrichInsightsForResponse(null, 1L));
    }

    @Test
    void enrichInsightsForResponse_fillsDeveloperInsightsAndTaskBreakdownFromDb() throws Exception {
        long sprintId = 5L;
        when(userTaskRepository.findBySprintIdWithUserAndTask(sprintId))
            .thenReturn(List.of(userTaskWithDoneWork(10L, "Bob", 100L)));
        when(userSprintRepository.findBySprintIdWithUser(sprintId)).thenReturn(Collections.emptyList());
        when(sprintRepository.findById(sprintId)).thenReturn(Optional.empty());
        when(taskRepository.countTasksByStatusForSprint(sprintId)).thenReturn(List.of(
            new Object[] { "DONE", 2L },
            new Object[] { "TODO", 1L }
        ));

        JsonNode input = loadFixture("gemini/insights-empty-developers.json");
        JsonNode enriched = geminiService.enrichInsightsForResponse(input, sprintId);

        assertNotNull(enriched);
        assertEquals(1, enriched.get("developerInsights").size());
        assertEquals("Bob", enriched.get("developerInsights").get(0).get("developerName").asText());
        String insight = enriched.get("developerInsights").get(0).get("insight").asText();
        assertTrue(
            insight.toLowerCase().contains("completed") || insight.toLowerCase().contains("assignment"),
            () -> "unexpected insight: " + insight);

        assertTrue(enriched.has("taskStatusBreakdown"));
        assertEquals(2, enriched.get("taskStatusBreakdown").get("done").asInt());
        assertEquals(1, enriched.get("taskStatusBreakdown").get("toDo").asInt());

        assertTrue(enriched.get("actionableRecommendations").size() > 0);
    }

    @Test
    void enrichInsightsForResponse_preservesGeminiExecutiveSummaryOnReEnrich() throws Exception {
        long sprintId = 7L;
        when(userTaskRepository.findBySprintIdWithUserAndTask(sprintId)).thenReturn(Collections.emptyList());
        when(userSprintRepository.findBySprintIdWithUser(sprintId)).thenReturn(Collections.emptyList());
        when(sprintRepository.findById(sprintId)).thenReturn(Optional.empty());
        when(taskRepository.countTasksByStatusForSprint(sprintId)).thenReturn(List.of(
            new Object[] { "DONE", 2L },
            new Object[] { "TODO", 1L }
        ));

        String geminiTrends =
            "Productivity improved by 18% compared to Sprint 1 with stronger delivery focus.";
        ObjectNode input = MAPPER.createObjectNode();
        ObjectNode es = MAPPER.createObjectNode();
        es.put(
            "overview",
            "Task status in this sprint: 1 To do, 0 In progress, 0 In review, 2 Done. "
                + "Team closed critical items ahead of schedule.");
        es.put("trends", geminiTrends);
        es.put("improvementAreas", "Watch participation logging so hours match estimates.");
        es.put("nextSteps", "Run a short retro after the sprint ends.");
        input.set("executiveSummary", es);

        JsonNode enriched = geminiService.enrichInsightsForResponse(input, sprintId);

        assertTrue(enriched.has("geminiExecutiveSummary"));
        assertEquals(geminiTrends, enriched.get("geminiExecutiveSummary").get("trends").asText());
        assertEquals(geminiTrends, enriched.get("executiveSummary").get("trends").asText());
        String overview = enriched.get("executiveSummary").get("overview").asText();
        assertTrue(overview.startsWith("Task status in this sprint:"));
        assertTrue(overview.contains("Team closed critical items"));

        ObjectNode secondPass = (ObjectNode) enriched.deepCopy();
        ObjectNode esMutated = (ObjectNode) secondPass.get("executiveSummary");
        esMutated.put("trends", "Compared with Sprint 1, productivity and completion slipped.");
        JsonNode reEnriched = geminiService.enrichInsightsForResponse(secondPass, sprintId);
        assertEquals(geminiTrends, reEnriched.get("executiveSummary").get("trends").asText());
    }

    @Test
    void extractJsonFromGeminiResponse_stripsMarkdownFences() throws Exception {
        String raw = loadFixtureAsString("gemini/gemini-api-response.json");

        Method method = GeminiService.class.getDeclaredMethod("extractJsonFromGeminiResponse", String.class);
        method.setAccessible(true);
        String json = (String) method.invoke(geminiService, raw);

        JsonNode parsed = MAPPER.readTree(json);
        assertTrue(parsed.get("ok").asBoolean());
        assertTrue(parsed.has("tasks"));
    }

    private static List<Map<String, Object>> twoSprintSnapshotsForAlice() {
        List<Map<String, Object>> snapshots = new ArrayList<>();
        Map<String, Object> sprint1 = new LinkedHashMap<>();
        sprint1.put("shortLabel", "Sprint 1");
        sprint1.put("developers", List.of(
            Map.of("name", "Alice", "assigned", 2, "completed", 1, "hours", 4.0)
        ));
        Map<String, Object> sprint2 = new LinkedHashMap<>();
        sprint2.put("shortLabel", "Sprint 2");
        sprint2.put("developers", List.of(
            Map.of("name", "Alice", "assigned", 2, "completed", 2, "hours", 5.0)
        ));
        snapshots.add(sprint1);
        snapshots.add(sprint2);
        return snapshots;
    }

    private static UserTask userTaskWithDoneWork(long userId, String developerName, long taskId) {
        User user = new User();
        user.setId(userId);
        user.setName(developerName);

        LocalDateTime now = LocalDateTime.of(2026, 1, 10, 9, 0);
        Task task = new Task();
        task.setId(taskId);
        task.setStatus("DONE");
        task.setTitle("Ship feature");
        task.setStartDate(now);
        task.setDueDate(now.plusDays(7));
        task.setFinishDate(now.plusDays(2));

        UserTask ut = new UserTask(user, task);
        ut.setStatus("COMPLETED");
        ut.setCompletedAt(now.plusDays(2));
        ut.setWorkedHours(6.0);
        return ut;
    }

    private static JsonNode loadFixture(String classpathResource) throws Exception {
        try (InputStream in = GeminiServiceTest.class.getClassLoader().getResourceAsStream(classpathResource)) {
            if (in == null) {
                throw new IllegalStateException("Missing test resource: " + classpathResource);
            }
            return MAPPER.readTree(in);
        }
    }

    private static String loadFixtureAsString(String classpathResource) throws Exception {
        try (InputStream in = GeminiServiceTest.class.getClassLoader().getResourceAsStream(classpathResource)) {
            if (in == null) {
                throw new IllegalStateException("Missing test resource: " + classpathResource);
            }
            return new String(in.readAllBytes());
        }
    }

    @Test
    void stampDeveloperAiNarrativesFromRaw_copiesGeminiInsightBeforeLiveSync() throws Exception {
        Method m = GeminiService.class.getDeclaredMethod(
            "stampDeveloperAiNarrativesFromRaw", ObjectNode.class);
        m.setAccessible(true);
        ObjectNode root = MAPPER.createObjectNode();
        ArrayNode dev = root.putArray("developerInsights");
        ObjectNode row = dev.addObject();
        row.put("developerName", "Jimena Díaz");
        row.put(
            "insight",
            "Completed 3 tasks on time with 7 hours logged. Strong performance.");

        m.invoke(null, root);

        assertEquals(
            "Completed 3 tasks on time with 7 hours logged. Strong performance.",
            row.path("aiNarrative").asText());
    }

    @Test
    void preserveAiNarrativeFromPriorInsight_keepsGeminiProseNotLiveTemplate() throws Exception {
        Method preserve = GeminiService.class.getDeclaredMethod(
            "preserveAiNarrativeFromPriorInsight",
            ObjectNode.class,
            String.class,
            String.class);
        preserve.setAccessible(true);
        ObjectNode row = MAPPER.createObjectNode();
        String ai =
            "Completed 2 tasks on time with 14 hours logged. Has 1 Pending task remaining.";
        String live =
            "Completed 2 assignments, all finished on or before the due date. "
                + "Hours logged are below the team average.";
        preserve.invoke(null, row, ai, live);
        assertEquals(ai, row.path("aiNarrative").asText());
    }

    @Test
    void stripRedistributionGuidanceFromNarrative_keepsFactsAndDropsMoveAdvice() throws Exception {
        Method m = GeminiService.class.getDeclaredMethod(
            "stripRedistributionGuidanceFromNarrative", String.class);
        m.setAccessible(true);
        String input =
            "Has completed 2 tasks and has 1 remaining task in the To do status. "
                + "Currently carrying the highest logged hours, so rebalancing the final task is recommended.";
        String out = (String) m.invoke(null, input);
        assertTrue(out.contains("completed 2 tasks"));
        assertFalse(out.toLowerCase().contains("rebalance"));
        assertFalse(out.toLowerCase().contains("highest logged hours"));
    }

    @Test
    void composeDeveloperInsightDisplay_appendsSnapshotWhenPendingFactsStale() throws Exception {
        Method m = GeminiService.class.getDeclaredMethod(
            "composeDeveloperInsightDisplay",
            ObjectNode.class,
            String.class,
            String.class,
            List.class);
        m.setAccessible(true);
        ObjectNode row = MAPPER.createObjectNode();
        row.put("overloaded", false);
        row.put("pendingAssignments", 0);
        row.put("liveCompletedTasks", 3);
        row.put("liveWorkedHours", 14);
        String ai =
            "Completed 2 tasks on time with 12 hours logged. Has 1 Pending task remaining.";
        String live =
            "Completed 3 assignments, all finished on or before the due date. "
                + "Hours logged are within a reasonable range.";
        String out = (String) m.invoke(null, row, live, ai, Collections.emptyList());
        assertTrue(out.contains("Current snapshot:"), () -> "unexpected: " + out);
        assertTrue(out.startsWith(ai));
    }

    @Test
    void composeDeveloperInsightDisplay_omitsLiveSnapshotWhenAiCoversBlockedContext() throws Exception {
        Method m = GeminiService.class.getDeclaredMethod(
            "composeDeveloperInsightDisplay",
            ObjectNode.class,
            String.class,
            String.class,
            List.class);
        m.setAccessible(true);
        ObjectNode row = MAPPER.createObjectNode();
        row.put("overloaded", false);
        row.put("pendingAssignments", 1);
        row.put("liveCompletedTasks", 1);
        row.put("liveWorkedHours", 4);
        String ai =
            "Currently blocked on the automated test pipeline task due to OCI infrastructure problems; "
                + "1 task remains in the To do status.";
        String live =
            "Completed 1 assignment, all finished on or before the due date. "
                + "Hours logged are below the team average.";
        String out = (String) m.invoke(null, row, live, ai, Collections.emptyList());
        assertEquals(ai, out);
        assertFalse(out.contains("Current snapshot"));
    }

    @Test
    void applyOverloadGuardrails_clearsBlockedDeveloperWithSinglePendingTask() throws Exception {
        long sprintId = 99L;
        when(userTaskRepository.findBySprintIdWithUserAndTask(sprintId)).thenReturn(List.of(
            userTaskWithDoneWork(1L, "Ana López", 10L),
            blockedOpenUserTask(1L, "Ana López", 11L),
            openUserTask(2L, "Bob", 12L)));
        when(userSprintRepository.findBySprintIdWithUser(sprintId)).thenReturn(Collections.emptyList());
        when(sprintRepository.findById(sprintId)).thenReturn(Optional.empty());

        ObjectNode root = MAPPER.createObjectNode();
        ArrayNode dev = root.putArray("developerInsights");
        ObjectNode ana = dev.addObject();
        ana.put("developerName", "Ana López");
        ana.put("overloaded", true);

        Method apply = GeminiService.class.getDeclaredMethod(
            "applyOverloadGuardrails", ObjectNode.class, Long.class);
        apply.setAccessible(true);
        apply.invoke(geminiService, root, sprintId);

        assertFalse(ana.path("overloaded").asBoolean(true));
    }

    private static UserTask openUserTask(long userId, String developerName, long taskId) {
        User user = new User();
        user.setId(userId);
        user.setName(developerName);
        Task task = new Task();
        task.setId(taskId);
        task.setStatus("TODO");
        task.setTitle("Open task");
        task.setAssignedHours(4L);
        UserTask ut = new UserTask(user, task);
        ut.setStatus("ASSIGNED");
        ut.setWorkedHours(1.0);
        return ut;
    }

    private static UserTask blockedOpenUserTask(long userId, String developerName, long taskId) {
        UserTask ut = openUserTask(userId, developerName, taskId);
        ut.getTask().setStatus("IN_PROCESS");
        ut.setStatus("IN_PROGRESS");
        ut.setIsBlocked(true);
        ut.setBlockedReason("Waiting on API access");
        ut.getTask().setAssignedHours(16L);
        return ut;
    }
}
