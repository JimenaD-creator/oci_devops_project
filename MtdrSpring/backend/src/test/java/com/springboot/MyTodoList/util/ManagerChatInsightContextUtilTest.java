package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.SprintInsight;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ManagerChatInsightContextUtilTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void compactInsightForChat_extractsAlertsAndDeveloperNotes() throws Exception {
        SprintInsight insight = new SprintInsight(1L, 10L, "{"
            + "\"executiveSummary\":{\"overview\":\"Sprint overview text.\"},"
            + "\"alerts\":[{\"severity\":\"warning\",\"message\":\"On-time delivery is low.\"}],"
            + "\"actionableRecommendations\":[{\"category\":\"planning\",\"text\":\"Rebalance workload.\"}],"
            + "\"developerInsights\":[{\"developerName\":\"Ana\",\"insight\":\"Strong delivery pace.\",\"overloaded\":false}]"
            + "}");
        insight.setGeneratedAt(LocalDateTime.parse("2026-06-01T10:00:00"));

        Map<String, Object> compact = ManagerChatInsightContextUtil.compactInsightForChat(insight, mapper);

        assertTrue((Boolean) compact.get("available"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> devNotes = (List<Map<String, Object>>) compact.get("developerNotes");
        assertEquals(1, devNotes.size());
        assertEquals("Ana", devNotes.get(0).get("developerName"));
        assertTrue(String.valueOf(devNotes.get(0).get("note")).contains("Strong delivery"));
        assertFalse(compact.containsKey("kpisAtGeneration"));
    }

    @Test
    void buildDeveloperPerformanceHistory_mergesMetricsWithNotes() {
        Map<String, Object> sprint = Map.of(
            "sprintLabel", "Sprint 2",
            "developers", List.of(Map.of(
                "name", "Ana",
                "completed", 4,
                "pending", 1,
                "workedHours", 12.5
            )),
            "sprintAnalysis", Map.of(
                "available", true,
                "developerNotes", List.of(Map.of(
                    "developerName", "Ana",
                    "note", "Completed most tasks early.",
                    "overloaded", false
                ))
            )
        );

        List<Map<String, Object>> history =
            ManagerChatInsightContextUtil.buildDeveloperPerformanceHistory(List.of(sprint));

        assertEquals(1, history.size());
        assertEquals("Sprint 2", history.get(0).get("sprintLabel"));
        assertEquals("Ana", history.get(0).get("developerName"));
        assertEquals(4, history.get(0).get("completed"));
        assertEquals(12.5, history.get(0).get("workedHours"));
    }

    @Test
    void compactInsightForChat_marksUnavailableWhenMissingJson() {
        SprintInsight insight = new SprintInsight();
        Map<String, Object> compact = ManagerChatInsightContextUtil.compactInsightForChat(insight, mapper);
        assertFalse((Boolean) compact.get("available"));
    }
}
