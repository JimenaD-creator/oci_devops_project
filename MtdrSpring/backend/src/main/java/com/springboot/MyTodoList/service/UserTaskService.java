package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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
    
    /**
     * Save or update worked hours for a user's task
     * 
     * @param userId The database user ID
     * @param taskId The task ID
     * @param workedHours The number of hours worked (int)
     * @return The saved UserTask
     */
    public UserTask saveWorkedHours(Integer userId, Long taskId, Integer workedHours) {
        try {
            // Create composite ID
            UserTaskId id = new UserTaskId(userId, taskId);
            
            // Check if record already exists
            Optional<UserTask> existingUserTask = userTaskRepository.findById(id);
            
            UserTask userTask;
            if (existingUserTask.isPresent()) {
                // Update existing record
                userTask = existingUserTask.get();
                logger.info("Updating hours for userId {} taskId {} to {}", userId, taskId, workedHours);
            } else {
                // Create new record
                userTask = new UserTask();
                userTask.setId(id);
                logger.info("Creating new hours record for userId {} taskId {} with {} hours", userId, taskId, workedHours);
            }
            
            // Set the worked hours
            userTask.setWorkedHours((long) workedHours);
            
            // Set status to COMPLETED
            userTask.setStatus("COMPLETED");
            
            // Save to database
            UserTask saved = userTaskRepository.save(userTask);
            logger.info("Successfully saved {} hours for userId {} taskId {}", workedHours, userId, taskId);
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
