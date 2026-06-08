package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.dto.SimilarSprintInsightMatch;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.config.GeminiApiConfiguration;
import com.springboot.MyTodoList.model.SprintInsight;
import com.springboot.MyTodoList.model.SprintInsightEmbedding;
import com.springboot.MyTodoList.model.TaskEmbedding;
import com.springboot.MyTodoList.repository.SprintInsightEmbeddingRepository;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.repository.TaskEmbeddingRepository;
import com.springboot.MyTodoList.util.InsightEmbeddingTextBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    /** Minimum cosine similarity to surface a match in the UI. */
    public static final double DEFAULT_INSIGHT_SIMILARITY_THRESHOLD = 0.55;

    /** When nothing passes the default threshold, still show strong relative matches above this floor. */
    private static final double INSIGHT_SIMILARITY_FLOOR = 0.42;

    @Autowired
    private GeminiApiConfiguration geminiApiConfiguration;

    private static final String EMBEDDING_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";



    @Autowired
    private TaskEmbeddingRepository embeddingRepository;

    @Autowired
    private SprintInsightEmbeddingRepository sprintInsightEmbeddingRepository;

    @Autowired
    private SprintInsightRepository sprintInsightRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();

    // ─────────────────────────────────────────────────────────────────────────
    // GENERAR Y GUARDAR EMBEDDING DE UNA TAREA
    // ─────────────────────────────────────────────────────────────────────────

    public void embedTask(Task task, Long sprintId) throws Exception {
        // Construir texto representativo de la tarea
        String texto = buildTaskChunk(task);

        // Generar vector via Gemini Embedding API
        double[] vector = generateEmbedding(texto);

        // Borrar embedding anterior si existe
        embeddingRepository.deleteByTaskId(task.getId());

        // Guardar nuevo embedding
        TaskEmbedding te = new TaskEmbedding();
        te.setTaskId(task.getId());
        te.setSprintId(sprintId);
        te.setTextoChunk(texto);
        te.setEmbedding(mapper.writeValueAsString(vector));
        te.setCreatedAt(LocalDateTime.now());
        embeddingRepository.save(te);

        System.out.println("[EmbeddingService] Embedded task " + task.getId() + ": " + texto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BUSCAR TAREAS RELEVANTES PARA UNA PREGUNTA (RAG)
    // ─────────────────────────────────────────────────────────────────────────

    public List<TaskEmbedding> findRelevantTasks(String query, Long sprintId, int topK) throws Exception {
        // Convertir la pregunta en vector
        double[] queryVector = generateEmbedding(query);

        // Traer todos los embeddings del sprint
        List<TaskEmbedding> candidates = sprintId != null
            ? embeddingRepository.findBySprintId(sprintId)
            : embeddingRepository.findAll();

        if (candidates.isEmpty()) return List.of();

        // Calcular similitud coseno con cada embedding guardado
        return candidates.stream()
            .map(te -> {
                try {
                    double[] storedVector = parseVector(te.getEmbedding());
                    double similarity = cosineSimilarity(queryVector, storedVector);
                    return Map.entry(te, similarity);
                } catch (Exception e) {
                    return Map.entry(te, 0.0);
                }
            })
            .sorted((a, b) -> Double.compare(b.getValue(), a.getValue())) // mayor similitud primero
            .limit(topK)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }

    /**
     * Semantic search over sprint insight embeddings within a project (manager chat RAG).
     */
    public List<SprintInsightEmbedding> findRelevantSprintInsights(String query, Long projectId, int topK)
            throws Exception {
        if (query == null || query.isBlank() || projectId == null || topK <= 0) {
            return List.of();
        }
        ensureProjectInsightEmbeddings(projectId);
        double[] queryVector = generateEmbedding(query);
        List<SprintInsightEmbedding> candidates = sprintInsightEmbeddingRepository.findByProjectId(projectId);
        if (candidates.isEmpty()) {
            return List.of();
        }
        return candidates.stream()
            .map(ie -> {
                try {
                    double[] storedVector = parseVector(ie.getEmbedding());
                    double similarity = cosineSimilarity(queryVector, storedVector);
                    return Map.entry(ie, similarity);
                } catch (Exception e) {
                    return Map.entry(ie, 0.0);
                }
            })
            .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
            .limit(topK)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SPRINT INSIGHT EMBEDDINGS (semantic similarity within project)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Builds a text chunk, calls Gemini embeddings, and upserts {@code SPRINT_INSIGHT_EMBEDDINGS}.
     * Failures are logged; callers should not fail insight generation because of embedding errors.
     */
    @Transactional
    public void embedSprintInsight(Long sprintId, Long projectId, String insightsJson) {
        if (sprintId == null || projectId == null || insightsJson == null || insightsJson.isBlank()) {
            return;
        }
        if (!geminiApiConfiguration.isConfigured()) {
            log.debug("Skipping insight embedding for sprint {} — Gemini API not configured", sprintId);
            return;
        }
        try {
            JsonNode root = mapper.readTree(insightsJson);
            String text = InsightEmbeddingTextBuilder.buildFromInsightsJson(root);
            if (text.isBlank()) {
                log.warn("Insight embedding skipped for sprint {} — empty text chunk", sprintId);
                return;
            }
            double[] vector = generateEmbedding(text);

            SprintInsightEmbedding row = sprintInsightEmbeddingRepository.findBySprintId(sprintId)
                .orElseGet(SprintInsightEmbedding::new);
            row.setSprintId(sprintId);
            row.setProjectId(projectId);
            row.setTextChunk(text);
            row.setEmbedding(mapper.writeValueAsString(vector));
            row.setCreatedAt(LocalDateTime.now());
            sprintInsightEmbeddingRepository.save(row);
            log.info("Embedded sprint insight {} ({} chars)", sprintId, text.length());
        } catch (Exception e) {
            log.error("Failed to embed sprint insight {}: {}", sprintId, e.getMessage(), e);
        }
    }

    public void embedSprintInsight(SprintInsight insight) {
        if (insight == null) {
            return;
        }
        embedSprintInsight(insight.getSprintId(), insight.getProjectId(), insight.getInsightsJson());
    }

    /**
     * Ensures the source sprint has an embedding (lazy backfill from persisted JSON).
     */
    @Transactional
    public Optional<SprintInsightEmbedding> ensureInsightEmbedding(Long sprintId) {
        if (sprintId == null) {
            return Optional.empty();
        }
        Optional<SprintInsight> insightOpt = sprintInsightRepository.findBySprintId(sprintId);
        if (insightOpt.isEmpty()
                || insightOpt.get().getInsightsJson() == null
                || insightOpt.get().getInsightsJson().isBlank()
                || insightOpt.get().getErrorMessage() != null) {
            return Optional.empty();
        }
        SprintInsight insight = insightOpt.get();
        Optional<SprintInsightEmbedding> existing = sprintInsightEmbeddingRepository.findBySprintId(sprintId);
        if (existing.isPresent() && !isInsightEmbeddingStale(insight, existing.get())) {
            return existing;
        }
        embedSprintInsight(insight);
        return sprintInsightEmbeddingRepository.findBySprintId(sprintId);
    }

    public int countIndexedInsightsForProject(Long projectId) {
        if (projectId == null) {
            return 0;
        }
        return sprintInsightEmbeddingRepository.findByProjectId(projectId).size();
    }

    public int countInsightsWithJsonForProject(Long projectId) {
        if (projectId == null) {
            return 0;
        }
        int count = 0;
        for (SprintInsight insight : sprintInsightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId)) {
            if (insight.getErrorMessage() == null
                    && insight.getInsightsJson() != null
                    && !insight.getInsightsJson().isBlank()) {
                count++;
            }
        }
        return count;
    }

    private boolean isInsightEmbeddingStale(SprintInsight insight, SprintInsightEmbedding embedding) {
        if (insight.getGeneratedAt() == null || embedding.getCreatedAt() == null) {
            return true;
        }
        return insight.getGeneratedAt().isAfter(embedding.getCreatedAt());
    }

    public List<SimilarSprintInsightMatch> findSimilarSprintInsights(
            Long sprintId,
            int topK,
            double minSimilarity) {
        if (sprintId == null || topK <= 0) {
            return List.of();
        }
        Optional<SprintInsightEmbedding> sourceOpt = ensureInsightEmbedding(sprintId);
        if (sourceOpt.isEmpty()) {
            return List.of();
        }
        SprintInsightEmbedding source = sourceOpt.get();
        Long projectId = source.getProjectId();
        if (projectId == null) {
            return List.of();
        }

        ensureProjectInsightEmbeddings(projectId);

        double[] sourceVector;
        try {
            sourceVector = parseVector(source.getEmbedding());
        } catch (Exception e) {
            log.warn("Invalid source embedding for sprint {}: {}", sprintId, e.getMessage());
            return List.of();
        }

        List<SprintInsightEmbedding> candidates = sprintInsightEmbeddingRepository.findByProjectId(projectId);
        if (candidates.size() < 2) {
            log.info("Similar sprint search for {}: only {} embedding(s) indexed for project {}",
                sprintId, candidates.size(), projectId);
            return List.of();
        }

        Map<Long, SprintInsight> insightBySprint = new HashMap<>();
        for (SprintInsight si : sprintInsightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId)) {
            if (si.getSprintId() != null && si.getInsightsJson() != null && !si.getInsightsJson().isBlank()) {
                insightBySprint.put(si.getSprintId(), si);
            }
        }

        List<Map.Entry<SprintInsightEmbedding, Double>> scored = candidates.stream()
            .filter(c -> c.getSprintId() != null && !c.getSprintId().equals(sprintId))
            .map(c -> {
                try {
                    double[] stored = parseVector(c.getEmbedding());
                    double similarity = cosineSimilarity(sourceVector, stored);
                    return Map.entry(c, similarity);
                } catch (Exception e) {
                    return Map.entry(c, 0.0);
                }
            })
            .sorted((a, b) -> Double.compare(b.getValue(), a.getValue()))
            .collect(Collectors.toList());

        List<Map.Entry<SprintInsightEmbedding, Double>> filtered = scored.stream()
            .filter(e -> e.getValue() >= minSimilarity)
            .limit(topK)
            .collect(Collectors.toList());

        if (filtered.isEmpty() && !scored.isEmpty()) {
            filtered = scored.stream()
                .filter(e -> e.getValue() >= INSIGHT_SIMILARITY_FLOOR)
                .limit(topK)
                .collect(Collectors.toList());
        }

        return filtered.stream()
            .map(e -> toSimilarMatch(e.getKey(), e.getValue(), insightBySprint.get(e.getKey().getSprintId())))
            .collect(Collectors.toList());
    }

    /** Backfill embeddings for all successful insights in a project. */
    public int backfillProjectInsightEmbeddings(Long projectId) {
        if (projectId == null) {
            return 0;
        }
        int count = 0;
        for (SprintInsight insight : sprintInsightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId)) {
            if (insight.getErrorMessage() != null
                    || insight.getInsightsJson() == null
                    || insight.getInsightsJson().isBlank()) {
                continue;
            }
            embedSprintInsight(insight);
            count++;
        }
        return count;
    }

    /** Embeds any project insights that do not yet have a vector (lazy index on first similar search). */
    @Transactional
    public void ensureProjectInsightEmbeddings(Long projectId) {
        if (projectId == null || !geminiApiConfiguration.isConfigured()) {
            return;
        }
        for (SprintInsight insight : sprintInsightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId)) {
            if (insight.getSprintId() == null
                    || insight.getErrorMessage() != null
                    || insight.getInsightsJson() == null
                    || insight.getInsightsJson().isBlank()) {
                continue;
            }
            Optional<SprintInsightEmbedding> existing =
                sprintInsightEmbeddingRepository.findBySprintId(insight.getSprintId());
            if (existing.isEmpty() || isInsightEmbeddingStale(insight, existing.get())) {
                embedSprintInsight(insight);
            }
        }
    }

    private SimilarSprintInsightMatch toSimilarMatch(
            SprintInsightEmbedding embedding,
            double similarity,
            SprintInsight insight) {
        String snippet = "";
        String topSeverity = null;
        LocalDateTime generatedAt = insight != null ? insight.getGeneratedAt() : embedding.getCreatedAt();
        if (insight != null && insight.getInsightsJson() != null) {
            try {
                JsonNode root = mapper.readTree(insight.getInsightsJson());
                snippet = InsightEmbeddingTextBuilder.buildDisplaySnippet(root);
                JsonNode alerts = root.get("alerts");
                if (alerts != null && alerts.isArray() && alerts.size() > 0) {
                    topSeverity = alerts.get(0).path("severity").asText(null);
                }
            } catch (Exception ignored) {
                snippet = embedding.getTextChunk() != null
                    ? InsightEmbeddingTextBuilder.truncate(embedding.getTextChunk())
                    : "";
            }
        }
        return new SimilarSprintInsightMatch(
            embedding.getSprintId(),
            embedding.getProjectId(),
            Math.round(similarity * 1000.0) / 1000.0,
            snippet,
            topSeverity,
            generatedAt);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LLAMADA A GEMINI EMBEDDING API
    // ─────────────────────────────────────────────────────────────────────────

    private double[] generateEmbedding(String texto) throws Exception {
        geminiApiConfiguration.requireConfigured();

        String body = mapper.writeValueAsString(Map.of(
            "model", "models/gemini-embedding-001",
            "content", Map.of(
                "parts", List.of(Map.of("text", texto))
            )
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(EMBEDDING_URL + "?key=" + geminiApiConfiguration.getApiKey()))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(30))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Embedding API error " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = mapper.readTree(response.body());
        JsonNode values = root.path("embedding").path("values");

        if (!values.isArray()) {
            throw new RuntimeException("Unexpected embedding response shape.");
        }

        double[] vector = new double[values.size()];
        for (int i = 0; i < values.size(); i++) {
            vector[i] = values.get(i).asDouble();
        }
        return vector;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private String buildTaskChunk(Task task) {
        StringBuilder sb = new StringBuilder();
        if (task.getTitle() != null)          sb.append("Task: ").append(task.getTitle()).append(". ");
        if (task.getStatus() != null)         sb.append("Status: ").append(task.getStatus()).append(". ");
        if (task.getPriority() != null)       sb.append("Priority: ").append(task.getPriority()).append(". ");
        if (task.getClassification() != null) sb.append("Type: ").append(task.getClassification()).append(". ");
        if (task.getDueDate() != null)        sb.append("Due: ").append(task.getDueDate().toLocalDate()).append(". ");
        return sb.toString().trim();
    }

    private double[] parseVector(String json) throws Exception {
        JsonNode arr = mapper.readTree(json);
        double[] v = new double[arr.size()];
        for (int i = 0; i < arr.size(); i++) {
            v[i] = arr.get(i).asDouble();
        }
        return v;
    }

    private double cosineSimilarity(double[] a, double[] b) {
        if (a.length != b.length) return 0.0;
        double dot = 0.0, normA = 0.0, normB = 0.0;
        for (int i = 0; i < a.length; i++) {
            dot   += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0.0 || normB == 0.0) return 0.0;
        return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}