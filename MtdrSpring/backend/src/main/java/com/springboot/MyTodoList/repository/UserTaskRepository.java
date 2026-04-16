package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UserTaskRepository extends JpaRepository<UserTask, UserTaskId> {

    /**
     * Eager fetch for JSON (dashboard) — avoids lazy issues; DISTINCT prevents duplicate roots with multiple joins.
     */
    @Query("SELECT DISTINCT ut FROM UserTask ut LEFT JOIN FETCH ut.user LEFT JOIN FETCH ut.task t LEFT JOIN FETCH t.assignedSprint")
    List<UserTask> findAllWithUserAndTask();

    /** All assignments for a given task (TASK_ID). */
    List<UserTask> findByTask_Id(Long taskId);

    /** Assignments for tasks belonging to a sprint (via TASK.ASSIGNED_SPRINT). */
    List<UserTask> findByTask_AssignedSprint_Id(Long sprintId);
}