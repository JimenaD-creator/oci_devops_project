package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.TaskCreatePayload;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import com.springboot.MyTodoList.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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

    private static String canonicalTaskStatus(String raw) {
        String n = Optional.ofNullable(raw).orElse("").trim().toUpperCase().replaceAll("[\\s-]+", "_");
        if ("IN_PROCESS".equals(n)) return "IN_PROGRESS";
        if ("TO_DO".equals(n) || "PENDING".equals(n)) return "TODO";
        if ("REVIEW".equals(n)) return "IN_REVIEW";
        if ("COMPLETE".equals(n) || "COMPLETED".equals(n)) return "DONE";
        return n;
    }
    
    /**
     * Get all tasks
     */
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks() {
        List<Task> tasks = taskRepository.findAll();
        return ResponseEntity.ok(tasks);
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
            return ResponseEntity.ok(
                    taskService.createTask(payload.getTask(), payload.getAssigneeUserIds()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
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
        List<UserTask> assignments = userTaskRepository.findByTask_Id(id);
        if (!assignments.isEmpty()) {
            userTaskRepository.deleteAll(assignments);
        }
        taskRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
