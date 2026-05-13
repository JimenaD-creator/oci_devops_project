package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.TaskEmbedding;
import com.springboot.MyTodoList.repository.TaskEmbeddingRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.service.EmbeddingService;
import com.springboot.MyTodoList.model.UserTask;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.stream.Collectors;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/embeddings")
public class EmbeddingController {

    @Autowired
    private EmbeddingService embeddingService;

    @Autowired
    private TaskEmbeddingRepository embeddingRepository;

    @Autowired
    private UserTaskRepository userTaskRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // INDEXAR TODAS LAS TAREAS DE UN SPRINT
    // POST /api/embeddings/sprint/{sprintId}/index
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/sprint/{sprintId}/index")
    public ResponseEntity<Map<String, Object>> indexSprint(@PathVariable Long sprintId) {
        Map<String, Object> response = new HashMap<>();
        try {
            List<UserTask> userTasks = userTaskRepository.findBySprintIdWithUserAndTask(sprintId);
            if (userTasks == null || userTasks.isEmpty()) {
                response.put("status", "empty");
                response.put("message", "No tasks found for sprint " + sprintId);
                return ResponseEntity.ok(response);
            }

            // Deduplicar por taskId
            Set<Long> seen = new HashSet<>();
            int indexed = 0;
            int failed = 0;

            for (UserTask ut : userTasks) {
                if (ut == null || ut.getTask() == null) continue;
                Task task = ut.getTask();
                if (!seen.add(task.getId())) continue;

                try {
                    embeddingService.embedTask(task, sprintId);
                    indexed++;
                } catch (Exception e) {
                    System.err.println("[EmbeddingController] Failed to embed task "
                        + task.getId() + ": " + e.getMessage());
                    failed++;
                }
            }

            response.put("status", "done");
            response.put("sprintId", sprintId);
            response.put("indexed", indexed);
            response.put("failed", failed);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VER EMBEDDINGS GUARDADOS DE UN SPRINT (para verificar que funcionó)
    // GET /api/embeddings/sprint/{sprintId}
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<Map<String, Object>> getEmbeddingsBySprint(@PathVariable Long sprintId) {
        Map<String, Object> response = new HashMap<>();
        try {
            List<TaskEmbedding> embeddings = embeddingRepository.findBySprintId(sprintId);
            response.put("sprintId", sprintId);
            response.put("count", embeddings.size());

            // Solo regresamos el texto, no el vector completo (son 768 números)
            List<Map<String, Object>> preview = embeddings.stream().map(te -> {
                Map<String, Object> m = new HashMap<>();
                m.put("taskId", te.getTaskId());
                m.put("textoChunk", te.getTextoChunk());
                m.put("createdAt", te.getCreatedAt());
                m.put("hasVector", te.getEmbedding() != null && !te.getEmbedding().isBlank());
                return m;
            }).collect(Collectors.toList());


            response.put("tasks", preview);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROBAR BUSQUEDA VECTORIAL
    // POST /api/embeddings/search
    // Body: { "query": "tareas bloqueadas", "sprintId": 1, "topK": 5 }
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/search")
    public ResponseEntity<Map<String, Object>> search(@RequestBody Map<String, Object> body) {
        Map<String, Object> response = new HashMap<>();
        try {
            String query = (String) body.get("query");
            Long sprintId = body.get("sprintId") != null
                ? Long.valueOf(body.get("sprintId").toString()) : null;
            int topK = body.get("topK") != null
                ? Integer.parseInt(body.get("topK").toString()) : 5;

            if (query == null || query.isBlank()) {
                response.put("error", "query is required");
                return ResponseEntity.badRequest().body(response);
            }

            List<TaskEmbedding> results = embeddingService.findRelevantTasks(query, sprintId, topK);

            response.put("query", query);
            response.put("sprintId", sprintId);
            response.put("results", results.stream().map(te -> {
                Map<String, Object> m = new HashMap<>();
                m.put("taskId", te.getTaskId());
                m.put("textoChunk", te.getTextoChunk());
                return m;
            }).collect(Collectors.toList()));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("error", e.getMessage());
            return ResponseEntity.status(500).body(response);
        }
    }
}