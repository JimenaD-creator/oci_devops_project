package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:3000")
public class ProjectController {

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private TeamMembersRepository teamMembersRepository;

    @GetMapping("/all")
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Project> getProjectById(@PathVariable Long id) {
        return projectRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/manager/{managerId}")
    public ResponseEntity<Project> getProjectByManager(@PathVariable Long managerId) {
        return projectRepository.findByManagerId(managerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{projectId}/developers")
    public ResponseEntity<List<User>> getProjectDevelopers(@PathVariable Long projectId) {
        Optional<Project> projectOpt = projectRepository.findById(projectId);
        if (projectOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Project project = projectOpt.get();
        Long teamId = project.getAssignedTeam() != null ? project.getAssignedTeam().getId() : null;
        if (teamId == null) {
            return ResponseEntity.ok(List.of());
        }

        List<TeamMember> members = teamMembersRepository.findByTeam_Id(teamId);
        Map<Integer, User> byId = new LinkedHashMap<>();
        for (TeamMember tm : members) {
            User user = tm.getUser();
            if (user != null && isDeveloperUser(user)) {
                byId.put(user.getId().intValue(), user);
            }
        }
        User manager = project.getAssignedTeam().getManager();
        if (manager != null && isDeveloperUser(manager)) {
            byId.put(manager.getId().intValue(), manager);
        }

        return ResponseEntity.ok(List.copyOf(byId.values()));
    }

    private boolean isDeveloperUser(User user) {
        String type = user != null ? user.getType() : null;
        if (type == null) return false;
        return type.trim().toLowerCase(Locale.ROOT).contains("developer");
    }
}