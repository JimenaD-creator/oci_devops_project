package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/user-tasks")
@CrossOrigin(origins = "http://localhost:3000")
public class UserTaskController {

    @Autowired
    private UserTaskRepository userTaskRepository;

    @GetMapping
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