package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.DashboardUserTaskDto;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import com.springboot.MyTodoList.service.UserTaskService;
import com.springboot.MyTodoList.realtime.ProjectTaskEventPublisher;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user-tasks")
@CrossOrigin(origins = "*")
public class UserTaskController {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserTaskController.class);

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @Autowired
    private UserTaskService userTaskService;

    @Autowired
    private ProjectTaskEventPublisher projectTaskEventPublisher;

    @GetMapping("/my-blockers")
    public ResponseEntity<List<Map<String, Object>>> getMyBlockers(
            @RequestParam Long userId,
            @RequestParam Long projectId) {
        if (userId == null || projectId == null) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(userTaskService.listBlockedReportsForDeveloper(userId, projectId));
    }

    @PostMapping("/my-blockers/resolve")
    public ResponseEntity<UserTask> resolveMyBlocker(
            @RequestParam Long userId,
            @RequestParam Long taskId) {
        if (userId == null || taskId == null) {
            return ResponseEntity.badRequest().build();
        }
        try {
            return ResponseEntity.ok(userTaskService.resolveBlockedReport(userId, taskId));
        } catch (IllegalArgumentException e) {
            LOGGER.warn("resolveMyBlocker rejected: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            LOGGER.error("Error resolving blocker for userId {} taskId {}", userId, taskId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping
    public ResponseEntity<?> getAllUserTasks(@RequestParam(required = false) Long projectId) {
        try {
            if (projectId != null) {
                List<DashboardUserTaskDto> rows = userTaskRepository.findByProjectIdWithUserAndTask(projectId).stream()
                        .map(DashboardUserTaskDto::from)
                        .collect(Collectors.toList());
                return ResponseEntity.ok(rows);
            }
            List<DashboardUserTaskDto> rows = userTaskRepository.findAllWithUserAndTask().stream()
                    .map(DashboardUserTaskDto::from)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(rows);
        } catch (Exception e) {
            LOGGER.warn("findAllWithUserAndTask failed, falling back to findAll", e);
            return ResponseEntity.ok(userTaskRepository.findAll());
        }
    }

    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<List<UserTask>> getUserTasksBySprint(@PathVariable Long sprintId) {
        return ResponseEntity.ok(userTaskRepository.findByTask_AssignedSprint_Id(sprintId));
    }

    @GetMapping("/task/{taskId}")
    public ResponseEntity<List<UserTask>> getUserTasksByTask(@PathVariable Long taskId) {
        try {
            return ResponseEntity.ok(userTaskRepository.findByTaskIdWithUserAndTask(taskId));
        } catch (Exception e) {
            LOGGER.warn("findByTaskIdWithUserAndTask failed for task {}, using simple find", taskId, e);
            return ResponseEntity.ok(userTaskRepository.findByTask_Id(taskId));
        }
    }

    @DeleteMapping("/task/{taskId}")
    public ResponseEntity<Void> deleteAssignmentsForTask(@PathVariable Long taskId) {
        List<UserTask> list = userTaskRepository.findByTask_Id(taskId);
        if (!list.isEmpty()) {
            userTaskRepository.deleteAll(list);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    public ResponseEntity<UserTask> createUserTask(@RequestBody Map<String, Object> payload) {
        try {
            Number userIdNum = (Number) payload.get("userId");
            Number taskIdNum = (Number) payload.get("taskId");
            String status = (String) payload.get("status");

            if (userIdNum == null || taskIdNum == null) {
                return ResponseEntity.badRequest().build();
            }

            Long userId = userIdNum.longValue();
            Long taskId = taskIdNum.longValue();

            User user = userRepository.findById(userId).orElse(null);
            Task task = taskRepository.findById(taskId).orElse(null);

            if (user == null || task == null) {
                return ResponseEntity.notFound().build();
            }

            List<UserTask> existingOnTask = userTaskRepository.findByTask_Id(taskId);
            if (!existingOnTask.isEmpty()) {
                boolean forThisUser = existingOnTask.stream()
                        .anyMatch(ut -> userId.equals(ut.getUser().getId()));
                if (!forThisUser || existingOnTask.size() > 1) {
                    return ResponseEntity.status(org.springframework.http.HttpStatus.CONFLICT).build();
                }
            }

            UserTaskId id = new UserTaskId(userId, taskId);
            UserTask userTask = userTaskRepository.findById(id)
                    .orElseGet(() -> new UserTask(user, task));

            String newStatus = status != null ? status.toUpperCase() : "TODO";
            boolean wasDone = userTask.isCompletedAssignment();
            userTask.setStatus(newStatus);
            boolean nowDone = userTask.isCompletedAssignment();

            /*
             * Reopening (COMPLETED → other): clear hours so the next completion logs a fresh total.
             * Completing without workedHours in payload: keep existing total (setStatus does not clear).
             */
            double hoursToSave;
            if (!nowDone && wasDone) {
                hoursToSave = 0.0;
            } else if (payload.containsKey("workedHours") && payload.get("workedHours") != null) {
                hoursToSave = Math.max(0.0, ((Number) payload.get("workedHours")).doubleValue());
            } else if (userTask.getWorkedHours() != null) {
                hoursToSave = userTask.getWorkedHours();
            } else {
                hoursToSave = 0.0;
            }

            userTask.setWorkedHours(hoursToSave);

            UserTask saved = userTaskRepository.save(userTask);
            taskAssignmentSyncService.syncTaskStatusFromAssignments(taskId);
            projectTaskEventPublisher.taskUpdated(taskId, userId, "rest");

            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            LOGGER.error("Error creating user task", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/test")
    public ResponseEntity<String> testInsert() {
        try {
            Long userId = 1L;
            Long taskId = 1L;

            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("USER NOT FOUND: " + userId));
            Task task = taskRepository.findById(taskId)
                    .orElseThrow(() -> new RuntimeException("TASK NOT FOUND: " + taskId));

            UserTask ut = new UserTask(user, task);
            ut.setStatus("TODO");
            ut.setWorkedHours(0.0);

            UserTask saved = userTaskRepository.save(ut);
            return ResponseEntity.ok("OK — saved with id: " + saved.getId());
        } catch (Exception e) {
            StringBuilder sb = new StringBuilder();
            Throwable t = e;
            while (t != null) {
                sb.append(t.getClass().getSimpleName())
                        .append(": ")
                        .append(t.getMessage())
                        .append("\n");
                t = t.getCause();
            }
            LOGGER.error("TEST INSERT FAILED:\n{}", sb.toString());
            return ResponseEntity.internalServerError().body(sb.toString());
        }
    }
}