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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.ToDoItemRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
    private ToDoItemRepository toDoItemRepository;

    @Autowired
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @Transactional(readOnly = true)
    public List<Long> findSprintIdsWithAssignmentsForUser(Long userId) {
        if (userId == null) {
            return List.of();
        }
        List<Long> raw = userTaskRepository.findDistinctSprintIdsByUserId(userId);
        return new ArrayList<>(new LinkedHashSet<>(raw));
    }

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

    public static final class UserSprintTaskListIndex {
        public final Set<Long> assignedTaskIds;
        public final Set<Long> myCompletedAssignmentTaskIds;

        public UserSprintTaskListIndex(Set<Long> assignedTaskIds, Set<Long> myCompletedAssignmentTaskIds) {
            this.assignedTaskIds = assignedTaskIds;
            this.myCompletedAssignmentTaskIds = myCompletedAssignmentTaskIds;
        }
    }

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

    @Transactional(readOnly = true)
    public Set<Long> findTaskIdsForUserInSprint(Long userId, Long sprintId) {
        return loadUserSprintTaskListIndex(userId, sprintId).assignedTaskIds;
    }

    @Transactional(readOnly = true)
    public List<UserTask> findUserTasksForUserInSprint(Long userId, Long sprintId) {
        if (userId == null || sprintId == null) {
            return List.of();
        }
        return userTaskRepository.findByUser_IdAndTask_AssignedSprint_Id(userId, sprintId);
    }

    /**
     * Returns all USER_TASK rows for a given user across all sprints.
     * Used for the /myperformance Telegram command.
     */
    @Transactional(readOnly = true)
    public List<UserTask> findByUserId(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return userTaskRepository.findByUser_Id(userId);
    }

    /**
     * Finds all USER_TASK assignments for a specific user in a specific sprint.
     * Used for the /myperformance Telegram command when a specific sprint is selected.
     * 
     * @param userId The user ID
     * @param sprintId The sprint ID
     * @return List of UserTask assignments for that user in that sprint
     */
    @Transactional(readOnly = true)
    public List<UserTask> findByUserIdAndSprintId(Long userId, Long sprintId) {
        if (userId == null || sprintId == null) {
            return List.of();
        }
        return userTaskRepository.findByUser_IdAndTask_AssignedSprint_Id(userId, sprintId);
    }

    private static boolean assignmentStatusIsCompleted(String status) {
        return UserTask.isCompletedAssignmentStatus(status);
    }

    /**
     * Updates one assignee's USER_TASK status and re-derives TASK.STATUS from all assignments.
     * Used by Telegram and any per-developer status changes.
     */
    @Transactional
    public boolean updateAssignmentStatus(Long userId, Long taskId, String status) {
        if (userId == null || taskId == null || status == null || status.isBlank()) {
            return false;
        }
        String canonical = status.trim().toUpperCase();
        Optional<UserTask> opt = userTaskRepository.findByUser_IdAndTask_Id(userId, taskId);
        if (opt.isEmpty()) {
            logger.warn("updateAssignmentStatus: user {} has no USER_TASK row for task {}", userId, taskId);
            return false;
        }
        UserTask ut = opt.get();
        ut.setStatus(canonical);
        userTaskRepository.saveAndFlush(ut);
        Task synced = taskAssignmentSyncService.syncTaskStatusFromAssignments(taskId);
        if (synced != null && synced.getStatus() != null) {
            int taskIdInt = Math.toIntExact(taskId);
            toDoItemRepository.updateStatusOnly(taskIdInt, synced.getStatus());
        }
        logger.info("USER_TASK status for userId {} taskId {} set to {} (task row synced)", userId, taskId, canonical);
        return true;
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

    public boolean isUserAssignedToTask(Long userId, Long taskId) {
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.isEmpty()) {
            return true;
        }
        return uts.stream().anyMatch(ut -> ut.getUser().getId().equals(userId));
    }

    @Transactional(readOnly = true)
    public Optional<String> getAssignmentStatus(Long userId, Long taskId) {
        if (userId == null || taskId == null) {
            return Optional.empty();
        }
        return userTaskRepository.findById(new UserTaskId(userId, taskId)).map(UserTask::getStatus);
    }

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

    @Transactional
    public UserTask saveWorkedHours(Long userId, Long taskId, Integer workedHours) {
        try {
            Long effectiveUserId = resolveAssigneeUserIdForWorkedHours(userId, taskId);
            UserTaskId id = new UserTaskId(effectiveUserId, taskId);
            Optional<UserTask> existingUserTask = userTaskRepository.findById(id);
            int delta = workedHours == null ? 0 : workedHours;
            if (delta < 0) delta = 0;
            UserTask userTask;
            long previous = 0L;
            if (existingUserTask.isPresent()) {
                userTask = existingUserTask.get();
                Long wh = userTask.getWorkedHours();
                if (wh != null && wh > 0) previous = wh;
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
     * Blocker reports for the developer UI: own assignments with {@code isBlocked=true}
     * and not yet completed.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listBlockedReportsForDeveloper(Long userId, Long projectId) {
        if (userId == null || projectId == null) {
            return List.of();
        }
        List<UserTask> rows = userTaskRepository.findBlockedByUserIdAndProjectId(userId, projectId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (UserTask ut : rows) {
            if (ut == null || !Boolean.TRUE.equals(ut.getIsBlocked())) {
                continue;
            }
            if (UserTask.isCompletedAssignmentStatus(ut.getStatus())) {
                continue;
            }
            Task t = ut.getTask();
            if (t == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("taskId", t.getId());
            row.put(
                "taskTitle",
                t.getTitle() != null && !t.getTitle().isBlank() ? t.getTitle().trim() : ("Task #" + t.getId()));
            row.put("blockedReason", ut.getBlockedReason() != null ? ut.getBlockedReason().trim() : "");
            LocalDateTime reportedAt = t.getUpdatedAt();
            if (reportedAt != null) {
                row.put("reportedAt", reportedAt.toString());
            } else {
                row.put("reportedAt", null);
            }
            if (t.getAssignedSprint() != null) {
                row.put("sprintId", t.getAssignedSprint().getId());
            }
            out.add(row);
        }
        out.sort((a, b) -> {
            String ra = (String) a.get("reportedAt");
            String rb = (String) b.get("reportedAt");
            if (ra == null && rb == null) {
                return Long.compare(
                    ((Number) b.getOrDefault("taskId", 0L)).longValue(),
                    ((Number) a.getOrDefault("taskId", 0L)).longValue());
            }
            if (ra == null) return 1;
            if (rb == null) return -1;
            int cmp = rb.compareTo(ra);
            if (cmp != 0) return cmp;
            return Long.compare(
                ((Number) b.getOrDefault("taskId", 0L)).longValue(),
                ((Number) a.getOrDefault("taskId", 0L)).longValue());
        });
        return out;
    }

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