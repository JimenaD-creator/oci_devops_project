package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.model.UserTaskId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Collection;
import java.util.List;

@Repository
public interface UserTaskRepository extends JpaRepository<UserTask, UserTaskId> {
    
    List<UserTask> findByTask_Id(Long taskId);
    
    List<UserTask> findByTask_AssignedSprint_Id(Long sprintId);
    
    List<UserTask> findByUser_Id(Long userId);

    java.util.Optional<UserTask> findByUser_IdAndTask_Id(Long userId, Long taskId);

    /** One query for Telegram: this user's rows only, tasks in the given sprint (avoids loading all sprint USER_TASK). */
    List<UserTask> findByUser_IdAndTask_AssignedSprint_Id(Long userId, Long sprintId);
    
    @Query("SELECT ut FROM UserTask ut JOIN FETCH ut.user JOIN FETCH ut.task")
    List<UserTask> findAllWithUserAndTask();

    @Query(
            "SELECT ut FROM UserTask ut JOIN FETCH ut.user JOIN FETCH ut.task t "
                    + "WHERE t.assignedSprint.assignedProject.id = :projectId")
    List<UserTask> findByProjectIdWithUserAndTask(@Param("projectId") Long projectId);

    /**
     * All USER_TASK rows for tasks in this sprint, with user and task eagerly loaded.
     * Avoid DISTINCT + JOIN FETCH (can drop valid rows on some providers); dedupe in Java if needed.
     */
    @Query("SELECT ut FROM UserTask ut LEFT JOIN FETCH ut.user JOIN FETCH ut.task t WHERE t.assignedSprint.id = :sprintId")
    List<UserTask> findBySprintIdWithUserAndTask(@Param("sprintId") Long sprintId);

    /** Task detail dialog: one round-trip with user names (avoids N+1 lazy loads). */
    @Query(
            "SELECT ut FROM UserTask ut LEFT JOIN FETCH ut.user JOIN FETCH ut.task t "
                    + "WHERE ut.id.taskId = :taskId")
    List<UserTask> findByTaskIdWithUserAndTask(@Param("taskId") Long taskId);

    @Query("SELECT DISTINCT t.assignedSprint.id FROM UserTask ut JOIN ut.task t WHERE ut.user.id = :userId AND t.assignedSprint IS NOT NULL")
    List<Long> findDistinctSprintIdsByUserId(@Param("userId") Long userId);

    /** Developer blocker history in project (active + resolved if reason exists). */
    @Query(
            "SELECT ut FROM UserTask ut JOIN FETCH ut.user JOIN FETCH ut.task t "
                    + "JOIN FETCH t.assignedSprint s "
                    + "WHERE ut.user.id = :userId "
                    + "AND LENGTH(TRIM(COALESCE(ut.blockedReason, ''))) > 0 "
                    + "AND t.assignedSprint.assignedProject.id = :projectId")
    List<UserTask> findBlockerReportsByUserIdAndProjectId(
            @Param("userId") Long userId, @Param("projectId") Long projectId);

    /** Open assignments on tasks whose due date is on or before {@code windowEnd} (e.g. now + 72h). */
    @Query(
            "SELECT ut FROM UserTask ut "
                    + "JOIN FETCH ut.user "
                    + "JOIN FETCH ut.task t "
                    + "LEFT JOIN FETCH t.assignedSprint s "
                    + "LEFT JOIN FETCH s.assignedProject p "
                    + "LEFT JOIN FETCH p.assignedTeam team "
                    + "LEFT JOIN FETCH team.manager "
                    + "WHERE t.dueDate IS NOT NULL AND t.dueDate <= :windowEnd "
                    + "AND (t.status IS NULL OR UPPER(t.status) <> 'DONE') "
                    + "AND (ut.status IS NULL OR UPPER(ut.status) NOT IN ('DONE', 'COMPLETED', 'COMPLETE')) "
                    + "AND ut.completedAt IS NULL")
    List<UserTask> findAssignmentsDueBefore(@Param("windowEnd") java.time.LocalDateTime windowEnd);

    @Query(
            "SELECT ut.id.taskId, COUNT(ut) FROM UserTask ut "
                    + "WHERE ut.id.taskId IN :taskIds GROUP BY ut.id.taskId")
    List<Object[]> countAssigneesGroupedByTaskId(@Param("taskIds") Collection<Long> taskIds);
}