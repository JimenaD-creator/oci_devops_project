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

@Service
public class UserTaskService {
    
    private static final Logger logger = LoggerFactory.getLogger(UserTaskService.class);
    
    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    private Long resolveAssigneeUserIdForWorkedHours(Long telegramHintUserId, Long taskId) {
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.size() == 1) {
            Long id = uts.get(0).getUser().getId();
            logger.info("Worked hours: using single assignee userId {} for task {} (Telegram hint was {})", id, taskId, telegramHintUserId);
            return id;
        }
        if (uts.size() > 1 && telegramHintUserId != null) {
            for (UserTask ut : uts) {
                if (ut.getUser().getId().equals(telegramHintUserId)) {
                    return telegramHintUserId;
                }
            }
            Long fallback = uts.get(0).getUser().getId();
            logger.warn("Telegram userId {} not among assignees for task {}; using userId {}", telegramHintUserId, taskId, fallback);
            return fallback;
        }
        if (telegramHintUserId != null) {
            return telegramHintUserId;
        }
        logger.warn("Worked hours: no assignee row and no Telegram user for task {}; using userId 1", taskId);
        return 1L;
    }
    
    public UserTask saveWorkedHours(Long userId, Long taskId, Integer workedHours) {
        try {
            Long effectiveUserId = resolveAssigneeUserIdForWorkedHours(userId, taskId);
            UserTaskId id = new UserTaskId(effectiveUserId, taskId);
            
            Optional<UserTask> existingUserTask = userTaskRepository.findById(id);
            
            UserTask userTask;
            if (existingUserTask.isPresent()) {
                userTask = existingUserTask.get();
                logger.info("Updating hours for userId {} taskId {} to {}", effectiveUserId, taskId, workedHours);
            } else {
                User user = userRepository.findById(effectiveUserId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + effectiveUserId));
                Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
                userTask = new UserTask(user, task);
                logger.info("Creating new hours record for userId {} taskId {} with {} hours", effectiveUserId, taskId, workedHours);
            }
            
            userTask.setWorkedHours((long) workedHours);
            userTask.setStatus("COMPLETED");
            
            UserTask saved = userTaskRepository.save(userTask);
            logger.info("Successfully saved {} hours for userId {} taskId {}", workedHours, effectiveUserId, taskId);
            return saved;
            
        } catch (Exception e) {
            logger.error("Error saving worked hours for userId {} taskId {}: {}", userId, taskId, e.getMessage(), e);
            throw new RuntimeException("Failed to save worked hours", e);
        }
    }
    
    public Integer getWorkedHours(Long userId, Long taskId) {
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