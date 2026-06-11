package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.DashboardTaskDto;
import com.springboot.MyTodoList.dto.TaskBulkDeletePayload;
import com.springboot.MyTodoList.dto.TaskBulkDeleteResult;
import com.springboot.MyTodoList.dto.TaskCreatePayload;
import com.springboot.MyTodoList.dto.TaskNewAssigneesPayload;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.service.TaskAssignmentNotificationService;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import com.springboot.MyTodoList.service.TaskService;
import com.springboot.MyTodoList.service.ProjectBundleCacheEvictor;
import com.springboot.MyTodoList.realtime.ProjectTaskEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    
    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @Autowired
    private TaskService taskService;

    @Autowired
    private TaskAssignmentNotificationService taskAssignmentNotificationService;

    @Autowired
    private ProjectTaskEventPublisher projectTaskEventPublisher;

    @Autowired
    private ProjectBundleCacheEvictor projectBundleCacheEvictor;

    private void evictDashboardBundleForTask(Long taskId) {
        if (taskId == null) {
            return;
        }
        taskRepository.findProjectIdByTaskId(taskId).ifPresent(projectBundleCacheEvictor::evictDashboardBundle);
    }

    private static String canonicalTaskStatus(String raw) {
        String n = Optional.ofNullable(raw).orElse("").trim().toUpperCase().replaceAll("[\\s-]+", "_");
        if ("IN_PROCESS".equals(n)) return "IN_PROGRESS";
        if ("TO_DO".equals(n) || "PENDING".equals(n)) return "TODO";
        if ("REVIEW".equals(n)) return "IN_REVIEW";
        if ("COMPLETE".equals(n) || "COMPLETED".equals(n)) return "DONE";
        return n;
    }
    
    /**
     * Get tasks, optionally filtered by project (via sprint).
     */
    @GetMapping
    public ResponseEntity<?> getAllTasks(@RequestParam(required = false) Long projectId) {
        if (projectId != null) {
            List<DashboardTaskDto> tasks = taskRepository.findByProjectIdWithSprint(projectId).stream()
                    .map(DashboardTaskDto::from)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(tasks);
        }
        return ResponseEntity.ok(taskRepository.findAll());
    }
    
    /**
     * Get task by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Task> getTaskById(@PathVariable Long id) {
        Optional<Task> task = taskRepository.findById(id);
        if (task.isPresent()) {
            return ResponseEntity.ok(task.get());
        }
        return ResponseEntity.notFound().build();
    }
    
    /**
     * Create new task
     */
    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody TaskCreatePayload payload) {
        if (payload == null || payload.getTask() == null) {
            return ResponseEntity.badRequest().build();
        }
        try {
            Task created = taskService.createTask(payload.getTask(), payload.getAssigneeUserIds());
            taskAssignmentNotificationService.notifyAssigneesOnTaskCreated(
                    created, payload.getAssigneeUserIds());
            return ResponseEntity.ok(created);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }
    
    /**
     * Notify developers who were newly assigned when editing an existing task (assignee list changed).
     */
    @PostMapping("/{id}/notify-new-assignees")
    public ResponseEntity<Void> notifyNewAssignees(
            @PathVariable Long id, @RequestBody TaskNewAssigneesPayload payload) {
        if (!taskRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<Long> newIds =
                payload != null ? payload.normalizedNewAssigneeUserIds() : List.of();
        if (newIds.isEmpty()) {
            return ResponseEntity.noContent().build();
        }
        taskAssignmentNotificationService.notifyNewAssigneesOnReassignment(id, newIds);
        return ResponseEntity.accepted().build();
    }

    /**
     * Update task
     */
    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task taskDetails) {
        Optional<Task> task = taskRepository.findById(id);
        if (task.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Task existingTask = task.get();
        LocalDateTime previousFinish = existingTask.getFinishDate();
        String previousStatus = canonicalTaskStatus(existingTask.getStatus());

        existingTask.setAssignedSprint(taskDetails.getAssignedSprint());
        existingTask.setClassification(taskDetails.getClassification());
        existingTask.setTitle(taskDetails.getTitle());
        existingTask.setDescription(taskDetails.getDescription());
        existingTask.setPriority(taskDetails.getPriority());
        existingTask.setAssignedHours(taskDetails.getAssignedHours());
        existingTask.setStartDate(taskDetails.getStartDate());
        existingTask.setDueDate(taskDetails.getDueDate());
        existingTask.setUpdatedAt(LocalDateTime.now());

        List<UserTask> assignments = userTaskRepository.findByTask_Id(id);
        String newStatus = canonicalTaskStatus(taskDetails.getStatus());

        if (assignments.isEmpty()) {
            existingTask.setStatus(newStatus);
            boolean wasDone = "DONE".equals(previousStatus);
            boolean nowDone = "DONE".equals(newStatus);
            if (nowDone && !wasDone) {
                existingTask.setFinishDate(LocalDateTime.now());
            } else if (nowDone && wasDone) {
                existingTask.setFinishDate(previousFinish);
            } else if (taskDetails.getDueDate() != null) {
                existingTask.setFinishDate(taskDetails.getDueDate());
            }
            Task updatedTask = taskRepository.save(existingTask);
            evictDashboardBundleForTask(id);
            projectTaskEventPublisher.taskUpdated(id, null, "rest");
            return ResponseEntity.ok(updatedTask);
        }

        /* Multiple assignees: TASK.STATUS is derived from USER_TASK rows; task is DONE only if everyone is DONE. */
        if (newStatus != null) {
            if ("DONE".equals(newStatus)) {
                boolean allAssigneesDone = assignments.stream()
                    .allMatch(ut -> {
                        String st = canonicalTaskStatus(ut.getStatus());
                        return "DONE".equals(st);
                    });
                if (!allAssigneesDone) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).build();
                }
            } else {
                for (UserTask ut : assignments) {
                    ut.setStatus(newStatus);
                    userTaskRepository.save(ut);
                }
            }
        }

        taskRepository.save(existingTask);
        Task synced = taskAssignmentSyncService.syncTaskStatusFromAssignments(id);
        projectTaskEventPublisher.taskUpdated(id, null, "rest");
        return ResponseEntity.ok(synced != null ? synced : taskRepository.findById(id).orElse(existingTask));
    }
    
    /**
     * Delete task and its USER_TASK rows (FK-safe).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        if (!taskRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        taskService.deleteTaskById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Delete multiple tasks and their USER_TASK rows (FK-safe).
     */
    @PostMapping("/bulk-delete")
    public ResponseEntity<?> bulkDeleteTasks(@RequestBody TaskBulkDeletePayload payload) {
        List<Long> ids = payload != null ? payload.normalizedTaskIds() : List.of();
        if (ids.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        int deletedCount = taskService.deleteTasksByIds(ids);
        if (deletedCount < 1) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new TaskBulkDeleteResult(deletedCount, ids.size()));
        }
        return ResponseEntity.ok(new TaskBulkDeleteResult(deletedCount, ids.size()));
    }
}
