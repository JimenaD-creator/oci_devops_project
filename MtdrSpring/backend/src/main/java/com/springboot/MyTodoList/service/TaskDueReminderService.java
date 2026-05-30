package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Sends email reminders to developers when an assigned task is due within a configured window
 * (default 72 hours) or already overdue, and the assignee has not marked their work complete.
 */
@Service
public class TaskDueReminderService {

    private static final Logger logger = LoggerFactory.getLogger(TaskDueReminderService.class);
    private static final DateTimeFormatter DUE_FORMAT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' h:mm a", Locale.ENGLISH);

    private final UserTaskRepository userTaskRepository;
    private final EmailService emailService;

    /** userId:taskId → epoch ms when reminder was sent (in-memory; resets on pod restart). */
    private final ConcurrentHashMap<String, Long> sentReminderKeys = new ConcurrentHashMap<>();

    @Value("${app.notifications.task-due-reminder.enabled:true}")
    private boolean enabled;

    @Value("${app.notifications.task-due-reminder.hours-before-due:72}")
    private int hoursBeforeDue;

    public TaskDueReminderService(UserTaskRepository userTaskRepository, EmailService emailService) {
        this.userTaskRepository = userTaskRepository;
        this.emailService = emailService;
    }

    @Scheduled(cron = "${app.notifications.task-due-reminder.cron:0 0 8,14 * * *}")
    public void sendDueRemindersScheduled() {
        if (!enabled) {
            return;
        }
        int sent = processDueReminders();
        if (sent > 0) {
            logger.info("Task due reminder job sent {} email(s)", sent);
        }
    }

    /** For tests or manual invocation. Returns number of emails sent. */
    public int processDueReminders() {
        if (!enabled) {
            return 0;
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowEnd = now.plusHours(Math.max(1, hoursBeforeDue));
        List<UserTask> candidates = userTaskRepository.findAssignmentsDueBefore(windowEnd);
        int sent = 0;
        for (UserTask ut : candidates) {
            if (trySendReminder(ut, now)) {
                sent++;
            }
        }
        purgeOldSentKeys();
        return sent;
    }

    private boolean trySendReminder(UserTask ut, LocalDateTime now) {
        if (ut == null || ut.getUser() == null || ut.getTask() == null) {
            return false;
        }
        if (ut.isCompletedAssignment()) {
            return false;
        }
        Task task = ut.getTask();
        LocalDateTime due = task.getDueDate();
        if (due == null) {
            return false;
        }
        if (due.isAfter(now.plusHours(Math.max(1, hoursBeforeDue)))) {
            return false;
        }

        User assignee = ut.getUser();
        Long userId = assignee.getId();
        Long taskId = task.getId();
        if (userId == null || taskId == null) {
            return false;
        }

        String dedupeKey = userId + ":" + taskId;
        if (sentReminderKeys.containsKey(dedupeKey)) {
            return false;
        }

        String email = assignee.getEmail();
        if (!isValidEmail(email)) {
            logger.debug(
                    "Skipping due reminder for user {} task {}: no valid email",
                    userId,
                    taskId);
            return false;
        }

        String assigneeName =
                assignee.getName() != null && !assignee.getName().isBlank()
                        ? assignee.getName().trim()
                        : "there";
        String taskTitle = task.getTitle() != null ? task.getTitle().trim() : "Untitled task";
        String dueLabel = formatDueLabel(due, now);
        String managerContact = resolveManagerContact(task);
        String sprintLabel = formatSprintLabel(task.getAssignedSprint());
        String priority =
                task.getPriority() != null && !task.getPriority().isBlank()
                        ? task.getPriority().trim()
                        : null;

        emailService.sendTaskDueReminderEmail(
                email.trim(),
                assigneeName,
                taskTitle,
                dueLabel,
                priority,
                sprintLabel,
                managerContact);

        sentReminderKeys.put(dedupeKey, System.currentTimeMillis());
        logger.info("Task due reminder queued for userId={} taskId={} due={}", userId, taskId, due);
        return true;
    }

    private static String formatDueLabel(LocalDateTime due, LocalDateTime now) {
        if (due.isBefore(now)) {
            long daysLate = ChronoUnit.DAYS.between(due.toLocalDate(), now.toLocalDate());
            if (daysLate <= 0) {
                return "Overdue (due " + DUE_FORMAT.format(due) + ")";
            }
            return "Overdue by " + daysLate + " day(s) (was due " + DUE_FORMAT.format(due) + ")";
        }
        long hoursLeft = ChronoUnit.HOURS.between(now, due);
        if (hoursLeft < 24) {
            return "Due in about " + Math.max(1, hoursLeft) + " hour(s) (" + DUE_FORMAT.format(due) + ")";
        }
        long daysLeft = ChronoUnit.DAYS.between(now.toLocalDate(), due.toLocalDate());
        return "Due in about " + Math.max(1, daysLeft) + " day(s) (" + DUE_FORMAT.format(due) + ")";
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

    private static String resolveManagerContact(Task task) {
        if (task == null || task.getAssignedSprint() == null) {
            return "your manager";
        }
        Project project = task.getAssignedSprint().getAssignedProject();
        if (project == null || project.getAssignedTeam() == null) {
            return "your manager";
        }
        Team team = project.getAssignedTeam();
        User manager = team.getManager();
        if (manager == null) {
            return "your manager";
        }
        String name = manager.getName() != null ? manager.getName().trim() : "";
        String email = manager.getEmail() != null ? manager.getEmail().trim() : "";
        if (!name.isBlank() && isValidEmail(email)) {
            return name + " (" + email + ")";
        }
        if (!name.isBlank()) {
            return name;
        }
        if (isValidEmail(email)) {
            return email;
        }
        return "your manager";
    }

    private static boolean isValidEmail(String email) {
        if (email == null) {
            return false;
        }
        String trimmed = email.trim();
        return !trimmed.isEmpty() && trimmed.contains("@") && trimmed.contains(".");
    }

    private void purgeOldSentKeys() {
        long cutoff = System.currentTimeMillis() - ChronoUnit.DAYS.getDuration().toMillis() * 30;
        sentReminderKeys.entrySet().removeIf(e -> e.getValue() < cutoff);
    }
}
