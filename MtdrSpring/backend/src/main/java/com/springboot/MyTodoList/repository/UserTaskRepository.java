package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.transaction.Transactional;
import java.util.List;

@Repository
@Transactional
public interface UserTaskRepository extends JpaRepository<UserTask, UserTaskId> {
    List<UserTask> findByTask_AssignedSprint_Id(Long sprintId);

    List<UserTask> findByTask_Id(Long taskId);
}