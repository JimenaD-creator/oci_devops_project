package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.repository.TeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/teams")
public class TeamController {
    
    @Autowired
    private TeamRepository teamRepository;
    
    /**
     * Get all teams
     */
    @GetMapping
    public ResponseEntity<List<Team>> getAllTeams() {
        List<Team> teams = teamRepository.findAll();
        return ResponseEntity.ok(teams);
    }
    
    /**
     * Get team by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<Team> getTeamById(@PathVariable Long id) {
        Optional<Team> team = teamRepository.findById(id);
        if (team.isPresent()) {
            return ResponseEntity.ok(team.get());
        }
        return ResponseEntity.notFound().build();
    }
    
    /**
     * Create new team
     */
    @PostMapping
    public ResponseEntity<Team> createTeam(@RequestBody Team team) {
        Team savedTeam = teamRepository.save(team);
        return ResponseEntity.ok(savedTeam);
    }
    
    /**
     * Update team
     */
    @PutMapping("/{id}")
    public ResponseEntity<Team> updateTeam(@PathVariable Long id, @RequestBody Team teamDetails) {
        Optional<Team> team = teamRepository.findById(id);
        if (team.isPresent()) {
            Team existingTeam = team.get();
            existingTeam.setName(teamDetails.getName());
            existingTeam.setAssignedManager(teamDetails.getAssignedManager());
            Team updatedTeam = teamRepository.save(existingTeam);
            return ResponseEntity.ok(updatedTeam);
        }
        return ResponseEntity.notFound().build();
    }
    
    /**
     * Delete team
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTeam(@PathVariable Long id) {
        if (teamRepository.existsById(id)) {
            teamRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
