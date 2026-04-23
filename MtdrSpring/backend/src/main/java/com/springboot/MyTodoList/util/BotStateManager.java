package com.springboot.MyTodoList.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages the state of all users in the bot.
 * Tracks what each user (by chatId) is currently doing.
 * Uses in-memory storage for fast access.
 * 
 * States:
 * - null/empty: User is not in any special state
 * - "WAITING_FOR_HOURS": User just marked a task as DONE and is waiting to enter hours
 */
@Component
public class BotStateManager {
    
    private static final Logger logger = LoggerFactory.getLogger(BotStateManager.class);
    
    // Map: chatId → BotUserState
    // ConcurrentHashMap for thread-safe access
    private final Map<Long, BotUserState> userStates = new ConcurrentHashMap<>();
    
    // Timeout in minutes: If state is older than this, it's considered expired
    private static final long STATE_TIMEOUT_MINUTES = 30;
    
    /**
     * Set user state to "waiting for hours"
     * 
     * @param chatId The Telegram chat ID
     * @param taskId The task ID that is waiting for hours
     */
    public void setWaitingForHours(Long chatId, Integer taskId) {
        BotUserState state = new BotUserState(chatId, taskId, null, "WAITING_FOR_HOURS");
        userStates.put(chatId, state);
        logger.info("Set chat {} to waiting for hours for task {}", chatId, taskId);
    }
    
    /**
     * Set user state to "selecting sprint"
     * 
     * @param chatId The Telegram chat ID
     */
    public void setSelectingSprint(Long chatId) {
        BotUserState state = new BotUserState(chatId, null, null, "SELECTING_SPRINT");
        userStates.put(chatId, state);
        logger.info("Set chat {} to selecting sprint", chatId);
    }
    
    /**
     * Set user state to "viewing sprint tasks"
     * 
     * @param chatId The Telegram chat ID
     * @param sprintId The sprint ID being viewed
     */
    public void setViewingSprintTasks(Long chatId, Long sprintId) {
        BotUserState state = new BotUserState(chatId, null, sprintId, "VIEWING_SPRINT_TASKS");
        userStates.put(chatId, state);
        logger.info("Set chat {} to viewing sprint tasks for sprint {}", chatId, sprintId);
    }
    
    /**
     * Get the task ID that is waiting for hours for this user
     * Returns null if no valid pending state
     * 
     * @param chatId The Telegram chat ID
     * @return Task ID or null
     */
    public Integer getTaskIdWaitingForHours(Long chatId) {
        BotUserState state = userStates.get(chatId);
        
        // State must exist
        if (state == null) {
            return null;
        }
        
        // State must be "WAITING_FOR_HOURS"
        if (!"WAITING_FOR_HOURS".equals(state.getState())) {
            return null;
        }
        
        // Check if state has timed out
        if (isStateExpired(state)) {
            logger.info("State for chat {} has timed out, clearing", chatId);
            clearPendingState(chatId);
            return null;
        }
        
        return state.getTaskId();
    }
    
    /**
     * Check if user is selecting a sprint
     * 
     * @param chatId The Telegram chat ID
     * @return true if selecting sprint
     */
    public boolean isSelectingSprint(Long chatId) {
        BotUserState state = userStates.get(chatId);
        return state != null && "SELECTING_SPRINT".equals(state.getState()) && !isStateExpired(state);
    }
    
    /**
     * Check if user is viewing sprint tasks
     * 
     * @param chatId The Telegram chat ID
     * @return true if viewing sprint tasks
     */
    public boolean isViewingSprintTasks(Long chatId) {
        BotUserState state = userStates.get(chatId);
        return state != null && "VIEWING_SPRINT_TASKS".equals(state.getState()) && !isStateExpired(state);
    }
    
    /**
     * Get the sprint ID being viewed
     * 
     * @param chatId The Telegram chat ID
     * @return Sprint ID or null
     */
    public Long getViewingSprintId(Long chatId) {
        BotUserState state = userStates.get(chatId);
        if (state != null && "VIEWING_SPRINT_TASKS".equals(state.getState()) && !isStateExpired(state)) {
            return state.getSprintId();
        }
        return null;
    }
    
    /**
     * Check if user has any pending state
     * Also clears state if it has timed out
     * 
     * @param chatId The Telegram chat ID
     * @return true if user has a pending (non-expired) state
     */
    public boolean hasPendingState(Long chatId) {
        BotUserState state = userStates.get(chatId);
        
        if (state == null) {
            return false;
        }
        
        // Check if state is expired
        if (isStateExpired(state)) {
            logger.info("State for chat {} has timed out, clearing", chatId);
            clearPendingState(chatId);
            return false;
        }
        
        return state.getState() != null && !state.getState().isEmpty();
    }
    
    /**
     * Clear the pending state for a user
     * This is called after successfully processing the pending action
     * 
     * @param chatId The Telegram chat ID
     */
    public void clearPendingState(Long chatId) {
        userStates.remove(chatId);
        logger.info("Cleared state for chat {}", chatId);
    }
    
    /**
     * Check if a state has expired (older than STATE_TIMEOUT_MINUTES)
     * 
     * @param state The user state to check
     * @return true if expired
     */
    private boolean isStateExpired(BotUserState state) {
        if (state.getTimestamp() == null) {
            return false;
        }
        
        long minutesOld = ChronoUnit.MINUTES.between(state.getTimestamp(), LocalDateTime.now());
        return minutesOld >= STATE_TIMEOUT_MINUTES;
    }
    
    /**
     * Get the current state for debugging
     * 
     * @param chatId The Telegram chat ID
     * @return The BotUserState or null
     */
    public BotUserState getState(Long chatId) {
        return userStates.get(chatId);
    }
    
    /**
     * Get all active states (for monitoring/debugging)
     * 
     * @return Map of all current states
     */
    public Map<Long, BotUserState> getAllStates() {
        return new ConcurrentHashMap<>(userStates);
    }
}
