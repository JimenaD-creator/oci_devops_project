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
import com.springboot.MyTodoList.service.vector.TaskEmbeddingVectorStore;
import com.springboot.MyTodoList.service.vector.VectorSearchBackend;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

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
    private TaskEmbeddingVectorStore vectorStore;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(30))
        .build();

    // ─────────────────────────────────────────────────────────────────────────
    // GENERAR Y GUARDAR EMBEDDING DE UNA TAREA
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

        System.out.println("[EmbeddingService] Embedded task " + task.getId() + ": " + texto);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BUSCAR TAREAS RELEVANTES PARA UNA PREGUNTA (RAG)
    // ─────────────────────────────────────────────────────────────────────────

    public List<TaskEmbedding> findRelevantTasks(String query, Long sprintId, int topK) throws Exception {
        return findRelevantTasks(query, sprintId, null, topK);
    }

    /**
     * Hybrid semantic search: vector similarity plus optional relational {@code taskStatus} filter.
     */
    public List<TaskEmbedding> findRelevantTasks(
            String query, Long sprintId, String taskStatus, int topK) throws Exception {
        double[] queryVector = generateEmbedding(query);
        return vectorStore.findSimilar(queryVector, sprintId, taskStatus, topK);
    }

    public VectorSearchBackend getVectorSearchBackend() {
        return vectorStore.getActiveBackend();
    }

    public boolean hasStoredVector(TaskEmbedding row) {
        return vectorStore.hasStoredVector(row);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LLAMADA A GEMINI EMBEDDING API
    // ─────────────────────────────────────────────────────────────────────────

    private double[] generateEmbedding(String texto) throws Exception {
        geminiApiConfiguration.requireConfigured();

        String body = mapper.writeValueAsString(java.util.Map.of(
            "model", "models/gemini-embedding-001",
            "content", java.util.Map.of(
                "parts", java.util.List.of(java.util.Map.of("text", texto))
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
}
