package com.springboot.MyTodoList.dto;

import com.springboot.MyTodoList.model.Task;
import java.time.LocalDateTime;

public class DashboardTaskDto {
    private Long id;
    private IdRefDto assignedSprint;
    private String classification;
    private String title;
    private String description;
    private String status;
    private String priority;
    private Double assignedHours;
    private LocalDateTime startDate;
    private LocalDateTime dueDate;
    private LocalDateTime finishDate;
    private LocalDateTime updatedAt;

    public static DashboardTaskDto from(Task task) {
        DashboardTaskDto dto = new DashboardTaskDto();
        dto.id = task.getId();
        if (task.getAssignedSprint() != null && task.getAssignedSprint().getId() != null) {
            dto.assignedSprint = new IdRefDto(task.getAssignedSprint().getId());
        }
        dto.classification = task.getClassification();
        dto.title = task.getTitle();
        dto.description = task.getDescription();
        dto.status = task.getStatus();
        dto.priority = task.getPriority();
        dto.assignedHours = task.getAssignedHours();
        dto.startDate = task.getStartDate();
        dto.dueDate = task.getDueDate();
        dto.finishDate = task.getFinishDate();
        dto.updatedAt = task.getUpdatedAt();
        return dto;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public IdRefDto getAssignedSprint() {
        return assignedSprint;
    }

    public void setAssignedSprint(IdRefDto assignedSprint) {
        this.assignedSprint = assignedSprint;
    }

    public String getClassification() {
        return classification;
    }

    public void setClassification(String classification) {
        this.classification = classification;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public Double getAssignedHours() {
        return assignedHours;
    }

    public void setAssignedHours(Double assignedHours) {
        this.assignedHours = assignedHours;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
    }

    public LocalDateTime getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDateTime dueDate) {
        this.dueDate = dueDate;
    }

    public LocalDateTime getFinishDate() {
        return finishDate;
    }

    public void setFinishDate(LocalDateTime finishDate) {
        this.finishDate = finishDate;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
