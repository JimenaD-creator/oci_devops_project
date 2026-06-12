package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class TaskAssignmentSyncService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private KpiService kpiService;

    @Autowired
    private ProjectBundleCacheEvictor projectBundleCacheEvictor;

    private void evictDashboardBundleForTask(Long taskId) {
        if (taskId == null) {
            return;
        }
        taskRepository.findProjectIdByTaskId(taskId).ifPresent(projectBundleCacheEvictor::evictDashboardBundle);
    }

    private static String norm(String s) {
        if (s == null) return "";
        String n = s.trim().toUpperCase().replaceAll("[\\s-]+", "_");
        if ("IN_PROCESS".equals(n)) return "IN_PROGRESS";
        if ("TO_DO".equals(n) || "PENDING".equals(n)) return "TODO";
        if ("REVIEW".equals(n)) return "IN_REVIEW";
        if ("COMPLETE".equals(n) || "COMPLETED".equals(n)) return "DONE";
        return n;
    }

    private static boolean isAssigneeDone(String status) {
        String n = norm(status);
        return "DONE".equals(n) || "COMPLETED".equals(n);
    }

    @Transactional
    public Task syncTaskStatusFromAssignments(Long taskId) {
        Optional<Task> opt = taskRepository.findById(taskId);
        if (opt.isEmpty()) return null;

        Task task = opt.get();
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.isEmpty()) {
            Task saved = taskRepository.save(task);
            evictDashboardBundleForTask(taskId);
            return saved;
        }

        boolean allDone       = uts.stream().allMatch(ut -> isAssigneeDone(ut.getStatus()));
        boolean anyInProgress = uts.stream().anyMatch(ut -> "IN_PROGRESS".equals(norm(ut.getStatus())));
        boolean anyInReview   = uts.stream().anyMatch(ut -> "IN_REVIEW".equals(norm(ut.getStatus())));
        boolean anyDone       = uts.stream().anyMatch(ut -> isAssigneeDone(ut.getStatus()));

        String newStatus;
        if (allDone)            newStatus = "DONE";
        else if (anyInReview)   newStatus = "IN_REVIEW";
        else if (anyInProgress) newStatus = "IN_PROGRESS";
        else if (anyDone)       newStatus = "IN_REVIEW";
        else                    newStatus = "TODO";

        String previous = norm(task.getStatus());
        task.setStatus(newStatus);

        if ("DONE".equals(newStatus) && !"DONE".equals(previous)) {
            // Close date = last assignee completion, not "now" (avoids false "task late" in UI/KPIs).
            LocalDateTime closedAt = uts.stream()
                    .map(UserTask::getCompletedAt)
                    .filter(Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(LocalDateTime.now());
            task.setFinishDate(closedAt);
        } else if (!"DONE".equals(newStatus) && "DONE".equals(previous)) {
            task.setFinishDate(task.getDueDate() != null ? task.getDueDate() : LocalDateTime.now());
        }
        task.setUpdatedAt(LocalDateTime.now());

        Task saved = taskRepository.save(task);

        Long sprintId = task.getAssignedSprint() != null ? task.getAssignedSprint().getId() : null;
        if (sprintId != null) {
            triggerKpiRecalc(sprintId);
        }

        evictDashboardBundleForTask(taskId);
        return saved;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void triggerKpiRecalc(Long sprintId) {
        try {
            kpiService.calculateAndSaveKpisForSprint(sprintId);
        } catch (Exception e) {
            System.err.println("[TaskAssignmentSyncService] KPI recalc failed for sprint " + sprintId + ": " + e.getMessage());
        }
    }
}