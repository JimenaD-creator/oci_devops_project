package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Task;
import java.util.List;
import java.util.Optional;
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

    @Query("SELECT t FROM Task t WHERE t.assignedSprint.id = :sprintId")
    List<Task> findByAssignedSprintId(@Param("sprintId") Long sprintId);

    @Query("SELECT t FROM Task t WHERE t.assignedSprint.assignedProject.id = :projectId")
    List<Task> findByProjectId(@Param("projectId") Long projectId);

    /** Eager sprint id only — avoids N+1 when serializing dashboard task lists. */
    @Query(
            "SELECT DISTINCT t FROM Task t JOIN FETCH t.assignedSprint s "
                    + "WHERE s.assignedProject.id = :projectId")
    List<Task> findByProjectIdWithSprint(@Param("projectId") Long projectId);

    @Query("SELECT t.assignedSprint.assignedProject.id FROM Task t WHERE t.id = :taskId")
    Optional<Long> findProjectIdByTaskId(@Param("taskId") Long taskId);
}