package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Semantic vector for a sprint's AI insight summary — used to find similar sprints within a project.
 */
@Entity
@Table(name = "SPRINT_INSIGHT_EMBEDDINGS", schema = "MANAGER")
public class SprintInsightEmbedding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "SPRINT_ID", nullable = false, unique = true)
    private Long sprintId;

    @Column(name = "PROJECT_ID", nullable = false)
    private Long projectId;

    @Column(name = "TEXT_CHUNK", length = 4000)
    private String textChunk;

    @Lob
    @Column(name = "EMBEDDING", columnDefinition = "CLOB")
    private String embedding;

    /** Native VECTOR column populated via JDBC when Oracle AI Vector Search is enabled. */
    // EMBEDDING_VEC VECTOR(768, FLOAT64) — not mapped by JPA; see SprintInsightEmbeddingVectorStore.

    @Column(name = "CREATED_AT", nullable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public String getTextChunk() { return textChunk; }
    public void setTextChunk(String textChunk) { this.textChunk = textChunk; }

    public String getEmbedding() { return embedding; }
    public void setEmbedding(String embedding) { this.embedding = embedding; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
