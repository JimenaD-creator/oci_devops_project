package com.springboot.MyTodoList.realtime;

import com.springboot.MyTodoList.repository.TaskRepository;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class ProjectTaskEventPublisher {

    private final ProjectRealtimeHub hub;
    private final ProjectTaskEventRelayStore relayStore;
    private final TaskRepository taskRepository;
    private final boolean enabled;
    private final boolean relayEnabled;

    public ProjectTaskEventPublisher(
            ProjectRealtimeHub hub,
            TaskRepository taskRepository,
            @Autowired(required = false) ProjectTaskEventRelayStore relayStore,
            @Value("${app.realtime.sse.enabled:true}") boolean enabled,
            @Value("${app.realtime.relay.enabled:true}") boolean relayEnabled) {
        this.hub = hub;
        this.taskRepository = taskRepository;
        this.relayStore = relayStore;
        this.enabled = enabled;
        this.relayEnabled = relayEnabled;
    }

    public void taskUpdated(Long taskId, Long userId, String source) {
        publish("task-updated", taskId, userId, source);
    }

    public void taskAssigned(Long taskId, Long userId, String source) {
        publish("task-assigned", taskId, userId, source);
    }

    public void blockerReported(Long taskId, Long userId, String source) {
        publish("blocker-reported", taskId, userId, source);
    }

    public void blockerResolved(Long taskId, Long userId, String source) {
        publish("blocker-resolved", taskId, userId, source);
    }

    public void taskDeleted(Long taskId, Long projectId, String source) {
        publishForProject("task-deleted", projectId, taskId, null, source);
    }

    public void taskCreated(Long taskId, Long projectId, String source) {
        publishForProject("task-updated", projectId, taskId, null, source);
    }

    private void publish(String type, Long taskId, Long userId, String source) {
        if (!enabled || taskId == null) {
            return;
        }
        resolveProjectId(taskId)
                .ifPresent(projectId -> publishForProject(type, projectId, taskId, userId, source));
    }

    private void publishForProject(
            String type, Long projectId, Long taskId, Long userId, String source) {
        if (!enabled || projectId == null) {
            return;
        }
        ProjectTaskEvent event = ProjectTaskEvent.of(type, projectId, taskId, userId, source);
        Runnable deliver = () -> deliver(event);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deliver.run();
                }
            });
        } else {
            deliver.run();
        }
    }

    private void deliver(ProjectTaskEvent event) {
        if (useRelay()) {
            relayStore.save(event);
            return;
        }
        hub.broadcast(event.getProjectId(), event);
    }

    private boolean useRelay() {
        return relayEnabled && relayStore != null && relayStore.isEnabled();
    }

    private Optional<Long> resolveProjectId(Long taskId) {
        return taskRepository.findProjectIdByTaskId(taskId);
    }
}
