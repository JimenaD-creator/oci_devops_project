package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/user-tasks")
@CrossOrigin(origins = "*")
public class UserTaskController {

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
        return ResponseEntity.ok(userTaskRepository.findAll());
    }

    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<List<UserTask>> getUserTasksBySprint(@PathVariable Long sprintId) {
        return ResponseEntity.ok(userTaskRepository.findByTask_AssignedSprint_Id(sprintId));
    }

    /**
     * All USER_TASK rows for a task (typically zero or one assignee).
     */
    @GetMapping("/task/{taskId}")
    public ResponseEntity<List<UserTask>> getUserTasksByTask(@PathVariable Long taskId) {
        return ResponseEntity.ok(userTaskRepository.findByTask_Id(taskId));
    }

    /**
     * Remove every assignment for this task (e.g. before reassigning to another user).
     */
    @DeleteMapping("/task/{taskId}")
    public ResponseEntity<Void> deleteAssignmentsForTask(@PathVariable Long taskId) {
        List<UserTask> list = userTaskRepository.findByTask_Id(taskId);
        if (!list.isEmpty()) {
            userTaskRepository.deleteAll(list);
        }
        return ResponseEntity.noContent().build();
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
        userTask.setWorkedHours(request.getWorkedHours());
        userTask.setStatus(request.getStatus());

        UserTask saved = userTaskRepository.save(userTask);
        taskAssignmentSyncService.syncTaskStatusFromAssignments(request.getTaskId());
        return ResponseEntity.ok(saved);
    }

    public static class CreateUserTaskRequest {
        private Integer userId;
        private Long taskId;
        private Long workedHours;
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

        public Long getWorkedHours() {
            return workedHours;
        }

        public void setWorkedHours(Long workedHours) {
            this.workedHours = workedHours;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
    }
}