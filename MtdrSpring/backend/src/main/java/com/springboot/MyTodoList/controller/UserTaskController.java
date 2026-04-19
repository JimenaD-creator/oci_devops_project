package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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

    @GetMapping
    public ResponseEntity<List<UserTask>> getAllUserTasks() {
        try {
            return ResponseEntity.ok(userTaskRepository.findAllWithUserAndTask());
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
        return ResponseEntity.ok(userTaskRepository.findByTask_Id(taskId));
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

        UserTaskId id = new UserTaskId(userId, taskId);
        UserTask userTask = userTaskRepository.findById(id)
                .orElseGet(() -> new UserTask(user, task));

        /*
         * UI often sends only { userId, taskId, status } when marking an assignee complete.
         * Do not default workedHours to 0 — that wiped WORKED_HOURS. Only overwrite when the client sends the field.
         */
        long hoursToSave;
        if (payload.containsKey("workedHours") && payload.get("workedHours") != null) {
            hoursToSave = ((Number) payload.get("workedHours")).longValue();
        } else if (userTask.getWorkedHours() != null) {
            hoursToSave = userTask.getWorkedHours();
        } else {
            hoursToSave = 0L;
        }

        userTask.setStatus(status != null ? status.toUpperCase() : "TODO");
        userTask.setWorkedHours(hoursToSave);

        UserTask saved = userTaskRepository.save(userTask);
        taskAssignmentSyncService.syncTaskStatusFromAssignments(taskId);

        return ResponseEntity.ok(saved);

    } catch (Exception e) {
        LOGGER.error("Error creating user task", e);
        return ResponseEntity.internalServerError().build(); // ✅ 500, not 400
    }}
    
    @PostMapping("/test")
public ResponseEntity<String> testInsert() {
    try {
        // Cambia estos IDs por unos que SÍ existan en tu BD
        Long userId = 1L;
        Long taskId = 1L;

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("USER NOT FOUND: " + userId));
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new RuntimeException("TASK NOT FOUND: " + taskId));

        UserTask ut = new UserTask(user, task);
        ut.setStatus("TODO");
        ut.setWorkedHours(0L);

        UserTask saved = userTaskRepository.save(ut);
        return ResponseEntity.ok("OK — saved with id: " + saved.getId());

    } catch (Exception e) {
        // Imprime TODA la cadena de errores
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