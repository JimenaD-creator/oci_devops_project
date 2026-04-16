package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UserTaskRepository extends JpaRepository<UserTask, UserTaskId> {

    /**
     * Finds all UserTask assignments associated with a specific Task ID.
     * This resolves the "cannot find symbol" error in TaskController and TaskAssignmentSyncService.
     */
    List<UserTask> findByTask_Id(Long taskId);

    /**
     * Finds all UserTask assignments associated with a specific Sprint ID through the Task relationship.
     * This resolves the "cannot find symbol" error in UserTaskController.
     */
    List<UserTask> findByTask_AssignedSprint_Id(Long sprintId);
}