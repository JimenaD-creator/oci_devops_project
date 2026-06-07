package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.TaskLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskLogRepository extends JpaRepository<TaskLog, Long> {

    void deleteByTask_Id(Long taskId);
}
