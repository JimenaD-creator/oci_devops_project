package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Sprint;
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

    @GetMapping
    @Cacheable(value = "sprints", key = "#projectId != null ? #projectId : 'all'")
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
    public ResponseEntity<Sprint> createSprint(@RequestBody Sprint sprint) {
        Sprint savedSprint = sprintRepository.save(sprint);
        return ResponseEntity.ok(savedSprint);
    }

    @PutMapping("/{id}")
    @CacheEvict(value = "sprints", allEntries = true)
    public ResponseEntity<Sprint> updateSprint(@PathVariable Long id, @RequestBody Sprint sprintDetails) {
        Optional<Sprint> sprint = sprintRepository.findById(id);
        if (sprint.isPresent()) {
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