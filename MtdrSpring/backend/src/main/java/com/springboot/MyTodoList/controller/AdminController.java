package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "http://localhost:3000")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @PostMapping("/projects")
    public ResponseEntity<?> createProject(@RequestBody Map<String, Object> payload) {
        try {
            String name = payload.get("name").toString();
            Long teamId = Long.valueOf(((Map) payload.get("assignedTeam")).get("id").toString());

            Project project = new Project();
            project.setName(name);
            Team team = new Team();
            team.setId(teamId);
            project.setAssignedTeam(team);

            return ResponseEntity.ok(adminService.createProject(project));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/teams")
    public ResponseEntity<?> createTeam(@RequestBody Map<String, Object> payload) {
        try {
            String name = payload.get("name").toString();
            Long managerId = Long.valueOf(((Map) payload.get("manager")).get("id").toString());

            Team team = new Team();
            team.setName(name);
            User manager = new User();
            manager.setId(managerId);
            team.setManager(manager);

            return ResponseEntity.ok(adminService.createTeam(team));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/teams/members")
    public ResponseEntity<?> addMemberToTeam(@RequestBody Map<String, Object> payload) {
        try {
            Long userId = Long.valueOf(((Map) payload.get("user")).get("id").toString());
            Long teamId = Long.valueOf(((Map) payload.get("team")).get("id").toString());
            String role = payload.get("role").toString().toUpperCase();
            return ResponseEntity.ok(adminService.addMemberToTeam(userId, teamId, role));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}