package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "TASK")
public class Task {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "ASSIGNED_SPRINT", nullable = false)
    private Sprint assignedSprint;
    
    @Column(name = "CLASSIFICATION", length = 50)
    private String classification;

    @Column(name = "TITLE", length = 255)
    private String title;

    @Column(name = "DESCRIPTION", length = 2000)
    private String description;
    
    @Column(name = "STATUS", length = 50)
    private String status;

    @Column(name = "PRIORITY", length = 20)
    private String priority;
    
    @Column(name = "ASSIGNED_HOURS")
    private Long assignedHours;
    
    @Column(name = "START_DATE", nullable = false)
    private LocalDateTime startDate;
    
    @Column(name = "DUE_DATE", nullable = false)
    private LocalDateTime dueDate;
    
    @Column(name = "FINISH_DATE", nullable = false)
    private LocalDateTime finishDate;
    
    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
    
    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;
    
    public Task() {}
    
    public Task(Sprint assignedSprint, LocalDateTime startDate, 
                LocalDateTime dueDate, LocalDateTime finishDate) {
        this.assignedSprint = assignedSprint;
        this.startDate = startDate;
        this.dueDate = dueDate;
        this.finishDate = finishDate;
    }
    
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Sprint getAssignedSprint() {
        return assignedSprint;
    }
    
    public void setAssignedSprint(Sprint assignedSprint) {
        this.assignedSprint = assignedSprint;
    }
    
    public String getClassification() {
        return classification;
    }
    
    public void setClassification(String classification) {
        this.classification = classification;
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
    
    public Long getAssignedHours() {
        return assignedHours;
    }
    
    public void setAssignedHours(Long assignedHours) {
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
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
