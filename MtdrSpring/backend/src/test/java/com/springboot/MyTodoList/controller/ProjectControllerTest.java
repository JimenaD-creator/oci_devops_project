package com.springboot.MyTodoList.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.springboot.MyTodoList.dto.DashboardBundleResponse;
import com.springboot.MyTodoList.dto.TeamRosterDto;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.service.DashboardBundleService;
import com.springboot.MyTodoList.service.ProjectAccessAuthorization;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.ProjectTeamRosterService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = ProjectController.class)
@AutoConfigureMockMvc(addFilters = false)
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProjectRepository projectRepository;

    @MockBean
    private ProjectLookupService projectLookupService;

    @MockBean
    private ProjectAccessAuthorization projectAccessAuthorization;

    @MockBean
    private ProjectTeamRosterService projectTeamRosterService;

    @MockBean
    private DashboardBundleService dashboardBundleService;

    @Test
    void getAllProjects_returnsList() throws Exception {
        Project p = new Project();
        p.setId(1L);
        p.setName("P1");
        when(projectRepository.findAll()).thenReturn(List.of(p));

        mockMvc.perform(get("/api/projects/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("P1"));
    }

    @Test
    void getProjectById_whenFound_returnsProject() throws Exception {
        Project p = new Project();
        p.setId(3L);
        p.setName("Alpha");
        when(projectRepository.findById(3L)).thenReturn(Optional.of(p));

        mockMvc.perform(get("/api/projects/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Alpha"));
    }

    @Test
    void getProjectById_whenMissing_returnsNotFound() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/99")).andExpect(status().isNotFound());
    }

    @Test
    void getProjectByManager_whenFound_returnsProject() throws Exception {
        Project p = new Project();
        p.setId(4L);
        p.setName("MgrProject");
        when(projectAccessAuthorization.managerMayAccess(7L)).thenReturn(true);
        when(projectLookupService.findPrimaryProjectForManager(7L)).thenReturn(Optional.of(p));

        mockMvc.perform(get("/api/projects/manager/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("MgrProject"));
    }

    @Test
    void getProjectByManager_whenMissing_returnsNotFound() throws Exception {
        when(projectAccessAuthorization.managerMayAccess(7L)).thenReturn(true);
        when(projectLookupService.findPrimaryProjectForManager(7L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/manager/7")).andExpect(status().isNotFound());
    }

    @Test
    void getProjectByManager_whenOtherManagerId_returnsForbidden() throws Exception {
        when(projectAccessAuthorization.managerMayAccess(99L)).thenReturn(false);

        mockMvc.perform(get("/api/projects/manager/99")).andExpect(status().isForbidden());
    }

    @Test
    void getProjectsByManagerList_returnsOnlyOwnProjects() throws Exception {
        Project p1 = new Project();
        p1.setId(1L);
        p1.setName("Alpha");
        Project p2 = new Project();
        p2.setId(2L);
        p2.setName("Beta");
        when(projectAccessAuthorization.managerMayAccess(7L)).thenReturn(true);
        when(projectLookupService.findAllProjectsForManager(7L)).thenReturn(List.of(p1, p2));

        mockMvc.perform(get("/api/projects/manager/7/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Alpha"))
                .andExpect(jsonPath("$[1].name").value("Beta"));
    }

    @Test
    void getProjectsByManagerList_whenOtherManagerId_returnsForbidden() throws Exception {
        when(projectAccessAuthorization.managerMayAccess(99L)).thenReturn(false);

        mockMvc.perform(get("/api/projects/manager/99/list")).andExpect(status().isForbidden());
    }

    @Test
    void getProjectByDeveloper_whenFound_returnsProject() throws Exception {
        Project p = new Project();
        p.setId(5L);
        p.setName("DevProject");
        when(projectAccessAuthorization.developerMayAccess(9L)).thenReturn(true);
        when(projectLookupService.findPrimaryProjectForDeveloper(9L)).thenReturn(Optional.of(p));

        mockMvc.perform(get("/api/projects/developer/9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("DevProject"));
    }

    @Test
    void getProjectByDeveloper_whenMissing_returnsNotFound() throws Exception {
        when(projectAccessAuthorization.developerMayAccess(9L)).thenReturn(true);
        when(projectLookupService.findPrimaryProjectForDeveloper(9L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/developer/9")).andExpect(status().isNotFound());
    }

    @Test
    void getProjectsByDeveloperList_returnsTeamProjects() throws Exception {
        Project p1 = new Project();
        p1.setId(1L);
        p1.setName("Shared A");
        Project p2 = new Project();
        p2.setId(2L);
        p2.setName("Shared B");
        when(projectAccessAuthorization.developerMayAccess(9L)).thenReturn(true);
        when(projectLookupService.findAllProjectsForDeveloper(9L)).thenReturn(List.of(p1, p2));

        mockMvc.perform(get("/api/projects/developer/9/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void getProjectDevelopers_whenNoTeam_returnsEmptyList() throws Exception {
        Project p = new Project();
        p.setId(2L);
        when(projectTeamRosterService.findProject(2L)).thenReturn(Optional.of(p));
        when(projectTeamRosterService.listDevelopersForProject(p)).thenReturn(List.of());

        mockMvc.perform(get("/api/projects/2/developers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getProjectDevelopers_whenTeamHasDevelopers_returnsDistinctList() throws Exception {
        Project p = new Project();
        p.setId(6L);

        TeamRosterDto dev = new TeamRosterDto();
        dev.setId(20L);
        dev.setName("Dev One");
        dev.setType("DEVELOPER");
        TeamRosterDto lead = new TeamRosterDto();
        lead.setId(21L);
        lead.setName("Lead Dev");
        lead.setType("developer");

        when(projectTeamRosterService.findProject(6L)).thenReturn(Optional.of(p));
        when(projectTeamRosterService.listDevelopersForProject(p)).thenReturn(List.of(dev, lead));

        mockMvc.perform(get("/api/projects/6/developers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Dev One"))
                .andExpect(jsonPath("$[1].name").value("Lead Dev"));
    }

    @Test
    void getProjectDevelopers_whenProjectMissing_returnsNotFound() throws Exception {
        when(projectTeamRosterService.findProject(404L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/404/developers")).andExpect(status().isNotFound());
    }

    @Test
    void getDashboardBundle_whenProjectExists_returnsBundle() throws Exception {
        DashboardBundleResponse bundle = new DashboardBundleResponse();
        bundle.setProjectId(8L);
        when(dashboardBundleService.loadBundle(8L)).thenReturn(Optional.of(bundle));

        mockMvc.perform(get("/api/projects/8/dashboard-bundle"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(8));
    }

    @Test
    void getDashboardBundle_whenProjectMissing_returnsNotFound() throws Exception {
        when(dashboardBundleService.loadBundle(8L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/projects/8/dashboard-bundle")).andExpect(status().isNotFound());
    }
}
