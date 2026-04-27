package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Autowired
    private TaskAssignmentSyncService taskAssignmentSyncService;

    /**
     * Users who have at least one assignment on a task in this sprint (for Telegram picker).
     */
    @Transactional(readOnly = true)
    public List<User> findDistinctAssigneesBySprintId(Long sprintId) {
        if (sprintId == null) {
            return List.of();
        }
        List<UserTask> uts = userTaskRepository.findByTask_AssignedSprint_Id(sprintId);
        Map<Long, User> byId = new LinkedHashMap<>();
        for (UserTask ut : uts) {
            if (ut.getUser() == null || ut.getUser().getId() == null) {
                continue;
            }
            byId.putIfAbsent(ut.getUser().getId(), ut.getUser());
        }
        List<User> out = new ArrayList<>(byId.values());
        out.sort(Comparator.comparing(u -> u.getName() == null ? "" : u.getName(), String.CASE_INSENSITIVE_ORDER));
        return out;
    }

    /**
     * Result of one DB read for Telegram: assigned task ids in the sprint and which of those
     * rows are already COMPLETED/DONE for this user.
     */
    public static final class UserSprintTaskListIndex {
        public final Set<Long> assignedTaskIds;
        public final Set<Long> myCompletedAssignmentTaskIds;

        public UserSprintTaskListIndex(Set<Long> assignedTaskIds, Set<Long> myCompletedAssignmentTaskIds) {
            this.assignedTaskIds = assignedTaskIds;
            this.myCompletedAssignmentTaskIds = myCompletedAssignmentTaskIds;
        }
    }

    /**
     * One query: this user's USER_TASK rows for the sprint. Used to build Telegram keyboards without N+1.
     */
    @Transactional(readOnly = true)
    public UserSprintTaskListIndex loadUserSprintTaskListIndex(Long userId, Long sprintId) {
        if (userId == null || sprintId == null) {
            return new UserSprintTaskListIndex(Set.of(), Set.of());
        }
        List<UserTask> rows = userTaskRepository.findByUser_IdAndTask_AssignedSprint_Id(userId, sprintId);
        Set<Long> assigned = new HashSet<>();
        Set<Long> completed = new HashSet<>();
        for (UserTask ut : rows) {
            Long tid = ut.getId().getTaskId();
            assigned.add(tid);
            if (assignmentStatusIsCompleted(ut.getStatus())) {
                completed.add(tid);
            }
        }
        return new UserSprintTaskListIndex(Collections.unmodifiableSet(assigned), Collections.unmodifiableSet(completed));
    }

    /** Task ids in this sprint assigned to this user (via USER_TASK). */
    @Transactional(readOnly = true)
    public Set<Long> findTaskIdsForUserInSprint(Long userId, Long sprintId) {
        return loadUserSprintTaskListIndex(userId, sprintId).assignedTaskIds;
    }

    /**
     * This user's USER_TASK rows for tasks in the sprint (single DB round-trip).
     */
    @Transactional(readOnly = true)
    public List<UserTask> findUserTasksForUserInSprint(Long userId, Long sprintId) {
        if (userId == null || sprintId == null) {
            return List.of();
        }
        return userTaskRepository.findByUser_IdAndTask_AssignedSprint_Id(userId, sprintId);
    }

    private static boolean assignmentStatusIsCompleted(String status) {
        return UserTask.isCompletedAssignmentStatus(status);
    }

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

    /**
     * True if the user has a USER_TASK row for this task, or there are no assignment rows yet (legacy tasks).
     */
    public boolean isUserAssignedToTask(Long userId, Long taskId) {
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.isEmpty()) {
            return true;
        }
        return uts.stream().anyMatch(ut -> ut.getUser().getId().equals(userId));
    }

    /**
     * Whether this user's assignment row is finished (shared tasks: TASK may still be open).
     * Used by Telegram to hide completed work from the "pending" keyboard for that user only.
     */
    @Transactional(readOnly = true)
    public boolean isMyAssignmentCompleted(Long userId, Long taskId) {
        if (userId == null || taskId == null) {
            return false;
        }
        UserTaskId id = new UserTaskId(userId, taskId);
        Optional<UserTask> opt = userTaskRepository.findById(id);
        if (opt.isEmpty()) {
            return false;
        }
        return assignmentStatusIsCompleted(opt.get().getStatus());
    }

    /**
     * Telegram "undo": only reopen this user's assignment, then recompute TASK status from all assignees.
     *
     * @return false if there were no USER_TASK rows (legacy); caller may fall back to updating the task row only.
     */
    @Transactional
    public boolean reopenMyAssignment(Long telegramUserId, Long taskId) {
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.isEmpty()) {
            return false;
        }
        Optional<UserTask> mine = uts.stream()
                .filter(ut -> ut.getUser().getId().equals(telegramUserId))
                .findFirst();
        if (mine.isEmpty()) {
            logger.warn("reopenMyAssignment: user {} is not an assignee on task {}", telegramUserId, taskId);
            return false;
        }
        UserTask ut = mine.get();
        ut.setStatus("TODO");
        ut.setIsBlocked(false);
        ut.setBlockedReason(null);
        userTaskRepository.save(ut);
        taskAssignmentSyncService.syncTaskStatusFromAssignments(taskId);
        return true;
    }
    
    /**
     * Adds {@code workedHours} to the existing {@code WORKED_HOURS} total for this user–task row (Telegram / logging).
     * Previous behaviour replaced the total, so repeat entries did not accumulate.
     */
    @Transactional
    public UserTask saveWorkedHours(Long userId, Long taskId, Integer workedHours) {
        try {
            Long effectiveUserId = resolveAssigneeUserIdForWorkedHours(userId, taskId);
            UserTaskId id = new UserTaskId(effectiveUserId, taskId);
            
            Optional<UserTask> existingUserTask = userTaskRepository.findById(id);
            
            int delta = workedHours == null ? 0 : workedHours;
            if (delta < 0) {
                delta = 0;
            }

            UserTask userTask;
            long previous = 0L;
            if (existingUserTask.isPresent()) {
                userTask = existingUserTask.get();
                Long wh = userTask.getWorkedHours();
                if (wh != null && wh > 0) {
                    previous = wh;
                }
                logger.info("Adding {}h for userId {} taskId {} (was {}h)", delta, effectiveUserId, taskId, previous);
            } else {
                User user = userRepository.findById(effectiveUserId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + effectiveUserId));
                Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
                userTask = new UserTask(user, task);
                logger.info("Creating USER_TASK for userId {} taskId {} with {}h (first log)", effectiveUserId, taskId, delta);
            }
            
            userTask.setWorkedHours(previous + delta);
            userTask.setStatus("COMPLETED");
            userTask.setIsBlocked(false);
            userTask.setBlockedReason(null);

            UserTask saved = userTaskRepository.save(userTask);
            taskAssignmentSyncService.syncTaskStatusFromAssignments(taskId);
            logger.info("Worked hours total for userId {} taskId {} is now {}", effectiveUserId, taskId, userTask.getWorkedHours());
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

    /**
     * Saves the blocked reason/message for a task (Telegram).
     * Updates the USER_TASK record with the blocked reason and sets status to BLOCKED.
     *
     * @param userId The user ID
     * @param taskId The task ID
     * @param blockedReason The reason/message why the task is blocked
     * @return The updated UserTask
     */
    @Transactional
    public UserTask saveBlockedReason(Long userId, Long taskId, String blockedReason) {
        try {
            Long effectiveUserId = resolveAssigneeUserIdForWorkedHours(userId, taskId);
            UserTaskId id = new UserTaskId(effectiveUserId, taskId);

            Optional<UserTask> existingUserTask = userTaskRepository.findById(id);

            UserTask userTask;
            if (existingUserTask.isPresent()) {
                userTask = existingUserTask.get();
                logger.info("Updating blocked reason for userId {} taskId {}", effectiveUserId, taskId);
            } else {
                User user = userRepository.findById(effectiveUserId)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + effectiveUserId));
                Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));
                userTask = new UserTask(user, task);
                logger.info("Creating USER_TASK for userId {} taskId {} with blocked reason (first log)", effectiveUserId, taskId);
            }

            userTask.setBlockedReason(blockedReason);
            userTask.setStatus("BLOCKED");
            userTask.setIsBlocked(true);

            UserTask saved = userTaskRepository.save(userTask);
            taskAssignmentSyncService.syncTaskStatusFromAssignments(taskId);
            logger.info("Blocked reason saved for userId {} taskId {}: {}", effectiveUserId, taskId, blockedReason);
            return saved;

        } catch (Exception e) {
            logger.error("Error saving blocked reason for userId {} taskId {}: {}", userId, taskId, e.getMessage(), e);
            throw new RuntimeException("Failed to save blocked reason", e);
        }
    }
}