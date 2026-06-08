package com.springboot.MyTodoList.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.SprintInsight;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.config.GeminiApiConfiguration;
import com.springboot.MyTodoList.dto.SimilarSprintInsightMatch;
import com.springboot.MyTodoList.service.GeminiService;
import com.springboot.MyTodoList.service.EmbeddingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(InsightsController.class);

    @Autowired
    private GeminiService geminiService;

    @Autowired
    private GeminiApiConfiguration geminiApiConfiguration;

    @Autowired
    private SprintInsightRepository insightRepository;

    @Autowired
    private EmbeddingService embeddingService;

    private final ObjectMapper mapper = new ObjectMapper();

    // ─────────────────────────────────────────────────────────────────────────
    // GENERATE (async — returns 202 Accepted immediately)
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/sprint/{sprintId}/generate")
    public ResponseEntity<Map<String, Object>> generateInsights(@PathVariable Long sprintId) {
        Map<String, Object> response = new HashMap<>();
        if (!geminiApiConfiguration.isConfigured()) {
            response.put("status", "failed");
            response.put("error", GeminiApiConfiguration.ERROR_CODE);
            response.put("message", GeminiApiConfiguration.USER_MESSAGE);
            response.put("sprintId", sprintId);
            return ResponseEntity.unprocessableEntity().body(response);
        }
        try {
            log.info("POST /api/insights/sprint/{}/generate accepted", sprintId);
            geminiService.markInsightGenerationStarted(sprintId);

            CompletableFuture<SprintInsight> future =
                geminiService.generateInsightsForSprint(sprintId);

            future.whenComplete((result, ex) -> {
                if (ex != null) {
                    log.error("Async insight generation failed for sprint {}: {}",
                        sprintId, ex.getMessage(), ex);
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
        SprintInsight insight = opt.get();
        Optional<Map<String, Object>> cached = geminiService.getCachedInsightsGetResponse(insight);
        Map<String, Object> payload;
        if (cached.isPresent()) {
            payload = new HashMap<>(cached.get());
        } else {
            payload = buildResponsePayload(insight);
            geminiService.putCachedInsightsGetResponse(insight, payload);
        }
        geminiService.attachInsightsFreshnessMetadata(payload, sprintId);
        return ResponseEntity.ok(payload);
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

    /**
     * Semantically similar sprint insights within the same project (vector search over insight summaries).
     * GET /api/insights/sprint/{sprintId}/similar?limit=5&minSimilarity=0.72
     */
    @GetMapping("/sprint/{sprintId}/similar")
    public ResponseEntity<Map<String, Object>> getSimilarSprintInsights(
            @PathVariable Long sprintId,
            @RequestParam(defaultValue = "5") int limit,
            @RequestParam(required = false) Double minSimilarity) {
        Map<String, Object> response = new HashMap<>();
        if (!geminiApiConfiguration.isConfigured()) {
            response.put("configured", false);
            response.put("matches", List.of());
            response.put("message", GeminiApiConfiguration.USER_MESSAGE);
            return ResponseEntity.ok(response);
        }
        Optional<SprintInsight> source = insightRepository.findBySprintId(sprintId);
        if (source.isEmpty() || source.get().getInsightsJson() == null || source.get().getInsightsJson().isBlank()) {
            return ResponseEntity.notFound().build();
        }
        double threshold = minSimilarity != null
            ? minSimilarity
            : EmbeddingService.DEFAULT_INSIGHT_SIMILARITY_THRESHOLD;
        int topK = Math.max(1, Math.min(limit, 10));
        try {
            List<SimilarSprintInsightMatch> matches =
                embeddingService.findSimilarSprintInsights(sprintId, topK, threshold);
            Long projectId = source.get().getProjectId();
            int indexed = embeddingService.countIndexedInsightsForProject(projectId);
            int withInsights = embeddingService.countInsightsWithJsonForProject(projectId);
            response.put("configured", true);
            response.put("sprintId", sprintId);
            response.put("projectId", projectId);
            response.put("minSimilarity", threshold);
            response.put("indexedSprints", indexed);
            response.put("insightsAvailable", withInsights);
            response.put("vectorSearchBackend", embeddingService.getInsightVectorSearchBackend().name());
            response.put("matches", matches);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Similar insights lookup failed for sprint {}: {}", sprintId, e.getMessage());
            response.put("error", "Failed to find similar sprint insights.");
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * One-time backfill: embed all persisted insights for a project (for historical sprints).
     * POST /api/insights/project/{projectId}/embeddings/backfill
     */
    @PostMapping("/project/{projectId}/embeddings/backfill")
    public ResponseEntity<Map<String, Object>> backfillInsightEmbeddings(@PathVariable Long projectId) {
        Map<String, Object> response = new HashMap<>();
        if (!geminiApiConfiguration.isConfigured()) {
            response.put("status", "skipped");
            response.put("error", GeminiApiConfiguration.ERROR_CODE);
            response.put("message", GeminiApiConfiguration.USER_MESSAGE);
            return ResponseEntity.unprocessableEntity().body(response);
        }
        try {
            int embedded = embeddingService.backfillProjectInsightEmbeddings(projectId);
            response.put("status", "ok");
            response.put("projectId", projectId);
            response.put("embeddedCount", embedded);
            response.put("vectorSearchBackend", embeddingService.getInsightVectorSearchBackend().name());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("status", "failed");
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    /**
     * AI personal performance narrative for one developer in a sprint (My Performance page).
     */
    @GetMapping("/sprint/{sprintId}/developer-performance-summary")
    public ResponseEntity<Map<String, Object>> getDeveloperPerformanceSummary(
            @PathVariable Long sprintId,
            @RequestParam Long userId) {
        return ResponseEntity.ok(geminiService.buildDeveloperPerformanceSummaryResponse(sprintId, userId));
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
        geminiService.invalidateInsightsGetResponseCache(sprintId);

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
            if (GeminiService.INSIGHT_STATUS_PROCESSING.equals(insight.getErrorMessage())) {
                payload.put("status", "processing");
            }
            return payload;
        }

        if (insight.getInsightsJson() == null || insight.getInsightsJson().isBlank()) {
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