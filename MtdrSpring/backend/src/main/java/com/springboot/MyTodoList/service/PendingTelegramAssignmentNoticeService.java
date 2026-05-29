package com.springboot.MyTodoList.service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Queues task-assignment notices for developers who are not on Telegram yet.
 * Delivered on next bot sign-in
 */
@Service
public class PendingTelegramAssignmentNoticeService {

    private static final Logger logger = LoggerFactory.getLogger(PendingTelegramAssignmentNoticeService.class);

    private final ConcurrentHashMap<Long, CopyOnWriteArrayList<PendingAssignmentNotice>> pendingByUserId =
            new ConcurrentHashMap<>();

    @Value("${app.notifications.task-assignment.telegram-pending-on-login.enabled:true}")
    private boolean enabled;

    public boolean isEnabled() {
        return enabled;
    }

    public void enqueue(
            Long userId, Long taskId, String taskTitle, String assignedByName, String priority, String sprintLabel) {
        if (!enabled || userId == null || userId <= 0 || taskId == null) {
            return;
        }
        String title = taskTitle != null && !taskTitle.isBlank() ? taskTitle.trim() : "Untitled task";
        String assigner =
                assignedByName != null && !assignedByName.isBlank() ? assignedByName.trim() : "Your manager";
        PendingAssignmentNotice notice =
                new PendingAssignmentNotice(taskId, title, assigner, trimOrNull(priority), trimOrNull(sprintLabel));
        pendingByUserId.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>()).add(notice);
        logger.info("Queued Telegram assignment notice for userId={} taskId={}", userId, taskId);
    }

    /** Removes and returns all pending notices for this user (shown once on login). */
    public List<PendingAssignmentNotice> drainForUser(Long userId) {
        if (userId == null || userId <= 0) {
            return List.of();
        }
        CopyOnWriteArrayList<PendingAssignmentNotice> list = pendingByUserId.remove(userId);
        if (list == null || list.isEmpty()) {
            return List.of();
        }
        return new ArrayList<>(list);
    }

    public String formatTelegramMessage(PendingAssignmentNotice notice) {
        if (notice == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("📋 New task assigned\n\n");
        sb.append("\"").append(notice.getTaskTitle()).append("\"\n\n");
        sb.append("Assigned by: ").append(notice.getAssignedByName());
        if (notice.getPriority() != null) {
            sb.append("\nPriority: ").append(notice.getPriority());
        }
        if (notice.getSprintLabel() != null) {
            sb.append("\n").append(notice.getSprintLabel());
        }
        sb.append("\n\nUse the menu below or the web portal (My Tasks) to view full details.");
        return sb.toString();
    }

    private static String trimOrNull(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    public static final class PendingAssignmentNotice {
        private final Long taskId;
        private final String taskTitle;
        private final String assignedByName;
        private final String priority;
        private final String sprintLabel;

        public PendingAssignmentNotice(
                Long taskId,
                String taskTitle,
                String assignedByName,
                String priority,
                String sprintLabel) {
            this.taskId = taskId;
            this.taskTitle = taskTitle;
            this.assignedByName = assignedByName;
            this.priority = priority;
            this.sprintLabel = sprintLabel;
        }

        public Long getTaskId() {
            return taskId;
        }

        public String getTaskTitle() {
            return taskTitle;
        }

        public String getAssignedByName() {
            return assignedByName;
        }

        public String getPriority() {
            return priority;
        }

        public String getSprintLabel() {
            return sprintLabel;
        }
    }
}
