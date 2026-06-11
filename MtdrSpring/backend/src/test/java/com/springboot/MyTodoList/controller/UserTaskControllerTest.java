package com.springboot.MyTodoList.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.service.ProjectBundleCacheEvictor;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import com.springboot.MyTodoList.service.UserTaskService;
import com.springboot.MyTodoList.realtime.ProjectTaskEventPublisher;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = UserTaskController.class)
@AutoConfigureMockMvc(addFilters = false)
class UserTaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserTaskRepository userTaskRepository;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private TaskRepository taskRepository;

    @MockBean
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @MockBean
    private UserTaskService userTaskService;

    @MockBean
    private ProjectTaskEventPublisher projectTaskEventPublisher;

    @MockBean
    private ProjectBundleCacheEvictor projectBundleCacheEvictor;

    @Test
    void getAllUserTasks_returnsList() throws Exception {
        when(userTaskRepository.findAllWithUserAndTask()).thenReturn(List.of());

        mockMvc.perform(get("/api/user-tasks")).andExpect(status().isOk());
    }

    @Test
    void getUserTasksBySprint_returnsList() throws Exception {
        when(userTaskRepository.findByTask_AssignedSprint_Id(1L)).thenReturn(List.of());

        mockMvc.perform(get("/api/user-tasks/sprint/1")).andExpect(status().isOk());
    }

    @Test
    void deleteAssignmentsForTask_returnsNoContent() throws Exception {
        when(userTaskRepository.findByTask_Id(10L)).thenReturn(List.of(new UserTask()));

        mockMvc.perform(delete("/api/user-tasks/task/10")).andExpect(status().isNoContent());
    }

    @Test
    void createUserTask_success_returnsOk() throws Exception {
        User user = new User();
        user.setId(1L);
        Task task = new Task();
        task.setId(2L);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(taskRepository.findById(2L)).thenReturn(Optional.of(task));
        when(userTaskRepository.findById(any())).thenReturn(Optional.empty());
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        String body = "{\"userId\":1,\"taskId\":2,\"status\":\"done\"}";

        mockMvc.perform(post("/api/user-tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());

        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(2L);
    }

    @Test
    void createUserTask_missingIds_returnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/user-tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createUserTask_unknownUser_returnsNotFound() throws Exception {
        when(userRepository.findById(1L)).thenReturn(Optional.empty());

        mockMvc.perform(post("/api/user-tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":1,\"taskId\":2}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getAllUserTasks_withProjectId_usesProjectQuery() throws Exception {
        when(userTaskRepository.findByProjectIdWithUserAndTask(5L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/user-tasks").param("projectId", "5")).andExpect(status().isOk());
    }

    @Test
    void createUserTask_reopenFromCompleted_clearsWorkedHours() throws Exception {
        User user = new User();
        user.setId(1L);
        Task task = new Task();
        task.setId(2L);
        UserTask existing = new UserTask(user, task);
        existing.setStatus("COMPLETED");
        existing.setWorkedHours(5.0);

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(taskRepository.findById(2L)).thenReturn(Optional.of(task));
        when(userTaskRepository.findById(any())).thenReturn(Optional.of(existing));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(post("/api/user-tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":1,\"taskId\":2,\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());

        ArgumentCaptor<UserTask> captor = ArgumentCaptor.forClass(UserTask.class);
        verify(userTaskRepository).save(captor.capture());
        assertEquals(0.0, captor.getValue().getWorkedHours(), 0.001);
        assertEquals("IN_PROGRESS", captor.getValue().getStatus());
    }

    @Test
    void resolveMyBlocker_success_returnsOk() throws Exception {
        UserTask resolved = new UserTask();
        when(userTaskService.resolveBlockedReport(3L, 90L)).thenReturn(resolved);

        mockMvc.perform(post("/api/user-tasks/my-blockers/resolve")
                        .param("userId", "3")
                        .param("taskId", "90"))
                .andExpect(status().isOk());

        verify(userTaskService).resolveBlockedReport(3L, 90L);
    }
}
