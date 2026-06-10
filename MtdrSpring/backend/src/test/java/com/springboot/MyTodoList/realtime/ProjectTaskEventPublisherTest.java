package com.springboot.MyTodoList.realtime;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.repository.TaskRepository;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
class ProjectTaskEventPublisherTest {

    @Mock
    private ProjectRealtimeHub hub;

    @Mock
    private TaskRepository taskRepository;

    private ProjectTaskEventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new ProjectTaskEventPublisher(hub, taskRepository, true);
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void taskUpdated_withoutActiveTransaction_broadcastsImmediately() {
        when(taskRepository.findProjectIdByTaskId(10L)).thenReturn(Optional.of(3L));

        publisher.taskUpdated(10L, 2L, "telegram");

        ArgumentCaptor<ProjectTaskEvent> captor = ArgumentCaptor.forClass(ProjectTaskEvent.class);
        verify(hub).broadcast(eq(3L), captor.capture());
        ProjectTaskEvent event = captor.getValue();
        org.junit.jupiter.api.Assertions.assertEquals("task-updated", event.getType());
        org.junit.jupiter.api.Assertions.assertEquals(10L, event.getTaskId());
        org.junit.jupiter.api.Assertions.assertEquals("telegram", event.getSource());
    }

    @Test
    void taskUpdated_withActiveTransaction_broadcastsAfterCommit() {
        when(taskRepository.findProjectIdByTaskId(11L)).thenReturn(Optional.of(4L));
        TransactionSynchronizationManager.initSynchronization();

        publisher.taskUpdated(11L, 5L, "telegram");

        verify(hub, never()).broadcast(eq(4L), org.mockito.ArgumentMatchers.any());

        for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
            sync.afterCommit();
        }

        verify(hub).broadcast(eq(4L), org.mockito.ArgumentMatchers.any(ProjectTaskEvent.class));
    }

    @Test
    void taskUpdated_whenDisabled_doesNotBroadcast() {
        publisher = new ProjectTaskEventPublisher(hub, taskRepository, false);

        publisher.taskUpdated(12L, 1L, "telegram");

        verify(hub, never()).broadcast(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.any());
    }
}
