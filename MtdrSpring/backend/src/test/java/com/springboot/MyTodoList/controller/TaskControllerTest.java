package com.springboot.MyTodoList.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.service.TaskAssignmentNotificationService;
import com.springboot.MyTodoList.service.TaskAssignmentSyncService;
import com.springboot.MyTodoList.service.TaskService;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = TaskController.class)
@AutoConfigureMockMvc(addFilters = false)
class TaskControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TaskRepository taskRepository;

    @MockBean
    private UserTaskRepository userTaskRepository;

    @MockBean
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @MockBean
    private TaskService taskService;

    @MockBean
    private TaskAssignmentNotificationService taskAssignmentNotificationService;

    @Test
    void getAllTasks_withoutProjectId_returnsAll() throws Exception {
        Task task = new Task();
        task.setId(1L);
        task.setTitle("T1");
        when(taskRepository.findAll()).thenReturn(List.of(task));

        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].title").value("T1"));
    }

    @Test
    void getAllTasks_withProjectId_filtersByProject() throws Exception {
        when(taskRepository.findByProjectId(2L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/tasks").param("projectId", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        verify(taskRepository).findByProjectId(2L);
    }

    @Test
    void getTaskById_whenFound_returnsTask() throws Exception {
        Task task = new Task();
        task.setId(5L);
        task.setTitle("Found");
        when(taskRepository.findById(5L)).thenReturn(Optional.of(task));

        mockMvc.perform(get("/api/tasks/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Found"));
    }

    @Test
    void getTaskById_whenMissing_returnsNotFound() throws Exception {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/tasks/99")).andExpect(status().isNotFound());
    }

    @Test
    void createTask_nullPayload_returnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("null"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createTask_success_returnsCreatedTask() throws Exception {
        Task saved = new Task();
        saved.setId(10L);
        saved.setTitle("New");
        when(taskService.createTask(any(Task.class), anyList())).thenReturn(saved);

        String body = "{\"title\":\"New\",\"assigneeUserIds\":[1]}";

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.title").value("New"));
    }

    @Test
    void createTask_invalidAssignee_returnsBadRequest() throws Exception {
        when(taskService.createTask(any(Task.class), anyList()))
                .thenThrow(new IllegalArgumentException("User not found"));

        String body = "{\"title\":\"X\",\"assigneeUserIds\":[999]}";

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateTask_noAssignments_updatesTaskDirectly() throws Exception {
        Task existing = new Task();
        existing.setId(20L);
        existing.setStatus("TODO");
        Sprint sprint = new Sprint();
        sprint.setId(1L);
        existing.setAssignedSprint(sprint);

        when(taskRepository.findById(20L)).thenReturn(Optional.of(existing));
        when(userTaskRepository.findByTask_Id(20L)).thenReturn(Collections.emptyList());
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(put("/api/tasks/20")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\",\"title\":\"Updated\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void updateTask_whenMissing_returnsNotFound() throws Exception {
        when(taskRepository.findById(404L)).thenReturn(Optional.empty());

        mockMvc.perform(put("/api/tasks/404")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"TODO\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateTask_withAssignments_markDoneNotAllAssignees_returnsConflict() throws Exception {
        Task existing = taskWithSprint(21L, "TODO");
        UserTask done = assignment(user(1L), 21L, "DONE");
        UserTask pending = assignment(user(2L), 21L, "TODO");

        when(taskRepository.findById(21L)).thenReturn(Optional.of(existing));
        when(userTaskRepository.findByTask_Id(21L)).thenReturn(List.of(done, pending));

        mockMvc.perform(put("/api/tasks/21")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DONE\"}"))
                .andExpect(status().isConflict());

        verify(userTaskRepository, never()).save(any(UserTask.class));
        verify(taskAssignmentSyncService, never()).syncTaskStatusFromAssignments(21L);
    }

    @Test
    void updateTask_withAssignments_propagatesStatusAndSyncs() throws Exception {
        Task existing = taskWithSprint(22L, "TODO");
        UserTask ut1 = assignment(user(1L), 22L, "TODO");
        UserTask ut2 = assignment(user(2L), 22L, "TODO");

        when(taskRepository.findById(22L)).thenReturn(Optional.of(existing));
        when(userTaskRepository.findByTask_Id(22L)).thenReturn(List.of(ut1, ut2));
        when(userTaskRepository.save(any(UserTask.class))).thenAnswer(inv -> inv.getArgument(0));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task synced = new Task();
        synced.setId(22L);
        synced.setStatus("IN_PROGRESS");
        when(taskAssignmentSyncService.syncTaskStatusFromAssignments(22L)).thenReturn(synced);

        mockMvc.perform(put("/api/tasks/22")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        verify(userTaskRepository, atLeastOnce()).save(any(UserTask.class));
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(22L);
    }

    @Test
    void updateTask_withAssignments_allAssigneesDone_allowsMarkDone() throws Exception {
        Task existing = taskWithSprint(23L, "IN_REVIEW");
        UserTask ut1 = assignment(user(1L), 23L, "DONE");
        UserTask ut2 = assignment(user(2L), 23L, "DONE");

        when(taskRepository.findById(23L)).thenReturn(Optional.of(existing));
        when(userTaskRepository.findByTask_Id(23L)).thenReturn(List.of(ut1, ut2));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task synced = new Task();
        synced.setId(23L);
        synced.setStatus("DONE");
        when(taskAssignmentSyncService.syncTaskStatusFromAssignments(23L)).thenReturn(synced);

        mockMvc.perform(put("/api/tasks/23")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DONE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    @Test
    void updateTask_noAssignments_markDone_setsFinishDate() throws Exception {
        Task existing = taskWithSprint(24L, "TODO");
        existing.setFinishDate(LocalDateTime.of(2026, 1, 1, 0, 0));

        when(taskRepository.findById(24L)).thenReturn(Optional.of(existing));
        when(userTaskRepository.findByTask_Id(24L)).thenReturn(Collections.emptyList());
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(put("/api/tasks/24")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DONE\"}"))
                .andExpect(status().isOk());

        assertEquals("DONE", existing.getStatus());
        assertTrue(existing.getFinishDate().isAfter(LocalDateTime.of(2026, 1, 1, 0, 0)));
    }

    @Test
    void deleteTask_whenExists_returnsNoContent() throws Exception {
        when(taskRepository.existsById(7L)).thenReturn(true);

        mockMvc.perform(delete("/api/tasks/7")).andExpect(status().isNoContent());

        verify(taskService).deleteTaskById(7L);
    }

    @Test
    void deleteTask_whenMissing_returnsNotFound() throws Exception {
        when(taskRepository.existsById(8L)).thenReturn(false);

        mockMvc.perform(delete("/api/tasks/8")).andExpect(status().isNotFound());
    }

    @Test
    void notifyNewAssignees_whenTaskMissing_returnsNotFound() throws Exception {
        when(taskRepository.existsById(50L)).thenReturn(false);

        mockMvc.perform(post("/api/tasks/50/notify-new-assignees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newAssigneeUserIds\":[2]}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void notifyNewAssignees_whenTaskExists_triggersNotification() throws Exception {
        when(taskRepository.existsById(51L)).thenReturn(true);

        mockMvc.perform(post("/api/tasks/51/notify-new-assignees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newAssigneeUserIds\":[2,3]}"))
                .andExpect(status().isAccepted());

        verify(taskAssignmentNotificationService).notifyNewAssigneesOnReassignment(51L, List.of(2L, 3L));
    }

    @Test
    void notifyNewAssignees_emptyList_returnsNoContent() throws Exception {
        when(taskRepository.existsById(52L)).thenReturn(true);

        mockMvc.perform(post("/api/tasks/52/notify-new-assignees")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"newAssigneeUserIds\":[]}"))
                .andExpect(status().isNoContent());

        verify(taskAssignmentNotificationService, never()).notifyNewAssigneesOnReassignment(any(), anyList());
    }

    private static User user(long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static Task taskWithSprint(long taskId, String status) {
        Task task = new Task();
        task.setId(taskId);
        task.setStatus(status);
        Sprint sprint = new Sprint();
        sprint.setId(1L);
        task.setAssignedSprint(sprint);
        task.setDueDate(LocalDateTime.now().plusDays(7));
        task.setFinishDate(LocalDateTime.now());
        return task;
    }

    private static UserTask assignment(User user, long taskId, String status) {
        Task task = new Task();
        task.setId(taskId);
        UserTask ut = new UserTask(user, task);
        ut.setStatus(status);
        return ut;
    }
}
