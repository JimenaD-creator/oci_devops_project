package com.springboot.MyTodoList.dto;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import java.time.LocalDateTime;

/** Slim USER_TASK row for dashboards — no profile pictures, no nested sprint/project graphs. */
public class DashboardUserTaskDto {
    private UserTaskKeyDto id;
    private UserRefDto user;
    private TaskRefDto task;
    private Double workedHours;
    private String status;
    private Boolean isBlocked;
    private String blockedReason;
    private LocalDateTime completedAt;

    public static DashboardUserTaskDto from(UserTask ut) {
        DashboardUserTaskDto dto = new DashboardUserTaskDto();
        User user = ut.getUser();
        Task task = ut.getTask();
        if (user != null && task != null && user.getId() != null && task.getId() != null) {
            dto.id = new UserTaskKeyDto(user.getId(), task.getId());
        } else if (ut.getId() != null) {
            dto.id = new UserTaskKeyDto(ut.getId().getUserId(), ut.getId().getTaskId());
        }
        if (user != null) {
            dto.user = UserRefDto.from(user);
        }
        if (task != null) {
            dto.task = TaskRefDto.from(task);
        }
        dto.workedHours = ut.getWorkedHours();
        dto.status = ut.getStatus();
        dto.isBlocked = ut.getIsBlocked();
        dto.blockedReason = ut.getBlockedReason();
        dto.completedAt = ut.getCompletedAt();
        return dto;
    }

    public UserTaskKeyDto getId() {
        return id;
    }

    public void setId(UserTaskKeyDto id) {
        this.id = id;
    }

    public UserRefDto getUser() {
        return user;
    }

    public void setUser(UserRefDto user) {
        this.user = user;
    }

    public TaskRefDto getTask() {
        return task;
    }

    public void setTask(TaskRefDto task) {
        this.task = task;
    }

    public Double getWorkedHours() {
        return workedHours;
    }

    public void setWorkedHours(Double workedHours) {
        this.workedHours = workedHours;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
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

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public static class UserTaskKeyDto {
        private Long userId;
        private Long taskId;

        public UserTaskKeyDto() {}

        public UserTaskKeyDto(Long userId, Long taskId) {
            this.userId = userId;
            this.taskId = taskId;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public Long getTaskId() {
            return taskId;
        }

        public void setTaskId(Long taskId) {
            this.taskId = taskId;
        }
    }

    public static class UserRefDto {
        private Long id;
        private String name;
        private String phoneNumber;

        public static UserRefDto from(User user) {
            UserRefDto ref = new UserRefDto();
            ref.id = user.getId();
            ref.name = user.getName();
            ref.phoneNumber = user.getPhoneNumber();
            return ref;
        }

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getPhoneNumber() {
            return phoneNumber;
        }

        public void setPhoneNumber(String phoneNumber) {
            this.phoneNumber = phoneNumber;
        }
    }

    public static class TaskRefDto {
        private Long id;
        private IdRefDto assignedSprint;

        public static TaskRefDto from(Task task) {
            TaskRefDto ref = new TaskRefDto();
            ref.id = task.getId();
            if (task.getAssignedSprint() != null && task.getAssignedSprint().getId() != null) {
                ref.assignedSprint = new IdRefDto(task.getAssignedSprint().getId());
            }
            return ref;
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
    }
}
