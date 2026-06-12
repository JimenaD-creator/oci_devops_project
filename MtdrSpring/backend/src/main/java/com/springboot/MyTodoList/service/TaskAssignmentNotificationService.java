package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.SprintRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.security.SecurityUtils;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sends email when developers are assigned to a task.
 */
@Service
public class TaskAssignmentNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(TaskAssignmentNotificationService.class);

    @Autowired
    private EmailService emailService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private PendingTelegramAssignmentNoticeService pendingTelegramAssignmentNoticeService;

    @Autowired
    @Lazy
    private TaskAssignmentNotificationService self;

    @Value("${app.notifications.task-assignment.enabled:true}")
    private boolean enabled;

    public void notifyAssigneesOnTaskCreated(Task task, List<Long> assigneeUserIds) {
        if (task == null || task.getId() == null || !notificationsActive()) {
            return;
        }
        Set<Long> distinct = distinctPositiveIds(assigneeUserIds);
        if (distinct.isEmpty()) {
            logger.info("Skipping assignment notifications for task {}: no assigneeUserIds", task.getId());
            return;
        }
        String assignedBy = resolveAssignerDisplayName();
        logger.info(
                "Queueing assignment notifications for task {} to {} assignee(s)",
                task.getId(),
                distinct.size());
        self.dispatchAssigneeNotifications(task.getId(), distinct, assignedBy);
    }

    /** Notifies only developers newly added when editing assignees on an existing task. */
    public void notifyNewAssigneesOnReassignment(Long taskId, List<Long> newAssigneeUserIds) {
        if (taskId == null || !notificationsActive()) {
            return;
        }
        Set<Long> distinct = distinctPositiveIds(newAssigneeUserIds);
        if (distinct.isEmpty()) {
            return;
        }
        String assignedBy = resolveAssignerDisplayName();
        logger.info(
                "Queueing reassignment notifications for task {} to {} new assignee(s)",
                taskId,
                distinct.size());
        self.dispatchAssigneeNotifications(taskId, distinct, assignedBy);
    }

    @Async
    @Transactional(readOnly = true)
    public void dispatchAssigneeNotifications(Long taskId, Set<Long> assigneeUserIds, String assignedBy) {
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        if (taskOpt.isEmpty()) {
            logger.warn("Skipping assignment notifications: task {} not found", taskId);
            return;
        }
        notifyAssignees(taskOpt.get(), assigneeUserIds, assignedBy);
    }

    private boolean notificationsActive() {
        return enabled || pendingTelegramAssignmentNoticeService.isEnabled();
    }

    private void notifyAssignees(Task task, Set<Long> assigneeUserIds, String assignedBy) {
        if (!notificationsActive() || task == null || task.getId() == null || assigneeUserIds.isEmpty()) {
            return;
        }

        String taskTitle = task.getTitle() != null ? task.getTitle().trim() : "Untitled task";
        String priority = task.getPriority() != null && !task.getPriority().isBlank()
                ? task.getPriority().trim()
                : null;
        String sprintLabel = formatSprintLabel(task);

        for (Long userId : assigneeUserIds) {
            try {
                User assignee = userRepository.findById(userId).orElse(null);
                if (assignee == null) {
                    logger.warn("Skipping assignment notification: user {} not found", userId);
                    continue;
                }

                pendingTelegramAssignmentNoticeService.enqueue(
                        userId, task.getId(), taskTitle, assignedBy, priority, sprintLabel);

                if (!enabled) {
                    continue;
                }

                String email = assignee.getEmail();
                if (!isValidEmail(email)) {
                    logger.info(
                            "Skipping assignment email for user {} (id={}): no valid email on file",
                            assignee.getName(),
                            userId);
                    continue;
                }
                String name = assignee.getName() != null && !assignee.getName().isBlank()
                        ? assignee.getName().trim()
                        : "there";
                emailService.sendTaskAssignmentEmail(
                        email.trim(), name, taskTitle, priority, sprintLabel, assignedBy);
            } catch (Exception e) {
                logger.warn(
                        "Failed to send task assignment email for userId={} taskId={}: {}",
                        userId,
                        task.getId(),
                        e.getMessage());
            }
        }
    }

    private static Set<Long> distinctPositiveIds(List<Long> ids) {
        Set<Long> distinct = new LinkedHashSet<>();
        if (ids == null) {
            return distinct;
        }
        for (Long raw : ids) {
            if (raw != null && raw > 0) {
                distinct.add(raw);
            }
        }
        return distinct;
    }

    /** Manager display name from USERS.NAME (resolved on the HTTP thread before @Async). */
    private String resolveAssignerDisplayName() {
        Optional<Long> userId = SecurityUtils.currentUserId();
        if (userId.isPresent()) {
            Optional<String> dbName = userRepository.findById(userId.get()).map(User::getName).map(String::trim)
                    .filter(n -> !n.isBlank());
            if (dbName.isPresent()) {
                return dbName.get();
            }
            logger.debug("Assigner userId={} has no NAME in USERS; using JWT or fallback", userId.get());
        }
        return SecurityUtils.currentJwt()
                .map(jwt -> jwt.getClaim("name"))
                .map(String::valueOf)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .orElse("Your manager");
    }

    private String formatSprintLabel(Task task) {
        if (task == null || task.getAssignedSprint() == null || task.getAssignedSprint().getId() == null) {
            return null;
        }
        Long sprintId = task.getAssignedSprint().getId();
        Long projectId = taskRepository.findProjectIdByTaskId(task.getId()).orElse(null);
        if (projectId != null) {
            List<Sprint> ordered = sprintRepository.findByAssignedProjectIdOrderByStartDateAsc(projectId);
            for (int i = 0; i < ordered.size(); i++) {
                if (sprintId.equals(ordered.get(i).getId())) {
                    return "Sprint " + i;
                }
            }
        }
        return "Sprint " + sprintId;
    }

    private static boolean isValidEmail(String email) {
        if (email == null) {
            return false;
        }
        String trimmed = email.trim();
        return !trimmed.isEmpty() && trimmed.contains("@") && trimmed.contains(".");
    }
}
