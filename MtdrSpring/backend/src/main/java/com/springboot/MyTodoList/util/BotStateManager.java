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
 * - "SELECTING_USER_IN_SPRINT": User picked a sprint; choosing which assignee's tasks to list
 * - "VIEWING_SPRINT_TASKS": Showing tasks for one assignee in a sprint
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
     * Set user state to "waiting for hours".
     *
     * @param actingUserId DB user id who claimed the task (from sprint user-picker when present); stored in
     *                     {@code selectedUserId} until hours are saved, so it survives the state transition from
     *                     {@code VIEWING_SPRINT_TASKS}.
     */
    public void setWaitingForHours(Long chatId, Integer taskId, Long actingUserId) {
        BotUserState state = new BotUserState(chatId, taskId, null, actingUserId, "WAITING_FOR_HOURS");
        userStates.put(chatId, state);
        logger.info("Set chat {} to waiting for hours for task {}, actingUserId={}", chatId, taskId, actingUserId);
    }
    
    /**
     * Set user state to "selecting sprint"
     * 
     * @param chatId The Telegram chat ID
     */
    public void setSelectingSprint(Long chatId) {
        BotUserState state = new BotUserState(chatId, null, null, null, "SELECTING_SPRINT");
        userStates.put(chatId, state);
        logger.info("Set chat {} to selecting sprint", chatId);
    }

    /**
     * After choosing a sprint: show assignee list for that sprint.
     */
    public void setSelectingUserInSprint(Long chatId, Long sprintId) {
        BotUserState state = new BotUserState(chatId, null, sprintId, null, "SELECTING_USER_IN_SPRINT");
        userStates.put(chatId, state);
        logger.info("Set chat {} to selecting user in sprint {}", chatId, sprintId);
    }

    public boolean isSelectingUserInSprint(Long chatId) {
        BotUserState state = userStates.get(chatId);
        return state != null && "SELECTING_USER_IN_SPRINT".equals(state.getState()) && !isStateExpired(state);
    }

    /** Sprint id while picking a user, verifying credentials, viewing tasks, or selecting task status. */
    public Long getSprintIdInSprintUserFlow(Long chatId) {
        BotUserState state = userStates.get(chatId);
        if (state == null || isStateExpired(state)) {
            return null;
        }
        if ("SELECTING_USER_IN_SPRINT".equals(state.getState())
                || "VIEWING_SPRINT_TASKS".equals(state.getState())
                || "VERIFYING_CREDENTIALS_PHONE_EMAIL".equals(state.getState())
                || "VERIFYING_CREDENTIALS_PASSWORD".equals(state.getState())
                || "SELECTING_TASK_STATUS".equals(state.getState())) {
            return state.getSprintId();
        }
        return null;
    }
    
    /**
     * Set user state to "viewing sprint tasks" for one assignee.
     */
    public void setViewingSprintTasks(Long chatId, Long sprintId, Long selectedUserId) {
        BotUserState state = new BotUserState(chatId, null, sprintId, selectedUserId, "VIEWING_SPRINT_TASKS");
        userStates.put(chatId, state);
        logger.info("Set chat {} to viewing sprint {} tasks for user {}", chatId, sprintId, selectedUserId);
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
     * While waiting for hours: the assignee user id chosen in the sprint flow (or null → use Telegram mapping).
     */
    public Long getActingUserIdForHours(Long chatId) {
        BotUserState state = userStates.get(chatId);
        if (state == null) {
            return null;
        }
        if (!"WAITING_FOR_HOURS".equals(state.getState())) {
            return null;
        }
        if (isStateExpired(state)) {
            logger.info("State for chat {} has timed out, clearing", chatId);
            clearPendingState(chatId);
            return null;
        }
        return state.getSelectedUserId();
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
        if (state != null && !isStateExpired(state)) {
            if ("VIEWING_SPRINT_TASKS".equals(state.getState()) || "SELECTING_TASK_STATUS".equals(state.getState())) {
                return state.getSprintId();
            }
        }
        return null;
    }

    public Long getViewingSelectedUserId(Long chatId) {
        BotUserState state = userStates.get(chatId);
        if (state != null && !isStateExpired(state)) {
            if ("VIEWING_SPRINT_TASKS".equals(state.getState()) || "SELECTING_TASK_STATUS".equals(state.getState())) {
                return state.getSelectedUserId();
            }
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
        
        String st = state.getState();
        if (st == null || st.isEmpty()) {
            return false;
        }
        /* Navigation-only states: not "pending input" for free-text handlers */
        if ("SELECTING_SPRINT".equals(st) || "SELECTING_USER_IN_SPRINT".equals(st) || "VIEWING_SPRINT_TASKS".equals(st) ||
            "VERIFYING_CREDENTIALS_PHONE_EMAIL".equals(st) || "VERIFYING_CREDENTIALS_PASSWORD".equals(st) ||
            "SELECTING_TASK_STATUS".equals(st)) {
            return false;
        }
        return true;
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

    /**
     * Set user state to "verifying credentials - waiting for phone/email".
     * After user selection in sprint, ask for credentials first.
     *
     * @param chatId The Telegram chat ID
     * @param userId The user ID whose credentials need verification
     * @param sprintId The sprint ID context
     */
    public void setVerifyingCredentialsPhoneEmail(Long chatId, Long userId, Long sprintId) {
        BotUserState state = new BotUserState(chatId, null, sprintId, userId, "VERIFYING_CREDENTIALS_PHONE_EMAIL");
        state.setCredentialUserBeingVerified(userId);
        userStates.put(chatId, state);
        logger.info("Set chat {} to verifying credentials (phone/email) for user {}", chatId, userId);
    }

    /**
     * Set user state to "verifying credentials - waiting for password".
     *
     * @param chatId The Telegram chat ID
     * @param userId The user ID whose credentials need verification
     * @param sprintId The sprint ID context
     * @param phoneEmail The phone/email provided by user
     */
    public void setVerifyingCredentialsPassword(Long chatId, Long userId, Long sprintId, String phoneEmail) {
        BotUserState state = new BotUserState(chatId, null, sprintId, userId, "VERIFYING_CREDENTIALS_PASSWORD");
        state.setCredentialUserBeingVerified(userId);
        state.setTempPhoneEmail(phoneEmail);
        userStates.put(chatId, state);
        logger.info("Set chat {} to verifying credentials (password) for user {}", chatId, userId);
    }

    /**
     * Check if user is verifying credentials (phone/email step).
     *
     * @param chatId The Telegram chat ID
     * @return true if verifying credentials (phone/email step)
     */
    public boolean isVerifyingCredentialsPhoneEmail(Long chatId) {
        BotUserState state = userStates.get(chatId);
        return state != null && "VERIFYING_CREDENTIALS_PHONE_EMAIL".equals(state.getState()) && !isStateExpired(state);
    }

    /**
     * Check if user is verifying credentials (password step).
     *
     * @param chatId The Telegram chat ID
     * @return true if verifying credentials (password step)
     */
    public boolean isVerifyingCredentialsPassword(Long chatId) {
        BotUserState state = userStates.get(chatId);
        return state != null && "VERIFYING_CREDENTIALS_PASSWORD".equals(state.getState()) && !isStateExpired(state);
    }

    /**
     * Get the user ID whose credentials are being verified.
     *
     * @param chatId The Telegram chat ID
     * @return User ID or null
     */
    public Long getCredentialVerificationUserId(Long chatId) {
        BotUserState state = userStates.get(chatId);
        if (state != null && !isStateExpired(state)) {
            return state.getCredentialUserBeingVerified();
        }
        return null;
    }

    /**
     * Get the temporarily stored phone/email during credential verification.
     *
     * @param chatId The Telegram chat ID
     * @return Phone/email string or null
     */
    public String getStoredPhoneEmailForVerification(Long chatId) {
        BotUserState state = userStates.get(chatId);
        if (state != null && !isStateExpired(state)) {
            return state.getTempPhoneEmail();
        }
        return null;
    }

    /**
     * Set user state to "selecting task status" after clicking on a task.
     * Prepares to show task details and status options.
     *
     * @param chatId The Telegram chat ID
     * @param taskId The task ID being viewed
     * @param sprintId The sprint ID context
     * @param assigneeUserId The assignee user ID
     */
    public void setSelectingTaskStatus(Long chatId, Integer taskId, Long sprintId, Long assigneeUserId) {
        BotUserState state = new BotUserState(chatId, null, sprintId, assigneeUserId, "SELECTING_TASK_STATUS");
        state.setSelectedTaskId(taskId);
        userStates.put(chatId, state);
        logger.info("Set chat {} to selecting status for task {} in sprint {}", chatId, taskId, sprintId);
    }

    /**
     * Check if user is selecting task status.
     *
     * @param chatId The Telegram chat ID
     * @return true if selecting task status
     */
    public boolean isSelectingTaskStatus(Long chatId) {
        BotUserState state = userStates.get(chatId);
        return state != null && "SELECTING_TASK_STATUS".equals(state.getState()) && !isStateExpired(state);
    }

    /**
     * Get the task ID being viewed/modified.
     *
     * @param chatId The Telegram chat ID
     * @return Task ID or null
     */
    public Integer getSelectedTaskId(Long chatId) {
        BotUserState state = userStates.get(chatId);
        if (state != null && !isStateExpired(state) && "SELECTING_TASK_STATUS".equals(state.getState())) {
            return state.getSelectedTaskId();
        }
        return null;
    }
}

