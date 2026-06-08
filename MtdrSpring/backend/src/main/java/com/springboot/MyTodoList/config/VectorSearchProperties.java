package com.springboot.MyTodoList.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "vector.search")
public class VectorSearchProperties {

    public enum Mode {
        AUTO,
        ORACLE,
        APPLICATION
    }

    private Mode mode = Mode.AUTO;
    private String schema = "MANAGER";
    private String taskTable = "TASK";
    private String vectorColumn = "EMBEDDING_VEC";
    private String legacyJsonColumn = "EMBEDDING";
    private int dimensions = 768;
    private String vectorIndexName = "TASK_EMBEDDINGS_VEC_IDX";
    private String insightVectorIndexName = "SPRINT_INSIGHT_EMBEDDINGS_VEC_IDX";
    private int indexTargetAccuracy = 95;

    public Mode getMode() {
        return mode;
    }

    public void setMode(Mode mode) {
        this.mode = mode != null ? mode : Mode.AUTO;
    }

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        if (schema != null && !schema.isBlank()) {
            this.schema = schema.trim();
        }
    }

    public String getTaskTable() {
        return taskTable;
    }

    public void setTaskTable(String taskTable) {
        if (taskTable != null && !taskTable.isBlank()) {
            this.taskTable = taskTable.trim();
        }
    }

    public String getVectorColumn() {
        return vectorColumn;
    }

    public void setVectorColumn(String vectorColumn) {
        if (vectorColumn != null && !vectorColumn.isBlank()) {
            this.vectorColumn = vectorColumn.trim();
        }
    }

    public String getLegacyJsonColumn() {
        return legacyJsonColumn;
    }

    public void setLegacyJsonColumn(String legacyJsonColumn) {
        if (legacyJsonColumn != null && !legacyJsonColumn.isBlank()) {
            this.legacyJsonColumn = legacyJsonColumn.trim();
        }
    }

    public int getDimensions() {
        return dimensions;
    }

    public void setDimensions(int dimensions) {
        if (dimensions > 0) {
            this.dimensions = dimensions;
        }
    }

    public String getVectorIndexName() {
        return vectorIndexName;
    }

    public void setVectorIndexName(String vectorIndexName) {
        if (vectorIndexName != null && !vectorIndexName.isBlank()) {
            this.vectorIndexName = vectorIndexName.trim();
        }
    }

    public String getInsightVectorIndexName() {
        return insightVectorIndexName;
    }

    public void setInsightVectorIndexName(String insightVectorIndexName) {
        if (insightVectorIndexName != null && !insightVectorIndexName.isBlank()) {
            this.insightVectorIndexName = insightVectorIndexName.trim();
        }
    }

    public int getIndexTargetAccuracy() {
        return indexTargetAccuracy;
    }

    public void setIndexTargetAccuracy(int indexTargetAccuracy) {
        if (indexTargetAccuracy > 0 && indexTargetAccuracy <= 100) {
            this.indexTargetAccuracy = indexTargetAccuracy;
        }
    }

    public String qualifiedEmbeddingsTable() {
        return schema + ".TASK_EMBEDDINGS";
    }

    public String qualifiedInsightEmbeddingsTable() {
        return schema + ".SPRINT_INSIGHT_EMBEDDINGS";
    }
}
