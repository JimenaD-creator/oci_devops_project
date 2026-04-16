package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.*;
import com.springboot.MyTodoList.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AdminService {

    @Autowired private ProjectRepository projectRepo;
    @Autowired private TeamRepository teamRepo;
    @Autowired private TeamMemberRepository teamMemberRepo;
    @Autowired private UserRepository userRepo;

    public Project createProject(Project project) {
        Long teamId = project.getAssignedTeam().getId();
        Team team = teamRepo.findById(teamId)
            .orElseThrow(() -> new RuntimeException("EQUIPO NO ENCONTRADO: " + teamId));
        if (projectRepo.existsByAssignedTeamId(teamId)) {
            throw new RuntimeException("EL EQUIPO YA TIENE UN PROYECTO");
        }
        project.setAssignedTeam(team);
        return projectRepo.save(project);
    }

    public Team createTeam(Team team) {
        Long managerId = team.getManager().getId();
        User manager = userRepo.findById(managerId)
            .orElseThrow(() -> new RuntimeException("MANAGER NO ENCONTRADO: " + managerId));
        if (teamRepo.existsByManagerId(managerId)) {
            throw new RuntimeException("EL USUARIO YA ES MANAGER DE OTRO EQUIPO");
        }
        team.setManager(manager);
        return teamRepo.save(team);
    }

    public TeamMember addMemberToTeam(Long userId, Long teamId, String role) {
        User user = userRepo.findById(userId)
            .orElseThrow(() -> new RuntimeException("USUARIO NO ENCONTRADO: " + userId));
        Team team = teamRepo.findById(teamId)
            .orElseThrow(() -> new RuntimeException("EQUIPO NO ENCONTRADO: " + teamId));

        TeamMembersId memberId = new TeamMembersId(teamId, userId);
        TeamMember member = new TeamMember();
        member.setId(memberId);
        member.setUser(user);
        member.setTeam(team);
        member.setRole(role.toUpperCase());
        
        return teamMemberRepo.save(member);
    }
}