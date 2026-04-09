package com.springboot.MyTodoList.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "TASK_LOG")
public class TaskLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "TASK_ID", nullable = false)
    private Task task;
    
    @Column(name = "FIELD_NAME", nullable = false, length = 100)
    private String fieldName;
    
    @Column(name = "OLD_VALUE", length = 4000)
    private String oldValue;
    
    @Column(name = "NEW_VALUE", length = 4000)
    private String newValue;
    
    @ManyToOne
    @JoinColumn(name = "CHANGED_BY", nullable = false)
    private User changedBy;
    
    @Column(name = "CHANGED_AT")
    private LocalDateTime changedAt;
    
    public TaskLog() {}
    
    public TaskLog(Task task, String fieldName, String oldValue, 
                   String newValue, User changedBy) {
        this.task = task;
        this.fieldName = fieldName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.changedBy = changedBy;
        this.changedAt = LocalDateTime.now();
    }
    
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Task getTask() {
        return task;
    }
    
    public void setTask(Task task) {
        this.task = task;
    }
    
    public String getFieldName() {
        return fieldName;
    }
    
    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }
    
    public String getOldValue() {
        return oldValue;
    }
    
    public void setOldValue(String oldValue) {
        this.oldValue = oldValue;
    }
    
    public String getNewValue() {
        return newValue;
    }
    
    public void setNewValue(String newValue) {
        this.newValue = newValue;
    }
    
    public User getChangedBy() {
        return changedBy;
    }
    
    public void setChangedBy(User changedBy) {
        this.changedBy = changedBy;
    }
    
    public LocalDateTime getChangedAt() {
        return changedAt;
    }
    
    public void setChangedAt(LocalDateTime changedAt) {
        this.changedAt = changedAt;
    }
}
