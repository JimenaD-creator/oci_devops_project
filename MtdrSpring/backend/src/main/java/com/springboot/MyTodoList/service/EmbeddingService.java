package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.config.GeminiApiConfiguration;
import com.springboot.MyTodoList.dto.SimilarSprintInsightMatch;
import com.springboot.MyTodoList.model.SprintInsight;
import com.springboot.MyTodoList.model.SprintInsightEmbedding;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.TaskEmbedding;
import com.springboot.MyTodoList.repository.SprintInsightEmbeddingRepository;
import com.springboot.MyTodoList.repository.SprintInsightRepository;
import com.springboot.MyTodoList.repository.TaskEmbeddingRepository;
import com.springboot.MyTodoList.service.vector.SprintInsightEmbeddingVectorStore;
import com.springboot.MyTodoList.service.vector.TaskEmbeddingVectorStore;
import com.springboot.MyTodoList.service.vector.ScoredSprintInsightEmbedding;
import com.springboot.MyTodoList.service.vector.VectorSearchBackend;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    /** Minimum cosine similarity to surface a match in the UI. */
    public static final double DEFAULT_INSIGHT_SIMILARITY_THRESHOLD = 0.55;

    /** When nothing passes the default threshold, still show strong relative matches above this floor. */
    private static final double INSIGHT_SIMILARITY_FLOOR = 0.42;

    private static final String EMBEDDING_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

    @Autowired
    private GeminiApiConfiguration geminiApiConfiguration;

    @Autowired
    private TaskEmbeddingRepository embeddingRepository;

    @Autowired
    private SprintInsightEmbeddingRepository insightEmbeddingRepository;

    @Autowired
    private SprintInsightRepository insightRepository;

    @Autowired
    private TaskEmbeddingVectorStore vectorStore;

    @Autowired
    private SprintInsightEmbeddingVectorStore insightVectorStore;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();

    // ─────────────────────────────────────────────────────────────────────────
    // TASK EMBEDDINGS (RAG)
    // ─────────────────────────────────────────────────────────────────────────

    public void embedTask(Task task, Long sprintId) throws Exception {
        String texto = buildTaskChunk(task);
        double[] vector = generateEmbedding(texto);

        embeddingRepository.deleteByTaskId(task.getId());

        TaskEmbedding te = new TaskEmbedding();
        te.setTaskId(task.getId());
        te.setSprintId(sprintId);
        te.setTextoChunk(texto);
        te.setCreatedAt(LocalDateTime.now());

        String embeddingJson = mapper.writeValueAsString(vector);
        vectorStore.save(te, vector, embeddingJson);

        log.debug("Embedded task {} for sprint {}", task.getId(), sprintId);
    }

    public List<TaskEmbedding> findRelevantTasks(String query, Long sprintId, int topK) throws Exception {
        return findRelevantTasks(query, sprintId, null, topK);
    }

    public List<TaskEmbedding> findRelevantTasks(
            String query, Long sprintId, String taskStatus, int topK) throws Exception {
        double[] queryVector = generateEmbedding(query);
        return vectorStore.findSimilar(queryVector, sprintId, taskStatus, topK);
    }

    public VectorSearchBackend getVectorSearchBackend() {
        return vectorStore.getActiveBackend();
    }

    public VectorSearchBackend getInsightVectorSearchBackend() {
        return insightVectorStore.getActiveBackend();
    }

    public boolean hasStoredVector(TaskEmbedding row) {
        return vectorStore.hasStoredVector(row);
    }

    public boolean hasStoredInsightVector(SprintInsightEmbedding row) {
        return insightVectorStore.hasStoredVector(row);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SPRINT INSIGHT EMBEDDINGS (Oracle VECTOR or application cosine on JSON CLOB)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional
    public void embedSprintInsight(SprintInsight insight) {
        if (insight == null || insight.getInsightsJson() == null || insight.getInsightsJson().isBlank()) {
            return;
        }
        try {
            JsonNode root = mapper.readTree(insight.getInsightsJson());
            String chunk = InsightEmbeddingTextBuilder.buildFromInsightsJson(root);
            if (chunk.isBlank()) {
                log.warn("Skipping insight embedding for sprint {} — empty chunk", insight.getSprintId());
                return;
            }
            double[] vector = generateEmbedding(chunk);
            insightEmbeddingRepository.deleteBySprintId(insight.getSprintId());

            SprintInsightEmbedding row = new SprintInsightEmbedding();
            row.setSprintId(insight.getSprintId());
            row.setProjectId(insight.getProjectId());
            row.setTextChunk(chunk);
            row.setCreatedAt(LocalDateTime.now());
            insightVectorStore.save(row, vector, mapper.writeValueAsString(vector));
            log.info("Embedded sprint insight for sprint {} (backend={})",
                insight.getSprintId(), insightVectorStore.getActiveBackend());
        } catch (Exception e) {
            log.warn("Failed to embed sprint insight for sprint {}: {}", insight.getSprintId(), e.getMessage());
        }
    }

    public List<SimilarSprintInsightMatch> findSimilarSprintInsights(
            Long sprintId, int topK, double threshold) throws Exception {
        SprintInsightEmbedding source = insightEmbeddingRepository.findBySprintId(sprintId)
            .orElseThrow(() -> new IllegalArgumentException("No embedding indexed for sprint " + sprintId));
        double[] sourceVector = parseVectorJson(source.getEmbedding());
        if (sourceVector == null) {
            return List.of();
        }

        List<ScoredSprintInsightEmbedding> scored = insightVectorStore.rankSimilarInProject(
            sourceVector, source.getProjectId(), sprintId, Math.max(topK * 4, 20));

        List<ScoredSprintInsightEmbedding> filtered = scored.stream()
            .filter(s -> s.getSimilarity() >= threshold)
            .limit(topK)
            .collect(Collectors.toList());

        if (filtered.isEmpty()) {
            filtered = scored.stream()
                .filter(s -> s.getSimilarity() >= INSIGHT_SIMILARITY_FLOOR)
                .limit(topK)
                .collect(Collectors.toList());
        }

        List<SimilarSprintInsightMatch> matches = new ArrayList<>();
        for (ScoredSprintInsightEmbedding item : filtered) {
            matches.add(toInsightMatch(item.getEmbedding(), item.getSimilarity()));
        }
        return matches;
    }

    public List<SprintInsightEmbedding> findRelevantSprintInsights(String query, Long projectId, int topK)
            throws Exception {
        double[] queryVector = generateEmbedding(query);
        return insightVectorStore.findRelevantInProject(queryVector, projectId, topK);
    }

    @Transactional
    public int backfillProjectInsightEmbeddings(Long projectId) throws Exception {
        List<SprintInsight> insights = insightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId);
        int embedded = 0;
        for (SprintInsight insight : insights) {
            if (insight.getInsightsJson() == null || insight.getInsightsJson().isBlank()) {
                continue;
            }
            embedSprintInsight(insight);
            embedded++;
        }
        return embedded;
    }

    public int countIndexedInsightsForProject(Long projectId) {
        return insightEmbeddingRepository.findByProjectId(projectId).size();
    }

    public int countInsightsWithJsonForProject(Long projectId) {
        return (int) insightRepository.findByProjectIdOrderByGeneratedAtDesc(projectId).stream()
            .filter(i -> i.getInsightsJson() != null && !i.getInsightsJson().isBlank())
            .count();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GEMINI EMBEDDING API
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

    private double[] parseVectorJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            JsonNode values = mapper.readTree(json);
            if (!values.isArray()) {
                return null;
            }
            double[] vector = new double[values.size()];
            for (int i = 0; i < values.size(); i++) {
                vector[i] = values.get(i).asDouble();
            }
            return vector;
        } catch (Exception e) {
            log.warn("Could not parse insight embedding JSON: {}", e.getMessage());
            return null;
        }
    }

    private SimilarSprintInsightMatch toInsightMatch(SprintInsightEmbedding row, double similarity) {
        String snippet = row.getTextChunk();
        String topAlertSeverity = null;
        LocalDateTime generatedAt = null;
        Optional<SprintInsight> insight = insightRepository.findBySprintId(row.getSprintId());
        if (insight.isPresent()) {
            generatedAt = insight.get().getGeneratedAt();
            try {
                JsonNode root = mapper.readTree(insight.get().getInsightsJson());
                snippet = InsightEmbeddingTextBuilder.buildDisplaySnippet(root);
                topAlertSeverity = extractTopAlertSeverity(root);
            } catch (Exception e) {
                log.debug("Could not parse insight JSON for sprint {}: {}", row.getSprintId(), e.getMessage());
            }
        }
        return new SimilarSprintInsightMatch(
            row.getSprintId(),
            row.getProjectId(),
            similarity,
            snippet,
            topAlertSeverity,
            generatedAt);
    }

    private String extractTopAlertSeverity(JsonNode root) {
        JsonNode alerts = root.get("alerts");
        if (alerts == null || !alerts.isArray()) {
            return null;
        }
        int bestRank = -1;
        String best = null;
        for (JsonNode alert : alerts) {
            String severity = alert.path("severity").asText("info").toLowerCase(Locale.ROOT);
            int rank = alertSeverityRank(severity);
            if (rank > bestRank) {
                bestRank = rank;
                best = severity;
            }
        }
        return best;
    }

    private int alertSeverityRank(String severity) {
        if ("critical".equals(severity)) {
            return 3;
        }
        if ("warning".equals(severity)) {
            return 2;
        }
        if ("info".equals(severity)) {
            return 1;
        }
        return 0;
    }
}
