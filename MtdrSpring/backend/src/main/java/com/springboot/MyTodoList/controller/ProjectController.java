package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import com.springboot.MyTodoList.service.ProjectAccessAuthorization;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.util.UserRoleUtil;
import java.util.LinkedHashMap;
import java.util.List;
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

    @Autowired
    private ProjectLookupService projectLookupService;

    @Autowired
    private ProjectAccessAuthorization projectAccessAuthorization;

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
        if (!projectAccessAuthorization.managerMayAccess(managerId)) {
            return ResponseEntity.status(403).build();
        }
        return projectLookupService.findPrimaryProjectForManager(managerId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * All projects for the team managed by {@code managerId}.
     * Only that manager (or an admin) may call this — never another manager's projects.
     */
    @GetMapping("/manager/{managerId}/list")
    public ResponseEntity<List<Project>> getProjectsByManagerList(@PathVariable Long managerId) {
        if (!projectAccessAuthorization.managerMayAccess(managerId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(projectLookupService.findAllProjectsForManager(managerId));
    }

    @GetMapping("/developer/{userId}")
    public ResponseEntity<Project> getProjectByDeveloper(@PathVariable Long userId) {
        if (!projectAccessAuthorization.developerMayAccess(userId)) {
            return ResponseEntity.status(403).build();
        }
        return projectLookupService.findPrimaryProjectForDeveloper(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** All projects for teams this developer belongs to (same team may have several projects). */
    @GetMapping("/developer/{userId}/list")
    public ResponseEntity<List<Project>> getProjectsByDeveloperList(@PathVariable Long userId) {
        if (!projectAccessAuthorization.developerMayAccess(userId)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(projectLookupService.findAllProjectsForDeveloper(userId));
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
            if (user != null && UserRoleUtil.isDeveloperUser(user)) {
                byId.put(user.getId().intValue(), user);
            }
        }
        User manager = project.getAssignedTeam().getManager();
        if (manager != null && UserRoleUtil.isDeveloperUser(manager)) {
            byId.put(manager.getId().intValue(), manager);
        }

        return ResponseEntity.ok(List.copyOf(byId.values()));
    }

}