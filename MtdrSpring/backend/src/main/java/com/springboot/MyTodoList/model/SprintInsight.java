package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Persists AI-generated insights for a sprint.
 * One row per sprint — overwritten on each regeneration request.
 */
@Entity
@Table(name = "SPRINT_INSIGHTS")
public class SprintInsight {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** FK to SPRINT.ID */
    @Column(name = "SPRINT_ID", nullable = false, unique = true)
    private Long sprintId;

    /** FK to PROJECT via sprint — denormalized for quick project-level queries */
    @Column(name = "PROJECT_ID", nullable = false)
    private Long projectId;

    /**
     * Full JSON blob returned by Gemini, stored as-is.
     * NULL when the last generation attempt failed (see errorMessage).
     */
    @Lob
    @Column(name = "INSIGHTS_JSON", nullable = true)
    private String insightsJson;

    /**
     * Human-readable error code when generation fails.
     * Codes: QUOTA_EXCEEDED | API_KEY_MISSING | MODEL_NOT_FOUND |
     *        SPRINT_NOT_FOUND | NO_PROJECT_ASSIGNED | GENERATION_FAILED
     * NULL when insights were generated successfully.
     */
    @Column(name = "ERROR_MESSAGE", nullable = true, length = 512)
    private String errorMessage;

    /** When insights (or the error) were last generated */
    @Column(name = "GENERATED_AT", nullable = false)
    private LocalDateTime generatedAt;

    /** Whether the manager has acknowledged/dismissed the alerts */
    @Column(name = "ACKNOWLEDGED", nullable = false)
    private boolean acknowledged = false;

    public SprintInsight() {}

    public SprintInsight(Long sprintId, Long projectId, String insightsJson) {
        this.sprintId    = sprintId;
        this.projectId   = projectId;
        this.insightsJson = insightsJson;
        this.generatedAt = LocalDateTime.now();
    }

    // ── Getters & Setters ──────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public String getInsightsJson() { return insightsJson; }
    public void setInsightsJson(String insightsJson) { this.insightsJson = insightsJson; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }

    public boolean isAcknowledged() { return acknowledged; }
    public void setAcknowledged(boolean acknowledged) { this.acknowledged = acknowledged; }
}