package com.springboot.MyTodoList.service.vector;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.config.VectorSearchProperties;
import com.springboot.MyTodoList.model.SprintInsightEmbedding;
import com.springboot.MyTodoList.repository.SprintInsightEmbeddingRepository;
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Persists sprint insight embeddings and runs similarity search via Oracle VECTOR_DISTANCE
 * or in-app cosine similarity on JSON CLOB.
 */
@Service
public class SprintInsightEmbeddingVectorStore {

    private static final Logger log = LoggerFactory.getLogger(SprintInsightEmbeddingVectorStore.class);
    private static final String INSIGHT_TABLE = "SPRINT_INSIGHT_EMBEDDINGS";

    private final JdbcTemplate jdbcTemplate;
    private final SprintInsightEmbeddingRepository embeddingRepository;
    private final VectorSearchProperties properties;
    private final ObjectMapper mapper = new ObjectMapper();

    private volatile VectorSearchBackend activeBackend = VectorSearchBackend.APPLICATION;
    private volatile boolean oracleVectorColumnPresent;

    public SprintInsightEmbeddingVectorStore(
            JdbcTemplate jdbcTemplate,
            SprintInsightEmbeddingRepository embeddingRepository,
            VectorSearchProperties properties) {
        this.jdbcTemplate = jdbcTemplate;
        this.embeddingRepository = embeddingRepository;
        this.properties = properties;
    }

    @PostConstruct
    void resolveBackend() {
        oracleVectorColumnPresent = detectOracleVectorColumn();
        activeBackend = chooseBackend(oracleVectorColumnPresent);
        log.info("Sprint insight vector search backend={} (mode={}, oracleColumn={})",
            activeBackend, properties.getMode(), oracleVectorColumnPresent);
    }

    public VectorSearchBackend getActiveBackend() {
        return activeBackend;
    }

    public boolean hasStoredVector(SprintInsightEmbedding row) {
        if (row == null) {
            return false;
        }
        if (activeBackend == VectorSearchBackend.ORACLE && oracleVectorColumnPresent) {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + properties.qualifiedInsightEmbeddingsTable()
                    + " WHERE ID = ? AND " + properties.getVectorColumn() + " IS NOT NULL",
                Integer.class,
                row.getId());
            return count != null && count > 0;
        }
        return row.getEmbedding() != null && !row.getEmbedding().isBlank();
    }

    public void save(SprintInsightEmbedding row, double[] vector, String embeddingJson) {
        row.setEmbedding(embeddingJson);
        SprintInsightEmbedding saved = embeddingRepository.save(row);
        if (activeBackend == VectorSearchBackend.ORACLE && oracleVectorColumnPresent) {
            writeOracleVector(saved.getId(), vector);
        }
    }

    public List<ScoredSprintInsightEmbedding> rankSimilarInProject(
            double[] referenceVector, Long projectId, Long excludeSprintId, int fetchLimit) {
        int limit = Math.max(1, fetchLimit);
        if (activeBackend == VectorSearchBackend.ORACLE && oracleVectorColumnPresent) {
            try {
                return rankSimilarOracle(referenceVector, projectId, excludeSprintId, limit);
            } catch (Exception e) {
                log.warn("Oracle insight vector search failed ({}), falling back to application cosine: {}",
                    e.getMessage(), e.getClass().getSimpleName());
                return rankSimilarApplication(referenceVector, projectId, excludeSprintId, limit);
            }
        }
        return rankSimilarApplication(referenceVector, projectId, excludeSprintId, limit);
    }

    public List<SprintInsightEmbedding> findRelevantInProject(
            double[] queryVector, Long projectId, int topK) {
        int limit = Math.max(1, topK);
        if (activeBackend == VectorSearchBackend.ORACLE && oracleVectorColumnPresent) {
            try {
                return findRelevantOracle(queryVector, projectId, limit);
            } catch (Exception e) {
                log.warn("Oracle insight query search failed ({}), falling back to application cosine: {}",
                    e.getMessage(), e.getClass().getSimpleName());
                return findRelevantApplication(queryVector, projectId, limit);
            }
        }
        return findRelevantApplication(queryVector, projectId, limit);
    }

    private VectorSearchBackend chooseBackend(boolean columnPresent) {
        VectorSearchProperties.Mode mode = properties.getMode();
        if (mode == VectorSearchProperties.Mode.ORACLE) {
            if (!columnPresent) {
                throw new IllegalStateException(
                    "vector.search.mode=oracle but " + properties.getVectorColumn()
                        + " column is missing on " + properties.qualifiedInsightEmbeddingsTable());
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
                    + "WHERE OWNER = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class,
                properties.getSchema().toUpperCase(Locale.ROOT),
                INSIGHT_TABLE,
                properties.getVectorColumn().toUpperCase(Locale.ROOT));
            return count != null && count > 0;
        } catch (Exception e) {
            log.debug("Oracle insight vector column probe skipped: {}", e.getMessage());
            return false;
        }
    }

    private void writeOracleVector(Long rowId, double[] vector) {
        String sql = "UPDATE " + properties.qualifiedInsightEmbeddingsTable()
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

    private List<ScoredSprintInsightEmbedding> rankSimilarOracle(
            double[] referenceVector, Long projectId, Long excludeSprintId, int fetchLimit) {
        String vecCol = properties.getVectorColumn();
        String table = properties.qualifiedInsightEmbeddingsTable();
        String sql = "SELECT sie.ID, "
            + "(1 - VECTOR_DISTANCE(sie." + vecCol + ", ?, COSINE)) AS SIMILARITY "
            + "FROM " + table + " sie "
            + "WHERE sie.PROJECT_ID = ? "
            + "AND sie.SPRINT_ID <> ? "
            + "AND sie." + vecCol + " IS NOT NULL "
            + "ORDER BY VECTOR_DISTANCE(sie." + vecCol + ", ?, COSINE) "
            + "FETCH FIRST " + fetchLimit + " ROWS ONLY";

        List<Map.Entry<Long, Double>> rows = jdbcTemplate.execute((Connection conn) -> {
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setObject(1, referenceVector, OracleType.VECTOR_FLOAT64);
                ps.setLong(2, projectId);
                ps.setLong(3, excludeSprintId);
                ps.setObject(4, referenceVector, OracleType.VECTOR_FLOAT64);
                try (ResultSet rs = ps.executeQuery()) {
                    List<Map.Entry<Long, Double>> result = new ArrayList<>();
                    while (rs.next()) {
                        result.add(Map.entry(rs.getLong("ID"), rs.getDouble("SIMILARITY")));
                    }
                    return result;
                }
            }
        });

        return toScoredRows(rows);
    }

    private List<SprintInsightEmbedding> findRelevantOracle(
            double[] queryVector, Long projectId, int topK) {
        String vecCol = properties.getVectorColumn();
        String table = properties.qualifiedInsightEmbeddingsTable();
        String sql = "SELECT sie.ID FROM " + table + " sie "
            + "WHERE sie.PROJECT_ID = ? AND sie." + vecCol + " IS NOT NULL "
            + "ORDER BY VECTOR_DISTANCE(sie." + vecCol + ", ?, COSINE) "
            + "FETCH FIRST " + topK + " ROWS ONLY";

        List<Long> ids = jdbcTemplate.execute((Connection conn) -> {
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                ps.setLong(1, projectId);
                ps.setObject(2, queryVector, OracleType.VECTOR_FLOAT64);
                try (ResultSet rs = ps.executeQuery()) {
                    List<Long> result = new ArrayList<>();
                    while (rs.next()) {
                        result.add(rs.getLong("ID"));
                    }
                    return result;
                }
            }
        });

        return loadEmbeddingsInOrder(ids);
    }

    private List<ScoredSprintInsightEmbedding> rankSimilarApplication(
            double[] referenceVector, Long projectId, Long excludeSprintId, int fetchLimit) {
        return embeddingRepository.findByProjectId(projectId).stream()
            .filter(row -> !row.getSprintId().equals(excludeSprintId))
            .map(row -> {
                double[] stored = parseEmbedding(row.getEmbedding());
                if (stored == null) {
                    return null;
                }
                return new ScoredSprintInsightEmbedding(
                    row, VectorCosineSimilarity.cosineSimilarity(referenceVector, stored));
            })
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingDouble(ScoredSprintInsightEmbedding::getSimilarity).reversed())
            .limit(fetchLimit)
            .collect(Collectors.toList());
    }

    private List<SprintInsightEmbedding> findRelevantApplication(
            double[] queryVector, Long projectId, int topK) {
        return embeddingRepository.findByProjectId(projectId).stream()
            .map(row -> {
                double[] stored = parseEmbedding(row.getEmbedding());
                if (stored == null) {
                    return null;
                }
                return Map.entry(row, VectorCosineSimilarity.cosineSimilarity(queryVector, stored));
            })
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingDouble((Map.Entry<SprintInsightEmbedding, Double> e) -> e.getValue()).reversed())
            .limit(topK)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }

    private List<ScoredSprintInsightEmbedding> toScoredRows(List<Map.Entry<Long, Double>> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<Long> ids = rows.stream().map(Map.Entry::getKey).collect(Collectors.toList());
        Map<Long, SprintInsightEmbedding> byId = embeddingRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(SprintInsightEmbedding::getId, row -> row));
        List<ScoredSprintInsightEmbedding> scored = new ArrayList<>();
        for (Map.Entry<Long, Double> row : rows) {
            SprintInsightEmbedding embedding = byId.get(row.getKey());
            if (embedding != null) {
                scored.add(new ScoredSprintInsightEmbedding(embedding, row.getValue()));
            }
        }
        return scored;
    }

    private List<SprintInsightEmbedding> loadEmbeddingsInOrder(List<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<Long, SprintInsightEmbedding> byId = embeddingRepository.findAllById(ids).stream()
            .collect(Collectors.toMap(SprintInsightEmbedding::getId, row -> row));
        return ids.stream().map(byId::get).filter(Objects::nonNull).collect(Collectors.toList());
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
            log.warn("Could not parse insight embedding JSON: {}", e.getMessage());
            return null;
        }
    }
}
