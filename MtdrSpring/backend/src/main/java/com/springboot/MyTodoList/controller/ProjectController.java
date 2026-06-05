package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.DashboardBundleResponse;
import com.springboot.MyTodoList.dto.TeamRosterDto;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.service.DashboardBundleService;
import com.springboot.MyTodoList.service.ProjectAccessAuthorization;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.ProjectTeamRosterService;
import java.util.List;
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
    private ProjectLookupService projectLookupService;

    @Autowired
    private ProjectAccessAuthorization projectAccessAuthorization;

    @Autowired
    private ProjectTeamRosterService projectTeamRosterService;

    @Autowired
    private DashboardBundleService dashboardBundleService;

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

    /**
     * Single optimized payload for dashboard / tasks / sprints initial load.
     */
    /**
     * Dashboard bundle — same access model as {@code /api/sprints?projectId=} (any authenticated user).
     * Do not gate on {@code userMayAccessProject}; that returned 403 in prod for valid managers.
     */
    @GetMapping("/{projectId}/dashboard-bundle")
    public ResponseEntity<DashboardBundleResponse> getDashboardBundle(@PathVariable Long projectId) {
        return dashboardBundleService
                .loadBundle(projectId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{projectId}/developers")
    public ResponseEntity<List<TeamRosterDto>> getProjectDevelopers(@PathVariable Long projectId) {
        return projectTeamRosterService
                .findProject(projectId)
                .map(project -> ResponseEntity.ok(projectTeamRosterService.listDevelopersForProject(project)))
                .orElse(ResponseEntity.notFound().build());
    }
}
