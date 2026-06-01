package com.springboot.MyTodoList.realtime;

import com.springboot.MyTodoList.repository.TaskRepository;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

@Service
public class ProjectTaskEventPublisher {

    private final ApplicationEventPublisher events;
    private final TaskRepository taskRepository;
    private final boolean enabled;

    public ProjectTaskEventPublisher(
            ApplicationEventPublisher events,
            TaskRepository taskRepository,
            @Value("${app.realtime.sse.enabled:true}") boolean enabled) {
        this.events = events;
        this.taskRepository = taskRepository;
        this.enabled = enabled;
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
        events.publishEvent(ProjectTaskEvent.of(type, projectId, taskId, userId, source));
    }

    private Optional<Long> resolveProjectId(Long taskId) {
        return taskRepository.findProjectIdByTaskId(taskId);
    }
}
