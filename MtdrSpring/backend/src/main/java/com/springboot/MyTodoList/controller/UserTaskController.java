package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/user-tasks")
@CrossOrigin(origins = "*")
public class UserTaskController {

    @Autowired
    private UserTaskRepository userTaskRepository;

    @GetMapping
    public ResponseEntity<List<UserTask>> getAllUserTasks() {
        return ResponseEntity.ok(userTaskRepository.findAll());
    }

    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<List<UserTask>> getUserTasksBySprint(@PathVariable Long sprintId) {
        return ResponseEntity.ok(userTaskRepository.findByTask_AssignedSprint_Id(sprintId));
    }
}