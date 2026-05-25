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
        ut.setWorkedHours(6L);
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
}
