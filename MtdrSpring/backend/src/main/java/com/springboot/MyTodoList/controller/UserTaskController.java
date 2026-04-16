package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/user-tasks")
@CrossOrigin(origins = "http://localhost:3000")
public class UserTaskController {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserTaskController.class);

    @Autowired
    private UserTaskRepository userTaskRepository;

    @GetMapping
    public ResponseEntity<List<UserTask>> getAllUserTasks() {
        try {
            return ResponseEntity.ok(userTaskRepository.findAllWithUserAndTask());
        } catch (Exception e) {
            LOGGER.warn("findAllWithUserAndTask failed, falling back to findAll", e);
            return ResponseEntity.ok(userTaskRepository.findAll());
        }
    public List<UserTask> getAllUserTasks() {
        return userTaskRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserTask> getUserTaskById(@PathVariable Long id) {
        return userTaskRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public UserTask createUserTask(@RequestBody UserTask userTask) {
        return userTaskRepository.save(userTask);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserTask> updateUserTask(@PathVariable Long id, @RequestBody UserTask userTaskDetails) {
        return userTaskRepository.findById(id).map(userTask -> {
            userTask.setTask(userTaskDetails.getTask());
            userTask.setUser(userTaskDetails.getUser());
            return ResponseEntity.ok(userTaskRepository.save(userTask));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<UserTask> createUserTask(@RequestBody CreateUserTaskRequest request) {
        if (request == null || request.getUserId() == null || request.getTaskId() == null) {
            return ResponseEntity.badRequest().build();
        }

        Optional<User> userOpt = userRepository.findById(request.getUserId());
        Optional<Task> taskOpt = taskRepository.findById(request.getTaskId());
        if (userOpt.isEmpty() || taskOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();
        Task task = taskOpt.get();
        UserTaskId id = new UserTaskId(user.getID(), task.getId());
        UserTask userTask = userTaskRepository.findById(id).orElseGet(UserTask::new);

        userTask.setId(id);
        userTask.setUser(user);
        userTask.setTask(task);
        /* Estimación de la tarea va en TASK.ASSIGNED_HOURS; WORKED_HOURS no se escribe aquí (solo vía UserTaskService / bot). */
        userTask.setStatus(request.getStatus());

        UserTask saved = userTaskRepository.save(userTask);
        taskAssignmentSyncService.syncTaskStatusFromAssignments(request.getTaskId());
        return ResponseEntity.ok(saved);
    }

    public static class CreateUserTaskRequest {
        private Integer userId;
        private Long taskId;
        private String status;

        public Integer getUserId() {
            return userId;
        }

        public void setUserId(Integer userId) {
            this.userId = userId;
        }

        public Long getTaskId() {
            return taskId;
        }

        public void setTaskId(Long taskId) {
            this.taskId = taskId;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUserTask(@PathVariable Long id) {
        userTaskRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/user/{userId}")
    public List<UserTask> getUserTasksByUserId(@PathVariable Long userId) {
        return userTaskRepository.findByUser_Id(userId);
    }
}