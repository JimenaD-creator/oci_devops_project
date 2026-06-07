package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TaskAssignmentSyncServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private UserTaskRepository userTaskRepository;

    @Mock
    private KpiService kpiService;

    @Mock
    private ProjectBundleCacheEvictor projectBundleCacheEvictor;

    @InjectMocks
    private TaskAssignmentSyncService syncService;

    @Test
    void syncTaskStatusFromAssignments_whenTaskMissing_returnsNull() {
        when(taskRepository.findById(1L)).thenReturn(Optional.empty());

        assertNull(syncService.syncTaskStatusFromAssignments(1L));
    }

    @Test
    void syncTaskStatusFromAssignments_allDone_setsTaskDone() {
        Task task = new Task();
        task.setId(2L);
        Sprint sprint = new Sprint();
        sprint.setId(10L);
        task.setAssignedSprint(sprint);
        task.setStatus("IN_PROGRESS");
        task.setDueDate(LocalDateTime.now().plusDays(1));

        UserTask ut = new UserTask();
        ut.setStatus("DONE");

        when(taskRepository.findById(2L)).thenReturn(Optional.of(task));
        when(userTaskRepository.findByTask_Id(2L)).thenReturn(List.of(ut));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task saved = syncService.syncTaskStatusFromAssignments(2L);

        assertEquals("DONE", saved.getStatus());
        verify(kpiService).calculateAndSaveKpisForSprint(10L);
    }

    @Test
    void syncTaskStatusFromAssignments_noAssignments_returnsSavedTask() {
        Task task = new Task();
        task.setId(3L);
        task.setStatus("TODO");

        when(taskRepository.findById(3L)).thenReturn(Optional.of(task));
        when(userTaskRepository.findByTask_Id(3L)).thenReturn(List.of());
        when(taskRepository.save(task)).thenReturn(task);

        Task saved = syncService.syncTaskStatusFromAssignments(3L);

        assertEquals("TODO", saved.getStatus());
    }

    @Test
    void syncTaskStatusFromAssignments_mixedProgress_setsInReview() {
        Task task = new Task();
        task.setId(4L);
        task.setStatus("TODO");

        UserTask done = new UserTask();
        done.setStatus("DONE");
        UserTask todo = new UserTask();
        todo.setStatus("TODO");

        when(taskRepository.findById(4L)).thenReturn(Optional.of(task));
        when(userTaskRepository.findByTask_Id(4L)).thenReturn(List.of(done, todo));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task saved = syncService.syncTaskStatusFromAssignments(4L);

        assertEquals("IN_REVIEW", saved.getStatus());
    }

    @Test
    void syncTaskStatusFromAssignments_inReviewAndInProgress_prioritizesInReview() {
        Task task = new Task();
        task.setId(5L);
        task.setStatus("TODO");

        UserTask inReview = new UserTask();
        inReview.setStatus("IN_REVIEW");
        UserTask inProgress = new UserTask();
        inProgress.setStatus("IN_PROGRESS");

        when(taskRepository.findById(5L)).thenReturn(Optional.of(task));
        when(userTaskRepository.findByTask_Id(5L)).thenReturn(List.of(inReview, inProgress));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task saved = syncService.syncTaskStatusFromAssignments(5L);

        assertEquals("IN_REVIEW", saved.getStatus());
    }
}
