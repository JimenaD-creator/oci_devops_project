package com.springboot.MyTodoList.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.repository.ProjectRepository;
import com.springboot.MyTodoList.repository.SprintRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = SprintController.class)
@AutoConfigureMockMvc(addFilters = false)
class SprintControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SprintRepository sprintRepository;

    @MockBean
    private ProjectRepository projectRepository;

    @Test
    void getAllSprints_returnsList() throws Exception {
        Sprint sprint = new Sprint();
        sprint.setId(1L);
        when(sprintRepository.findAll()).thenReturn(List.of(sprint));

        mockMvc.perform(get("/api/sprints"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
    }

    @Test
    void getAllSprints_withProjectId_filters() throws Exception {
        when(sprintRepository.findByAssignedProjectId(3L)).thenReturn(List.of());

        mockMvc.perform(get("/api/sprints").param("projectId", "3"))
                .andExpect(status().isOk());

        verify(sprintRepository).findByAssignedProjectId(3L);
    }

    @Test
    void getSprintById_whenFound_returnsSprint() throws Exception {
        Sprint sprint = new Sprint();
        sprint.setId(4L);
        when(sprintRepository.findById(4L)).thenReturn(Optional.of(sprint));

        mockMvc.perform(get("/api/sprints/4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(4));
    }

    @Test
    void getSprintById_whenMissing_returnsNotFound() throws Exception {
        when(sprintRepository.findById(404L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/sprints/404")).andExpect(status().isNotFound());
    }

    @Test
    void createSprint_withoutAssignedProject_returnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/sprints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("assignedProject with id is required"));
    }

    @Test
    void createSprint_unknownProject_returnsBadRequest() throws Exception {
        when(projectRepository.findById(99L)).thenReturn(Optional.empty());

        String body = "{\"assignedProject\":{\"id\":99}}";

        mockMvc.perform(post("/api/sprints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Project not found for id 99"));
    }

    @Test
    void createSprint_validProject_returnsSavedSprint() throws Exception {
        Project project = new Project();
        project.setId(2L);
        project.setName("P1");

        Sprint toSave = new Sprint();
        toSave.setAssignedProject(new Project());
        toSave.getAssignedProject().setId(2L);

        Sprint saved = new Sprint();
        saved.setId(10L);
        saved.setAssignedProject(project);

        when(projectRepository.findById(2L)).thenReturn(Optional.of(project));
        when(sprintRepository.save(any(Sprint.class))).thenReturn(saved);

        String body = "{\"assignedProject\":{\"id\":2}}";

        mockMvc.perform(post("/api/sprints")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10));
    }

    @Test
    void updateSprint_whenFound_returnsUpdatedSprint() throws Exception {
        Sprint existing = new Sprint();
        existing.setId(11L);
        existing.setGoal("Old goal");

        when(sprintRepository.findById(11L)).thenReturn(Optional.of(existing));
        when(sprintRepository.save(any(Sprint.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(put("/api/sprints/11")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"goal\":\"New goal\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goal").value("New goal"));
    }

    @Test
    void updateSprint_whenMissing_returnsNotFound() throws Exception {
        when(sprintRepository.findById(404L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/sprints/404")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"goal\":\"X\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateSprint_withUnknownProject_returnsBadRequest() throws Exception {
        Sprint existing = new Sprint();
        existing.setId(12L);
        when(sprintRepository.findById(12L)).thenReturn(Optional.of(existing));
        when(projectRepository.findById(88L)).thenReturn(Optional.empty());

        String body = "{\"assignedProject\":{\"id\":88},\"goal\":\"G\"}";

        mockMvc.perform(put("/api/sprints/12")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Project not found for id 88"));
    }

    @Test
    void deleteSprint_whenExists_returnsNoContent() throws Exception {
        when(sprintRepository.existsById(6L)).thenReturn(true);

        mockMvc.perform(delete("/api/sprints/6")).andExpect(status().isNoContent());

        verify(sprintRepository).deleteById(6L);
    }

    @Test
    void deleteSprint_whenMissing_returnsNotFound() throws Exception {
        when(sprintRepository.existsById(6L)).thenReturn(false);

        mockMvc.perform(delete("/api/sprints/6")).andExpect(status().isNotFound());
    }
}
