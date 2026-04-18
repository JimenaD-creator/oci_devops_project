package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/sprints")
@CrossOrigin(origins = "http://localhost:3000")
public class SprintController {

    @Autowired
    private SprintRepository sprintRepository;

    @Autowired
    private ProjectRepository projectRepository;

    /**
     * JSON sends {@code assignedProject: { id }} only. Hibernate needs a managed {@link Project}
     * reference, not a transient stub, or save fails with TransientPropertyValueException.
     */
    private Optional<ResponseEntity<String>> resolveAssignedProject(Sprint sprint) {
        if (sprint.getAssignedProject() == null || sprint.getAssignedProject().getId() == null) {
            return Optional.of(ResponseEntity.badRequest().body("assignedProject with id is required"));
        }
        Long projectId = sprint.getAssignedProject().getId();
        Optional<Project> found = projectRepository.findById(projectId);
        if (found.isEmpty()) {
            return Optional.of(ResponseEntity.badRequest().body("Project not found for id " + projectId));
        }
        sprint.setAssignedProject(found.get());
        return Optional.empty();
    }

    @GetMapping
    public ResponseEntity<List<Sprint>> getAllSprints(@RequestParam(required = false) Long projectId) {
        List<Sprint> sprints;
        if (projectId != null) {
            sprints = sprintRepository.findByAssignedProjectId(projectId);
        } else {
            sprints = sprintRepository.findAll();
        }
        return ResponseEntity.ok(sprints);
    }

    @GetMapping("/{id}")
    @Cacheable(value = "sprints", key = "#id")
    public ResponseEntity<Sprint> getSprintById(@PathVariable Long id) {
        Optional<Sprint> sprint = sprintRepository.findById(id);
        return sprint.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @CacheEvict(value = "sprints", allEntries = true)
    public ResponseEntity<?> createSprint(@RequestBody Sprint sprint) {
        Optional<ResponseEntity<String>> err = resolveAssignedProject(sprint);
        if (err.isPresent()) {
            return err.get();
        }
        Sprint savedSprint = sprintRepository.save(sprint);
        return ResponseEntity.ok(savedSprint);
    }

    @PutMapping("/{id}")
    @CacheEvict(value = "sprints", allEntries = true)
    public ResponseEntity<?> updateSprint(@PathVariable Long id, @RequestBody Sprint sprintDetails) {
        Optional<Sprint> sprint = sprintRepository.findById(id);
        if (sprint.isPresent()) {
            if (sprintDetails.getAssignedProject() != null && sprintDetails.getAssignedProject().getId() != null) {
                Optional<ResponseEntity<String>> err = resolveAssignedProject(sprintDetails);
                if (err.isPresent()) {
                    return err.get();
                }
            }
            Sprint existingSprint = sprint.get();
            existingSprint.setAssignedProject(sprintDetails.getAssignedProject());
            existingSprint.setStartDate(sprintDetails.getStartDate());
            existingSprint.setDueDate(sprintDetails.getDueDate());
            existingSprint.setCompletionRate(sprintDetails.getCompletionRate());
            existingSprint.setOnTimeDelivery(sprintDetails.getOnTimeDelivery());
            existingSprint.setTeamParticipation(sprintDetails.getTeamParticipation());
            existingSprint.setWorkloadBalance(sprintDetails.getWorkloadBalance());
            existingSprint.setGoal(sprintDetails.getGoal());
            Sprint updatedSprint = sprintRepository.save(existingSprint);
            return ResponseEntity.ok(updatedSprint);
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    @CacheEvict(value = "sprints", allEntries = true)
    public ResponseEntity<Void> deleteSprint(@PathVariable Long id) {
        if (sprintRepository.existsById(id)) {
            sprintRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}