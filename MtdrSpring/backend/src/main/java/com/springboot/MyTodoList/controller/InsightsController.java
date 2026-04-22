package com.springboot.MyTodoList.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.SprintInsight;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.service.GeminiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * REST endpoints for AI-generated sprint insights.
 *
 * POST  /api/insights/sprint/{sprintId}/generate    → trigger Gemini (async)
 * GET   /api/insights/sprint/{sprintId}             → get persisted insights OR error state
 * GET   /api/insights/project/{projectId}           → all insights for a project
 * PATCH /api/insights/sprint/{sprintId}/acknowledge → mark as read
 */
@RestController
@RequestMapping("/api/insights")
public class InsightsController {

    @Autowired
    private GeminiService geminiService;

    @Autowired
    private SprintInsightRepository insightRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    // ─────────────────────────────────────────────────────────────────────────
    // GENERATE (async — returns 202 Accepted immediately)
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/sprint/{sprintId}/generate")
    public ResponseEntity<Map<String, Object>> generateInsights(@PathVariable Long sprintId) {
        Map<String, Object> response = new HashMap<>();
        try {
            CompletableFuture<SprintInsight> future =
                geminiService.generateInsightsForSprint(sprintId);

            future.whenComplete((result, ex) -> {
                if (ex != null) {
                    System.err.println("[InsightsController] Async generation failed for sprint "
                        + sprintId + ": " + ex.getMessage());
                }
            });

            response.put("status", "processing");
            response.put("message", "Generating AI insights for sprint " + sprintId
                + ". Poll GET /api/insights/sprint/" + sprintId + " for results.");
            response.put("sprintId", sprintId);
            return ResponseEntity.accepted().body(response);

        } catch (Exception e) {
            response.put("error", "Failed to start insight generation: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns the persisted insights for a sprint.
     *
     * Response shape:
     *  - 404: no row exists yet (never generated)                → frontend shows "Generate" button
     *  - 200 + errorMessage set: generation failed               → frontend shows error, stops polling
     *  - 200 + insights set:     generation succeeded            → frontend renders insights
     */
    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<Map<String, Object>> getInsightsBySprint(@PathVariable Long sprintId) {
        Optional<SprintInsight> opt = insightRepository.findBySprintId(sprintId);
        if (opt.isEmpty()) {
            // No row at all — generation was never triggered (or hasn't started yet)
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(buildResponsePayload(opt.get()));
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<Map<String, Object>>> getInsightsByProject(
            @PathVariable Long projectId) {
        List<SprintInsight> insights =
            insightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId);

        List<Map<String, Object>> result = insights.stream()
            .map(this::buildResponsePayload)
            .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @PostMapping("/developer-variation")
    public ResponseEntity<Map<String, Object>> getDeveloperVariationInsights(
            @RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();
        try {
            Object rawSprints = body != null ? body.get("sprints") : null;
            if (!(rawSprints instanceof List<?>)) {
                response.put("error", "Body must include a 'sprints' array.");
                return ResponseEntity.badRequest().body(response);
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sprints = (List<Map<String, Object>>) rawSprints;
            JsonNode insights = geminiService.generateDeveloperVariationInsights(sprints);
            response.put("insights", insights);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("error", "Failed to generate developer variation insights: " + e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACKNOWLEDGE
    // ─────────────────────────────────────────────────────────────────────────

    @PatchMapping("/sprint/{sprintId}/acknowledge")
    public ResponseEntity<Map<String, Object>> acknowledgeInsights(@PathVariable Long sprintId) {
        Optional<SprintInsight> opt = insightRepository.findBySprintId(sprintId);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        SprintInsight insight = opt.get();
        insight.setAcknowledged(true);
        insightRepository.save(insight);

        Map<String, Object> response = new HashMap<>();
        response.put("acknowledged", true);
        response.put("sprintId", sprintId);
        return ResponseEntity.ok(response);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPER
    // ─────────────────────────────────────────────────────────────────────────

    private Map<String, Object> buildResponsePayload(SprintInsight insight) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id",          insight.getId());
        payload.put("sprintId",    insight.getSprintId());
        payload.put("projectId",   insight.getProjectId());
        payload.put("generatedAt", insight.getGeneratedAt());
        payload.put("acknowledged", insight.isAcknowledged());

        // If the last generation attempt failed, expose the error code.
        // The frontend uses this to stop polling and show a user-friendly message.
        if (insight.getErrorMessage() != null) {
            payload.put("error", insight.getErrorMessage());
            payload.put("insights", null);
            return payload;
        }

        // Parse stored JSON; normalize snake_case / back-fill empty sections from DB workload (same as on save)
        try {
            JsonNode parsed = mapper.readTree(insight.getInsightsJson());
            parsed = geminiService.enrichInsightsForResponse(parsed, insight.getSprintId());
            payload.put("insights", parsed);
        } catch (Exception e) {
            payload.put("insights", insight.getInsightsJson());
            payload.put("parseError", true);
        }

        return payload;
    }
}