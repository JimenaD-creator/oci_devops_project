package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.dto.DashboardBundleResponse;
import com.springboot.MyTodoList.dto.DashboardSprintDto;
import com.springboot.MyTodoList.dto.DashboardTaskDto;
import com.springboot.MyTodoList.dto.DashboardUserTaskDto;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.SprintRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardBundleService {

    private final SprintRepository sprintRepository;
    private final TaskRepository taskRepository;
    private final UserTaskRepository userTaskRepository;
    private final ProjectTeamRosterService projectTeamRosterService;

    public DashboardBundleService(
            SprintRepository sprintRepository,
            TaskRepository taskRepository,
            UserTaskRepository userTaskRepository,
            ProjectTeamRosterService projectTeamRosterService) {
        this.sprintRepository = sprintRepository;
        this.taskRepository = taskRepository;
        this.userTaskRepository = userTaskRepository;
        this.projectTeamRosterService = projectTeamRosterService;
    }

    @Transactional(readOnly = true)
    public Optional<DashboardBundleResponse> loadBundle(Long projectId) {
        if (projectId == null) {
            return Optional.empty();
        }
        return projectTeamRosterService.findProject(projectId).map(project -> {
            List<Sprint> sprints = sprintRepository.findByAssignedProjectId(projectId);
            List<Task> tasks = taskRepository.findByProjectIdWithSprint(projectId);
            List<UserTask> userTasks = userTaskRepository.findByProjectIdWithUserAndTask(projectId);

            DashboardBundleResponse bundle = new DashboardBundleResponse();
            bundle.setProjectId(projectId);
            bundle.setSprints(
                    sprints.stream().map(s -> DashboardSprintDto.from(s, projectId)).collect(Collectors.toList()));
            bundle.setTasks(tasks.stream().map(DashboardTaskDto::from).collect(Collectors.toList()));
            bundle.setUserTasks(
                    userTasks.stream().map(DashboardUserTaskDto::from).collect(Collectors.toList()));
            bundle.setDevelopers(projectTeamRosterService.listDevelopersForProject(project, false));
            return bundle;
        });
    }
}
