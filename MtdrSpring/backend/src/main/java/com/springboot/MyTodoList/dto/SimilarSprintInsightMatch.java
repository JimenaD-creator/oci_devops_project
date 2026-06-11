package com.springboot.MyTodoList.dto;

import java.time.LocalDateTime;

/** One semantically similar sprint insight match within a project. */
public class SimilarSprintInsightMatch {

    private Long sprintId;
    private Long projectId;
    private double similarity;
    private String snippet;
    private String topAlertSeverity;
    private LocalDateTime generatedAt;

    public SimilarSprintInsightMatch() {}

    public SimilarSprintInsightMatch(
            Long sprintId,
            Long projectId,
            double similarity,
            String snippet,
            String topAlertSeverity,
            LocalDateTime generatedAt) {
        this.sprintId = sprintId;
        this.projectId = projectId;
        this.similarity = similarity;
        this.snippet = snippet;
        this.topAlertSeverity = topAlertSeverity;
        this.generatedAt = generatedAt;
    }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public double getSimilarity() { return similarity; }
    public void setSimilarity(double similarity) { this.similarity = similarity; }

    public String getSnippet() { return snippet; }
    public void setSnippet(String snippet) { this.snippet = snippet; }

    public String getTopAlertSeverity() { return topAlertSeverity; }
    public void setTopAlertSeverity(String topAlertSeverity) { this.topAlertSeverity = topAlertSeverity; }

    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
}
