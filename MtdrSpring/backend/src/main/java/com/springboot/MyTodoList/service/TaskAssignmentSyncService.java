package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.Task;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.TaskRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Keeps {@link Task#getStatus()} aligned with assignee rows in {@code USER_TASK}:
 * the task is DONE only when every assignee has status DONE (one logical task, not N completions).
 */
@Service
public class TaskAssignmentSyncService {

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private UserTaskRepository userTaskRepository;

    private static String norm(String s) {
        if (s == null) return "";
        return s.trim().toUpperCase();
    }

    /**
     * Derives task status from all USER_TASK rows for this task. If there are no assignments,
     * the task is left unchanged.
     */
    @Transactional
    public Task syncTaskStatusFromAssignments(Long taskId) {
        Optional<Task> opt = taskRepository.findById(taskId);
        if (opt.isEmpty()) {
            return null;
        }
        Task task = opt.get();
        List<UserTask> uts = userTaskRepository.findByTask_Id(taskId);
        if (uts.isEmpty()) {
            return taskRepository.save(task);
        }

        boolean allDone = uts.stream().allMatch(ut -> "DONE".equals(norm(ut.getStatus())));
        boolean anyInProgress = uts.stream().anyMatch(ut -> "IN_PROGRESS".equals(norm(ut.getStatus())));
        boolean anyInReview = uts.stream().anyMatch(ut -> "IN_REVIEW".equals(norm(ut.getStatus())));
        boolean anyDone = uts.stream().anyMatch(ut -> "DONE".equals(norm(ut.getStatus())));

        String newStatus;
        if (allDone) {
            newStatus = "DONE";
        } else if (anyInProgress) {
            newStatus = "IN_PROGRESS";
        } else if (anyInReview) {
            newStatus = "IN_REVIEW";
        } else if (anyDone) {
            newStatus = "IN_REVIEW";
        } else {
            newStatus = "TODO";
        }

        String previous = norm(task.getStatus());
        task.setStatus(newStatus);
        if ("DONE".equals(newStatus) && !"DONE".equals(previous)) {
            task.setFinishDate(LocalDateTime.now());
        } else if (!"DONE".equals(newStatus) && "DONE".equals(previous)) {
            task.setFinishDate(task.getDueDate() != null ? task.getDueDate() : LocalDateTime.now());
        }
        task.setUpdatedAt(LocalDateTime.now());
        return taskRepository.save(task);
    }
}
