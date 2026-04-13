package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectRepository projectRepository;

    @GetMapping("/all")
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    @GetMapping("/manager/{userId}")
    public ResponseEntity<Project> getProjectByManager(@PathVariable Integer userId) {
        Project project = projectRepository.findByManagerId(userId);
        return project != null ? ResponseEntity.ok(project) : ResponseEntity.notFound().build();
    }
}