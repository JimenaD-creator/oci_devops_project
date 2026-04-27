package com.springboot.MyTodoList.model;
import java.util.List;

public class ManagerChatRequest {

    private Long projectId;
    private Long sprintId; // null = todos los sprints del proyecto
    private String message;
    private List<ChatMessage> history;

    public static class ChatMessage {
        private String role; // "user" | "assistant"
        private String content;

        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }

    public Long getProjectId() { return projectId; }
    public void setProjectId(Long projectId) { this.projectId = projectId; }

    public Long getSprintId() { return sprintId; }
    public void setSprintId(Long sprintId) { this.sprintId = sprintId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public List<ChatMessage> getHistory() { return history; }
    public void setHistory(List<ChatMessage> history) { this.history = history; }
}