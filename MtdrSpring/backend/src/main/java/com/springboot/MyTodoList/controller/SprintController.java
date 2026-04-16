package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.repository.SprintRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/sprints")
public class SprintController {
    
    @Autowired
    private SprintRepository sprintRepository;
    
    /**
     * Get all sprints
     */
    @GetMapping
    public ResponseEntity<List<Sprint>> getAllSprints() {
        List<Sprint> sprints = sprintRepository.findAll();
        return ResponseEntity.ok(sprints);
    }
    
    /**
     * Get sprint by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Sprint> getSprintById(@PathVariable Long id) {
        Optional<Sprint> sprint = sprintRepository.findById(id);
        if (sprint.isPresent()) {
            return ResponseEntity.ok(sprint.get());
        }
        return ResponseEntity.notFound().build();
    }
    
    /**
     * Create new sprint
     */
    @PostMapping
    public ResponseEntity<Sprint> createSprint(@RequestBody Sprint sprint) {
        Sprint savedSprint = sprintRepository.save(sprint);
        return ResponseEntity.ok(savedSprint);
    }
    
    /**
     * Update sprint
     */
    @PutMapping("/{id}")
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
    
    /**
     * Delete sprint
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSprint(@PathVariable Long id) {
        if (sprintRepository.existsById(id)) {
            sprintRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
