package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "TASK")
public class ToDoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private int ID;

    @Column(name = "TITLE")
    private String title;

    @Column(name = "DESCRIPTION")
    private String description;

    @Column(name = "PRIORITY")
    private String priority;

    @Column(name = "STATUS")
    private String status;

    @Column(name = "ASSIGNED_SPRINT")
    private Integer assignedSprint;

    @Column(name = "START_DATE")
    private OffsetDateTime startDate;

    @Column(name = "DUE_DATE") // La columna que falta
    private OffsetDateTime dueDate;

    @Column(name = "CREATED_AT")
    private OffsetDateTime creation_ts;

    @Column(name = "FINISH_DATE")
    private OffsetDateTime completedAt;

    public ToDoItem() {}

    // Getters y Setters
    public int getID() { return ID; }
    public void setID(int ID) { this.ID = ID; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getAssignedSprint() { return assignedSprint; }
    public void setAssignedSprint(Integer assignedSprint) { this.assignedSprint = assignedSprint; }

    public OffsetDateTime getStartDate() { return startDate; }
    public void setStartDate(OffsetDateTime startDate) { this.startDate = startDate; }

    public OffsetDateTime getDueDate() { return dueDate; }
    public void setDueDate(OffsetDateTime dueDate) { this.dueDate = dueDate; }

    public OffsetDateTime getCreation_ts() { return creation_ts; }
    public void setCreation_ts(OffsetDateTime creation_ts) { this.creation_ts = creation_ts; }

    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }

    public boolean isDone() {
        return "DONE".equalsIgnoreCase(this.status) || "FINISHED".equalsIgnoreCase(this.status);
    }

    public void setDone(boolean done) {
        this.status = done ? "DONE" : "PENDING";
    }
}