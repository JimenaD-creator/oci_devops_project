package com.springboot.MyTodoList.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.TaskEmbedding;
import com.springboot.MyTodoList.repository.TaskEmbeddingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    private static final String EMBEDDING_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";



    @Autowired
    private TaskEmbeddingRepository embeddingRepository;

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

    // ─────────────────────────────────────────────────────────────────────────
    // LLAMADA A GEMINI EMBEDDING API
    // ─────────────────────────────────────────────────────────────────────────

    private double[] generateEmbedding(String texto) throws Exception {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new IllegalStateException("Gemini API key not configured.");
        }

        String body = mapper.writeValueAsString(Map.of(
            "model", "models/gemini-embedding-001",
            "content", Map.of(
                "parts", List.of(Map.of("text", texto))
            )
        ));

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(EMBEDDING_URL + "?key=" + geminiApiKey))
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