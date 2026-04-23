package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Task;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.transaction.Transactional;

@Repository
@Transactional
public interface TaskRepository extends JpaRepository<Task, Long> {

    @Query("SELECT t.status, COUNT(t) FROM Task t WHERE t.assignedSprint.id = :sid GROUP BY t.status")
    List<Object[]> countTasksByStatusForSprint(@Param("sid") Long sprintId);
}
