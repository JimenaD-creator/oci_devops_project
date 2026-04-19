package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
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
            ut.setWorkedHours(0L);
            userTaskRepository.save(ut);
        }

        taskAssignmentSyncService.syncTaskStatusFromAssignments(saved.getId());
        return taskRepository.findById(saved.getId()).orElse(saved);
    }
}
