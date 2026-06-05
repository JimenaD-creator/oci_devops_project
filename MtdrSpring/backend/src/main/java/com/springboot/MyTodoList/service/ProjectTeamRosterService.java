package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.dto.TeamRosterDto;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import com.springboot.MyTodoList.util.UserRoleUtil;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ProjectTeamRosterService {

    private final ProjectRepository projectRepository;
    private final TeamMembersRepository teamMembersRepository;

    public ProjectTeamRosterService(
            ProjectRepository projectRepository, TeamMembersRepository teamMembersRepository) {
        this.projectRepository = projectRepository;
        this.teamMembersRepository = teamMembersRepository;
    }

    public Optional<Project> findProject(Long projectId) {
        return projectRepository.findById(projectId);
    }

    public List<TeamRosterDto> listDevelopersForProject(Project project) {
        if (project == null) {
            return List.of();
        }
        Team team = project.getAssignedTeam();
        if (team == null || team.getId() == null) {
            return List.of();
        }

        List<TeamMember> members = teamMembersRepository.findByTeam_Id(team.getId());
        Map<Integer, User> byId = new LinkedHashMap<>();
        for (TeamMember tm : members) {
            User user = tm.getUser();
            if (user != null && UserRoleUtil.isDeveloperUser(user)) {
                byId.put(user.getId().intValue(), user);
            }
        }
        User manager = team.getManager();
        if (manager != null && UserRoleUtil.isDeveloperUser(manager)) {
            byId.put(manager.getId().intValue(), manager);
        }

        List<TeamRosterDto> roster = new ArrayList<>(byId.size());
        for (User user : byId.values()) {
            roster.add(TeamRosterDto.fromUser(user));
        }
        return roster;
    }

    public List<TeamRosterDto> listDevelopersForProjectId(Long projectId) {
        return findProject(projectId)
                .map(this::listDevelopersForProject)
                .orElse(List.of());
    }
}
