package com.springboot.MyTodoList.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.persistence.*;

@Entity
@Table(name = "USER_TASK")
public class UserTask {

    @EmbeddedId
    private UserTaskId id;

    @ManyToOne
    @MapsId("userId")
    @JoinColumn(name = "USER_ID")
    private User user;

    @ManyToOne
    @MapsId("taskId")
    @JoinColumn(name = "TASK_ID")
    private Task task;

    @JsonAlias({ "hours", "worked_hours" })
    @Column(name = "WORKED_HOURS")
    private Long workedHours;

    @Column(name = "STATUS", length = 50)
    private String status;

    @Column(name = "IS_BLOCKED")
    private Boolean isBlocked;

    @Column(name = "BLOCKED_REASON", length = 500)
    private String blockedReason;

    public UserTask() {}

    public UserTask(User user, Task task) {
        this.user = user;
        this.task = task;
        this.id = new UserTaskId(user.getId(), task.getId());
    }

    public UserTaskId getId() {
        return id;
    }

    public void setId(UserTaskId id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Task getTask() {
        return task;
    }

    public void setTask(Task task) {
        this.task = task;
    }

    public Long getWorkedHours() {
        return workedHours;
    }

    public void setWorkedHours(Long workedHours) {
        this.workedHours = workedHours;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
        if (isCompletedAssignmentStatus(status)) {
            this.isBlocked = false;
            this.blockedReason = null;
        }
    }

    /** COMPLETED / DONE (and common aliases): assignment finished — block flags must not remain set. */
    public static boolean isCompletedAssignmentStatus(String status) {
        if (status == null || status.isBlank()) {
            return false;
        }
        String n = status.trim().toUpperCase().replace('-', '_').replaceAll("\\s+", "_");
        if ("TO_DO".equals(n)) {
            n = "TODO";
        }
        return "COMPLETED".equals(n) || "DONE".equals(n) || "COMPLETE".equals(n);
    }

    public boolean isCompletedAssignment() {
        return isCompletedAssignmentStatus(this.status);
    }

    public Boolean getIsBlocked() {
        return isBlocked;
    }

    public void setIsBlocked(Boolean isBlocked) {
        this.isBlocked = isBlocked;
    }

    public String getBlockedReason() {
        return blockedReason;
    }

    public void setBlockedReason(String blockedReason) {
        this.blockedReason = blockedReason;
    }
}