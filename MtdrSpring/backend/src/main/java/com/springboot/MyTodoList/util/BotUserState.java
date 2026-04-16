package com.springboot.MyTodoList.util;

import java.time.LocalDateTime;

/**
 * Represents the current state of a user in the bot conversation.
 * Tracks what the user is doing (e.g., waiting for input).
 */
public class BotUserState {
    
    private Long chatId;              // Telegram chat ID
    private Integer taskId;           // Task waiting for hours (if in WAITING_FOR_HOURS state)
    private String state;             // Current state: "WAITING_FOR_HOURS" or null
    private LocalDateTime timestamp;  // When state was created (for timeout)
    
    // Constructors
    public BotUserState() {}
    
    public BotUserState(Long chatId, Integer taskId, String state) {
        this.chatId = chatId;
        this.taskId = taskId;
        this.state = state;
        this.timestamp = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getChatId() {
        return chatId;
    }
    
    public void setChatId(Long chatId) {
        this.chatId = chatId;
    }
    
    public Integer getTaskId() {
        return taskId;
    }
    
    public void setTaskId(Integer taskId) {
        this.taskId = taskId;
    }
    
    public String getState() {
        return state;
    }
    
    public void setState(String state) {
        this.state = state;
        this.timestamp = LocalDateTime.now();
    }
    
    public LocalDateTime getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
    
    @Override
    public String toString() {
        return "BotUserState{" +
                "chatId=" + chatId +
                ", taskId=" + taskId +
                ", state='" + state + '\'' +
                ", timestamp=" + timestamp +
                '}';
    }
}
