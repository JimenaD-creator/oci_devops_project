package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UserTaskRepository extends JpaRepository<UserTask, UserTaskId> {
    
    List<UserTask> findByTask_Id(Long taskId);
    
    List<UserTask> findByTask_AssignedSprint_Id(Long sprintId);
    
    List<UserTask> findByUser_Id(Long userId);

    /** One query for Telegram: this user's rows only, tasks in the given sprint (avoids loading all sprint USER_TASK). */
    List<UserTask> findByUser_IdAndTask_AssignedSprint_Id(Long userId, Long sprintId);
    
    @Query("SELECT ut FROM UserTask ut JOIN FETCH ut.user JOIN FETCH ut.task")
    List<UserTask> findAllWithUserAndTask();

    /**
     * All USER_TASK rows for tasks in this sprint, with user and task eagerly loaded.
     * Avoid DISTINCT + JOIN FETCH (can drop valid rows on some providers); dedupe in Java if needed.
     */
    @Query("SELECT ut FROM UserTask ut LEFT JOIN FETCH ut.user JOIN FETCH ut.task t WHERE t.assignedSprint.id = :sprintId")
    List<UserTask> findBySprintIdWithUserAndTask(@Param("sprintId") Long sprintId);
}