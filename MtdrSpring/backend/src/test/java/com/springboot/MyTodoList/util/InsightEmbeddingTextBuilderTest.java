package com.springboot.MyTodoList.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class InsightEmbeddingTextBuilderTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void buildFromInsightsJson_includesKpisAlertsAndSummary() throws Exception {
        String json = "{"
            + "\"generationKpiSnapshot\": {"
            + "\"completionRate\": 88,"
            + "\"onTimeDelivery\": 72,"
            + "\"efficiencyScore\": 90,"
            + "\"workloadBalance\": 65,"
            + "\"productivityScore\": 81"
            + "},"
            + "\"executiveSummary\": {"
            + "\"overview\": \"Task status in this sprint: 2 To do, 4 In progress, 0 In review, 10 Done.\","
            + "\"trends\": \"Productivity decreased by 8 points compared to the previous sprint.\""
            + "},"
            + "\"alerts\": ["
            + "{\"severity\": \"warning\", \"message\": \"On-Time Delivery is below target at 72%.\"}"
            + "],"
            + "\"actionableRecommendations\": ["
            + "{\"category\": \"blockers\", \"text\": \"Unblock task #12 assigned to Maria.\"}"
            + "],"
            + "\"summary\": \"Delivery pace slipped; focus on blockers this week.\""
            + "}";

        String text = InsightEmbeddingTextBuilder.buildFromInsightsJson(mapper.readTree(json));

        assertTrue(text.contains("completion 88%"));
        assertTrue(text.contains("On-Time Delivery is below target"));
        assertTrue(text.contains("blockers"));
        assertTrue(text.contains("Delivery pace slipped"));
    }

    @Test
    void buildDisplaySnippet_prefersTopAlert() throws Exception {
        String json = "{"
            + "\"alerts\": [{\"severity\": \"critical\", \"message\": \"Workload balance is critically low.\"}],"
            + "\"executiveSummary\": {\"overview\": \"Overview text.\"}"
            + "}";

        String snippet = InsightEmbeddingTextBuilder.buildDisplaySnippet(mapper.readTree(json));
        assertTrue(snippet.contains("Workload balance"));
    }
}
