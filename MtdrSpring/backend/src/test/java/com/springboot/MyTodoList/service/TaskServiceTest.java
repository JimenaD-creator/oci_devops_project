package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskEmbeddingRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.realtime.ProjectTaskEventPublisher;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserTaskRepository userTaskRepository;

    @Mock
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @Mock
    private TaskEmbeddingRepository taskEmbeddingRepository;

    @Mock
    private ProjectTaskEventPublisher projectTaskEventPublisher;

    @InjectMocks
    private TaskService taskService;

    @Test
    void createTask_withoutAssignees_onlySavesTask() {
        Task task = new Task();
        task.setTitle("Solo task");
        when(taskRepository.save(task)).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(10L);
            return t;
        });
        when(taskRepository.findById(10L)).thenAnswer(inv -> {
            Task t = new Task();
            t.setId(10L);
            return Optional.of(t);
        });
        when(taskRepository.findProjectIdByTaskId(10L)).thenReturn(Optional.of(1L));

        Task result = taskService.createTask(task, null);

        assertEquals(10L, result.getId());
        verify(userTaskRepository, never()).save(any());
        verify(taskAssignmentSyncService, never()).syncTaskStatusFromAssignments(any());
    }

    @Test
    void createTask_withAssignees_createsUserTasksAndSyncsStatus() {
        Task task = new Task();
        task.setTitle("Team task");
        task.setStatus("in progress");

        User dev = new User();
        dev.setId(2L);
        dev.setName("Dev");

        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(20L);
            return t;
        });
        when(userRepository.findById(2L)).thenReturn(Optional.of(dev));
        when(taskRepository.findById(20L)).thenAnswer(inv -> {
            Task t = new Task();
            t.setId(20L);
            t.setStatus("IN PROGRESS");
            return Optional.of(t);
        });
        when(taskRepository.findProjectIdByTaskId(20L)).thenReturn(Optional.of(2L));

        Task result = taskService.createTask(task, Arrays.asList(2L, 2L, null, 0L));

        assertEquals(20L, result.getId());
        verify(userTaskRepository).save(any(UserTask.class));
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(20L);

        ArgumentCaptor<UserTask> captor = ArgumentCaptor.forClass(UserTask.class);
        verify(userTaskRepository).save(captor.capture());
        assertEquals("IN PROGRESS", captor.getValue().getStatus());
        assertEquals(0.0, captor.getValue().getWorkedHours(), 0.001);
    }

    @Test
    void createTask_unknownAssignee_throws() {
        Task task = new Task();
        when(taskRepository.save(task)).thenAnswer(inv -> {
            Task t = inv.getArgument(0);
            t.setId(30L);
            return t;
        });
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(
                IllegalArgumentException.class,
                () -> taskService.createTask(task, List.of(999L)));
    }

    @Test
    void deleteTaskById_nullId_doesNothing() {
        taskService.deleteTaskById(null);

        verify(taskRepository, never()).deleteById(any());
    }

    @Test
    void deleteTaskById_removesAssignmentsEmbeddingsAndTask() {
        UserTask assignment = new UserTask();
        when(userTaskRepository.findByTask_Id(40L)).thenReturn(List.of(assignment));
        when(taskRepository.findProjectIdByTaskId(40L)).thenReturn(Optional.of(7L));

        taskService.deleteTaskById(40L);

        verify(userTaskRepository).deleteAll(anyList());
        verify(taskEmbeddingRepository).deleteByTaskId(40L);
        verify(taskRepository).deleteById(40L);
    }

    @Test
    void deleteTaskById_noAssignments_stillDeletesTask() {
        when(userTaskRepository.findByTask_Id(41L)).thenReturn(Collections.emptyList());
        when(taskRepository.findProjectIdByTaskId(41L)).thenReturn(Optional.empty());

        taskService.deleteTaskById(41L);

        verify(userTaskRepository, never()).deleteAll(anyList());
        verify(taskEmbeddingRepository).deleteByTaskId(41L);
        verify(taskRepository).deleteById(eq(41L));
    }
}
