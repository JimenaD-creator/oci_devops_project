package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Service for managing UserTask operations.
 * Handles saving worked hours for user-task associations.
 */
@Service
public class UserTaskService {
    
    private static final Logger logger = LoggerFactory.getLogger(UserTaskService.class);
    
    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    /**
     * Telegram sends a hint userId (often wrong: mapping defaults to 1). Prefer the assignee
     * already stored in USER_TASK for this task when the task was assigned from the web.
     */
    private int resolveAssigneeUserIdForWorkedHours(Integer telegramHintUserId, Long taskId) {
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.size() == 1) {
            int id = uts.get(0).getUser().getID();
            logger.info("Worked hours: using single assignee userId {} for task {} (Telegram hint was {})", id, taskId, telegramHintUserId);
            return id;
        }
        if (uts.size() > 1 && telegramHintUserId != null) {
            for (UserTask ut : uts) {
                if (ut.getUser().getID() == telegramHintUserId) {
                    return telegramHintUserId;
                }
            }
            int fallback = uts.get(0).getUser().getID();
            logger.warn("Telegram userId {} not among assignees for task {}; using userId {}", telegramHintUserId, taskId, fallback);
            return fallback;
        }
        if (telegramHintUserId != null) {
            return telegramHintUserId;
        }
        logger.warn("Worked hours: no assignee row and no Telegram user for task {}; using userId 1", taskId);
        return 1;
    }
    
    /**
     * Save or update worked hours for a user's task
     * 
     * @param userId The database user ID (hint from Telegram; overridden when a single USER_TASK exists)
     * @param taskId The task ID
     * @param workedHours The number of hours worked (int)
     * @return The saved UserTask
     */
    public UserTask saveWorkedHours(Integer userId, Long taskId, Integer workedHours) {
        try {
            int effectiveUserId = resolveAssigneeUserIdForWorkedHours(userId, taskId);
            // Create composite ID
            UserTaskId id = new UserTaskId(effectiveUserId, taskId);
            
            // Check if record already exists
            Optional<UserTask> existingUserTask = userTaskRepository.findById(id);
            
            UserTask userTask;
            if (existingUserTask.isPresent()) {
                // Update existing record
                userTask = existingUserTask.get();
                logger.info("Updating hours for userId {} taskId {} to {}", effectiveUserId, taskId, workedHours);
            } else {
                User user = userRepository.findById(Long.valueOf(effectiveUserId))
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + effectiveUserId));
                Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
                userTask = new UserTask(user, task);
                logger.info("Creating new hours record for userId {} taskId {} with {} hours", effectiveUserId, taskId, workedHours);
            }
            
            // Set the worked hours
            userTask.setWorkedHours((long) workedHours);
            
            // Set status to COMPLETED
            userTask.setStatus("COMPLETED");
            
            // Save to database
            UserTask saved = userTaskRepository.save(userTask);
            logger.info("Successfully saved {} hours for userId {} taskId {}", workedHours, effectiveUserId, taskId);
            return saved;
            
        } catch (Exception e) {
            logger.error("Error saving worked hours for userId {} taskId {}: {}", userId, taskId, e.getMessage(), e);
            throw new RuntimeException("Failed to save worked hours", e);
        }
    }
    
    /**
     * Get worked hours for a user's task
     * 
     * @param userId The database user ID
     * @param taskId The task ID
     * @return Hours worked, or 0 if no record exists
     */
    public Integer getWorkedHours(Integer userId, Long taskId) {
        try {
            UserTaskId id = new UserTaskId(userId, taskId);
            Optional<UserTask> userTask = userTaskRepository.findById(id);
            
            if (userTask.isPresent()) {
                Long hours = userTask.get().getWorkedHours();
                return hours != null ? hours.intValue() : 0;
            }
            
            return 0;
        } catch (Exception e) {
            logger.error("Error retrieving worked hours for userId {} taskId {}", userId, taskId, e);
            return 0;
        }
    }
}
