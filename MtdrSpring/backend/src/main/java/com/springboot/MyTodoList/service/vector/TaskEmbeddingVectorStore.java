package com.springboot.MyTodoList.service.vector;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.config.VectorSearchProperties;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.TaskEmbedding;
import com.springboot.MyTodoList.repository.TaskEmbeddingRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import oracle.jdbc.OracleType;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Persists task embeddings and runs similarity search via Oracle VECTOR_DISTANCE or in-app cosine.
 */
@Service
public class TaskEmbeddingVectorStore {

    private static final Logger log = LoggerFactory.getLogger(TaskEmbeddingVectorStore.class);

    private final JdbcTemplate jdbcTemplate;
    private final TaskEmbeddingRepository embeddingRepository;
    private final TaskRepository taskRepository;
    private final VectorSearchProperties properties;
    private final ObjectMapper mapper = new ObjectMapper();

    private volatile VectorSearchBackend activeBackend = VectorSearchBackend.APPLICATION;
    private volatile boolean oracleVectorColumnPresent;

    public TaskEmbeddingVectorStore(
            JdbcTemplate jdbcTemplate,
            TaskEmbeddingRepository embeddingRepository,
            TaskRepository taskRepository,
            VectorSearchProperties properties) {
        this.jdbcTemplate = jdbcTemplate;
        this.embeddingRepository = embeddingRepository;
        this.taskRepository = taskRepository;
        this.properties = properties;
    }

    @PostConstruct
    void resolveBackend() {
        oracleVectorColumnPresent = detectOracleVectorColumn();
        activeBackend = chooseBackend(oracleVectorColumnPresent);
        log.info("Task embedding vector search backend={} (mode={}, oracleColumn={})",
            activeBackend, properties.getMode(), oracleVectorColumnPresent);
    }

    public VectorSearchBackend getActiveBackend() {
        return activeBackend;
    }

    public boolean hasStoredVector(TaskEmbedding row) {
        if (row == null) {
            return false;
        }
        if (activeBackend == VectorSearchBackend.ORACLE && oracleVectorColumnPresent) {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + properties.qualifiedEmbeddingsTable()
                    + " WHERE ID = ? AND " + properties.getVectorColumn() + " IS NOT NULL",
                Integer.class,
                row.getId());
            return count != null && count > 0;
        }
        return row.getEmbedding() != null && !row.getEmbedding().isBlank();
    }

    public void save(TaskEmbedding row, double[] vector, String embeddingJson) {
        row.setEmbedding(embeddingJson);
        TaskEmbedding saved = embeddingRepository.save(row);
        if (activeBackend == VectorSearchBackend.ORACLE && oracleVectorColumnPresent) {
            writeOracleVector(saved.getId(), vector);
        }
    }

    public List<TaskEmbedding> findSimilar(
            double[] queryVector, Long sprintId, String taskStatus, int topK) {
        int limit = Math.max(1, topK);
        if (activeBackend == VectorSearchBackend.ORACLE && oracleVectorColumnPresent) {
            try {
                return findSimilarOracle(queryVector, sprintId, taskStatus, limit);
            } catch (Exception e) {
                log.warn("Oracle vector search failed ({}), falling back to application cosine: {}",
                    e.getMessage(), e.getClass().getSimpleName());
                return findSimilarApplication(queryVector, sprintId, taskStatus, limit);
            }
        }
        return findSimilarApplication(queryVector, sprintId, taskStatus, limit);
    }

    private VectorSearchBackend chooseBackend(boolean columnPresent) {
        VectorSearchProperties.Mode mode = properties.getMode();
        if (mode == VectorSearchProperties.Mode.ORACLE) {
            if (!columnPresent) {
                throw new IllegalStateException(
                    "vector.search.mode=oracle but " + properties.getVectorColumn()
                        + " column is missing on " + properties.qualifiedEmbeddingsTable());
            }
            return VectorSearchBackend.ORACLE;
        }
        if (mode == VectorSearchProperties.Mode.APPLICATION) {
            return VectorSearchBackend.APPLICATION;
        }
        return columnPresent ? VectorSearchBackend.ORACLE : VectorSearchBackend.APPLICATION;
    }

    private boolean detectOracleVectorColumn() {
        try {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ALL_TAB_COLUMNS "
                    + "WHERE OWNER = ? AND TABLE_NAME = 'TASK_EMBEDDINGS' AND COLUMN_NAME = ?",
                Integer.class,
                properties.getSchema().toUpperCase(Locale.ROOT),
                properties.getVectorColumn().toUpperCase(Locale.ROOT));
            return count != null && count > 0;
        } catch (Exception e) {
            log.debug("Oracle vector column probe skipped: {}", e.getMessage());
            return false;
        }
    }

    private void writeOracleVector(Long rowId, double[] vector) {
        String sql = "UPDATE " + properties.qualifiedEmbeddingsTable()
            + " SET " + properties.getVectorColumn() + " = ? WHERE ID = ?";
        jdbcTemplate.execute((Connection conn) -> {
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setObject(1, vector, OracleType.VECTOR_FLOAT64);
                ps.setLong(2, rowId);
                ps.executeUpdate();
            }
            return null;
        });
    }

    private List<TaskEmbedding> findSimilarOracle(
            double[] queryVector, Long sprintId, String taskStatus, int topK) {
        String schema = properties.getSchema();
        String taskTable = properties.getTaskTable();
        String vecCol = properties.getVectorColumn();
        String table = properties.qualifiedEmbeddingsTable();

        StringBuilder sql = new StringBuilder();
        sql.append("SELECT te.ID FROM ").append(table).append(" te");
        if (taskStatus != null && !taskStatus.isBlank()) {
            sql.append(" JOIN ").append(schema).append('.').append(taskTable).append(" t ON t.ID = te.TASK_ID");
        }
        sql.append(" WHERE te.").append(vecCol).append(" IS NOT NULL");
        if (sprintId != null) {
            sql.append(" AND te.SPRINT_ID = ?");
        }
        if (taskStatus != null && !taskStatus.isBlank()) {
            sql.append(" AND UPPER(t.STATUS) = UPPER(?)");
        }
        sql.append(" ORDER BY VECTOR_DISTANCE(te.").append(vecCol).append(", ?, COSINE)")
            .append(" FETCH FIRST ").append(topK).append(" ROWS ONLY");

        List<Long> ids = jdbcTemplate.execute((Connection conn) -> {
            try (PreparedStatement ps = conn.prepareStatement(sql.toString())) {
                int idx = 1;
                if (sprintId != null) {
                    ps.setLong(idx++, sprintId);
                }
                if (taskStatus != null && !taskStatus.isBlank()) {
                    ps.setString(idx++, taskStatus.trim());
                }
                ps.setObject(idx, queryVector, OracleType.VECTOR_FLOAT64);
                try (ResultSet rs = ps.executeQuery()) {
                    List<Long> result = new ArrayList<>();
                    while (rs.next()) {
                        result.add(rs.getLong("ID"));
                    }
                    return result;
                }
            }
        });

        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, TaskEmbedding> byId = embeddingRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(TaskEmbedding::getId, te -> te));
        return ids.stream().map(byId::get).filter(Objects::nonNull).collect(Collectors.toList());
    }

    private List<TaskEmbedding> findSimilarApplication(
            double[] queryVector, Long sprintId, String taskStatus, int topK) {
        List<TaskEmbedding> candidates = sprintId != null
            ? embeddingRepository.findBySprintId(sprintId)
            : embeddingRepository.findAll();

        if (taskStatus != null && !taskStatus.isBlank()) {
            String normalized = taskStatus.trim();
            Map<Long, String> statusByTaskId = new HashMap<>();
            candidates = candidates.stream()
                .filter(te -> {
                    String status = statusByTaskId.computeIfAbsent(te.getTaskId(), taskId ->
                        taskRepository.findById(taskId).map(Task::getStatus).orElse(null));
                    return status != null && status.trim().equalsIgnoreCase(normalized);
                })
                .collect(Collectors.toList());
        }

        return candidates.stream()
            .map(te -> {
                double[] stored = parseEmbedding(te.getEmbedding());
                if (stored == null) {
                    return null;
                }
                return Map.entry(te, VectorCosineSimilarity.cosineSimilarity(queryVector, stored));
            })
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingDouble((Map.Entry<TaskEmbedding, Double> e) -> e.getValue()).reversed())
            .limit(topK)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }

    private double[] parseEmbedding(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            List<Double> values = mapper.readValue(json, new TypeReference<List<Double>>() {});
            double[] vector = new double[values.size()];
            for (int i = 0; i < values.size(); i++) {
                vector[i] = values.get(i);
            }
            return vector;
        } catch (Exception e) {
            log.warn("Could not parse embedding JSON: {}", e.getMessage());
            return null;
        }
    }
}
