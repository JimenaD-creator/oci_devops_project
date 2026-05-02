package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "TASK_EMBEDDINGS", schema = "MANAGER")
public class TaskEmbedding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "TASK_ID", nullable = false)
    private Long taskId;

    @Column(name = "SPRINT_ID")
    private Long sprintId;

    @Column(name = "TEXTO_CHUNK", length = 4000)
    private String textoChunk;

    @Lob
    @Column(name = "EMBEDDING", columnDefinition = "CLOB")
    private String embedding;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    // Getters y setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public String getTextoChunk() { return textoChunk; }
    public void setTextoChunk(String textoChunk) { this.textoChunk = textoChunk; }

    public String getEmbedding() { return embedding; }
    public void setEmbedding(String embedding) { this.embedding = embedding; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}