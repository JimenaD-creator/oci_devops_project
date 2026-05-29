package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
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
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

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

    @Value("${app.notifications.task-assignment.enabled:true}")
    private boolean enabled;

    @Async
    public void notifyAssigneesOnTaskCreated(Task task, List<Long> assigneeUserIds) {
        if (task == null || task.getId() == null) {
            return;
        }
        notifyAssignees(task, distinctPositiveIds(assigneeUserIds));
    }

    /** Notifies only developers newly added when editing assignees on an existing task. */
    @Async
    public void notifyNewAssigneesOnReassignment(Long taskId, List<Long> newAssigneeUserIds) {
        if (!enabled || taskId == null) {
            return;
        }
        Set<Long> distinct = distinctPositiveIds(newAssigneeUserIds);
        if (distinct.isEmpty()) {
            return;
        }
        Optional<Task> taskOpt = taskRepository.findById(taskId);
        if (taskOpt.isEmpty()) {
            logger.warn("Skipping reassignment emails: task {} not found", taskId);
            return;
        }
        notifyAssignees(taskOpt.get(), distinct);
    }

    private void notifyAssignees(Task task, Set<Long> assigneeUserIds) {
        if (!enabled || task == null || task.getId() == null || assigneeUserIds.isEmpty()) {
            return;
        }

        String assignedBy = resolveAssignerDisplayName();
        String taskTitle = task.getTitle() != null ? task.getTitle().trim() : "Untitled task";
        String priority = task.getPriority() != null && !task.getPriority().isBlank()
                ? task.getPriority().trim()
                : null;
        String sprintLabel = formatSprintLabel(task.getAssignedSprint());

        for (Long userId : assigneeUserIds) {
            try {
                User assignee = userRepository.findById(userId).orElse(null);
                if (assignee == null) {
                    logger.warn("Skipping assignment email: user {} not found", userId);
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

    private String resolveAssignerDisplayName() {
        return SecurityUtils.currentJwt()
                .map(jwt -> {
                    Object name = jwt.getClaim("name");
                    if (name != null) {
                        String s = String.valueOf(name).trim();
                        if (!s.isBlank()) {
                            return s;
                        }
                    }
                    return null;
                })
                .orElseGet(() -> userRepository
                        .findById(SecurityUtils.currentUserId().orElse(-1L))
                        .map(User::getName)
                        .filter(n -> n != null && !n.isBlank())
                        .map(String::trim)
                        .orElse("Your manager"));
    }

    private static String formatSprintLabel(Sprint sprint) {
        if (sprint == null || sprint.getId() == null) {
            return null;
        }
        if (sprint.getGoal() != null && !sprint.getGoal().isBlank()) {
            String goal = sprint.getGoal().trim();
            if (goal.length() > 80) {
                goal = goal.substring(0, 77) + "...";
            }
            return "Sprint #" + sprint.getId() + " — " + goal;
        }
        return "Sprint #" + sprint.getId();
    }

    private static boolean isValidEmail(String email) {
        if (email == null) {
            return false;
        }
        String trimmed = email.trim();
        return !trimmed.isEmpty() && trimmed.contains("@") && trimmed.contains(".");
    }
}
