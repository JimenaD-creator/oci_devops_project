package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.dto.DashboardBundleResponse;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.SprintRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class DashboardBundleServiceTest {

    @Mock
    private SprintRepository sprintRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserTaskRepository userTaskRepository;

    @Mock
    private ProjectTeamRosterService projectTeamRosterService;

    @InjectMocks
    private DashboardBundleService dashboardBundleService;

    @Test
    void loadBundle_returnsSlimPayloadWithoutNestedProjectGraph() {
        Project project = new Project();
        project.setId(3L);
        project.setName("P");

        Sprint sprint = new Sprint();
        sprint.setId(10L);

        Task task = new Task();
        task.setId(20L);
        Sprint taskSprint = new Sprint();
        taskSprint.setId(10L);
        task.setAssignedSprint(taskSprint);

        User user = new User();
        user.setId(5L);
        user.setName("Ada");
        user.setProfilePicture("data:image/jpeg;base64,HUGE");
        UserTask ut = new UserTask(user, task);

        when(projectTeamRosterService.findProject(3L)).thenReturn(Optional.of(project));
        when(sprintRepository.findByAssignedProjectId(3L)).thenReturn(List.of(sprint));
        when(taskRepository.findByProjectIdWithSprint(3L)).thenReturn(List.of(task));
        when(userTaskRepository.findByProjectIdWithUserAndTask(3L)).thenReturn(List.of(ut));
        when(projectTeamRosterService.listDevelopersForProject(project)).thenReturn(List.of());

        Optional<DashboardBundleResponse> result = dashboardBundleService.loadBundle(3L);

        assertTrue(result.isPresent());
        DashboardBundleResponse bundle = result.get();
        assertEquals(3L, bundle.getProjectId());
        assertEquals(1, bundle.getSprints().size());
        assertEquals(3L, bundle.getSprints().get(0).getAssignedProject().getId());
        assertEquals(10L, bundle.getTasks().get(0).getAssignedSprint().getId());
        assertEquals(5L, bundle.getUserTasks().get(0).getUser().getId());
        assertEquals("Ada", bundle.getUserTasks().get(0).getUser().getName());
    }
}
