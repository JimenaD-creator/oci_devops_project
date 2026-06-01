package com.springboot.MyTodoList.realtime;

/**
 * Payload broadcast to SSE clients when project task data changes (Telegram, REST, portal).
 */
public class ProjectTaskEvent {

    private String type;
    private Long projectId;
    private Long taskId;
    private Long userId;
    private String source;
    private long timestamp;

    public ProjectTaskEvent() {}

    public ProjectTaskEvent(
            String type, Long projectId, Long taskId, Long userId, String source, long timestamp) {
        this.type = type;
        this.projectId = projectId;
        this.taskId = taskId;
        this.userId = userId;
        this.source = source;
        this.timestamp = timestamp;
    }

    public static ProjectTaskEvent of(
            String type, Long projectId, Long taskId, Long userId, String source) {
        return new ProjectTaskEvent(type, projectId, taskId, userId, source, System.currentTimeMillis());
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getTaskId() {
        return taskId;
    }

    public void setTaskId(Long taskId) {
        this.taskId = taskId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
