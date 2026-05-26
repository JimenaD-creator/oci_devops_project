package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.repository.ProjectRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class ProjectLookupService {

    private final ProjectRepository projectRepository;

    public ProjectLookupService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    public Optional<Project> findPrimaryProjectForManager(Long managerId) {
        if (managerId == null) {
            return Optional.empty();
        }
        return projectRepository.findByManagerId(managerId);
    }

    public Optional<Project> findPrimaryProjectForDeveloper(Long userId) {
        if (userId == null) {
            return Optional.empty();
        }
        Optional<Project> direct = projectRepository.findByTeamMemberUserId(userId);
        if (direct.isPresent()) {
            return direct;
        }
        List<Project> projects = projectRepository.findAllProjectsForTeamMember(userId);
        return projects.isEmpty() ? Optional.empty() : Optional.of(projects.get(0));
    }
}
