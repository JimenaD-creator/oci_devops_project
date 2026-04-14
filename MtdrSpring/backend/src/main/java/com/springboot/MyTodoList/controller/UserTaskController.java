package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
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

    @GetMapping
    public ResponseEntity<List<UserTask>> getAllUserTasks() {
        return ResponseEntity.ok(userTaskRepository.findAll());
    }

    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<List<UserTask>> getUserTasksBySprint(@PathVariable Long sprintId) {
        return ResponseEntity.ok(userTaskRepository.findByTask_AssignedSprint_Id(sprintId));
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

        return ResponseEntity.ok(userTaskRepository.save(userTask));
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