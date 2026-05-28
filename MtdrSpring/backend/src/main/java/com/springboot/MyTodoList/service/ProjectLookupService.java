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
        List<Project> projects = projectRepository.findAllByManagerId(managerId);
        return projects.isEmpty() ? Optional.empty() : Optional.of(projects.get(0));
    }

    public List<Project> findAllProjectsForManager(Long managerId) {
        if (managerId == null) {
            return List.of();
        }
        return projectRepository.findAllByManagerId(managerId);
    }

    public Optional<Project> findPrimaryProjectForDeveloper(Long userId) {
        List<Project> projects = findAllProjectsForDeveloper(userId);
        return projects.isEmpty() ? Optional.empty() : Optional.of(projects.get(0));
    }

    public List<Project> findAllProjectsForDeveloper(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return projectRepository.findAllProjectsForTeamMember(userId);
    }
}
