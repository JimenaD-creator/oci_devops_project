package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskEmbeddingRepository;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import com.springboot.MyTodoList.realtime.ProjectTaskEventPublisher;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates a single {@link Task} and optional {@code USER_TASK} rows (one per assignee, same {@code TASK_ID}).
 */
@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserTaskRepository userTaskRepository;

    @Autowired
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @Autowired
    private TaskEmbeddingRepository taskEmbeddingRepository;

    @Autowired
    private ProjectTaskEventPublisher projectTaskEventPublisher;

    @Transactional
    public void deleteTaskById(Long id) {
        if (id == null) {
            return;
        }
        Long projectId = taskRepository.findProjectIdByTaskId(id).orElse(null);
        List<UserTask> assignments = userTaskRepository.findByTask_Id(id);
        if (!assignments.isEmpty()) {
            userTaskRepository.deleteAll(assignments);
        }
        taskEmbeddingRepository.deleteByTaskId(id);
        taskRepository.deleteById(id);
        projectTaskEventPublisher.taskDeleted(id, projectId, "rest");
    }

    @Transactional
    public Task createTask(Task task, List<Long> assigneeUserIds) {
        Task saved = taskRepository.save(task);
        List<Long> assigneeIds = assigneeUserIds;

        if (assigneeIds == null || assigneeIds.isEmpty()) {
            return saved;
        }

        Set<Long> distinct = new LinkedHashSet<>();
        for (Long raw : assigneeIds) {
            if (raw != null && raw > 0) {
                distinct.add(raw);
            }
        }
        if (distinct.isEmpty()) {
            return saved;
        }

        String initialStatus =
                saved.getStatus() != null && !saved.getStatus().isBlank()
                        ? saved.getStatus().trim().toUpperCase()
                        : "TODO";

        for (Long uid : distinct) {
            User user = userRepository
                    .findById(uid)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + uid));
            UserTask ut = new UserTask(user, saved);
            ut.setStatus(initialStatus);
            ut.setWorkedHours(0.0);
            userTaskRepository.save(ut);
        }

        taskAssignmentSyncService.syncTaskStatusFromAssignments(saved.getId());
        Task result = taskRepository.findById(saved.getId()).orElse(saved);
        taskRepository.findProjectIdByTaskId(result.getId()).ifPresent(projectId ->
                projectTaskEventPublisher.taskCreated(result.getId(), projectId, "rest"));
        return result;
    }
}
