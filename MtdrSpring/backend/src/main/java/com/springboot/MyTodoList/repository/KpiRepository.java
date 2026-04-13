package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.transaction.Transactional;
import java.util.Map;

@Repository
@Transactional
public interface KpiRepository extends JpaRepository<Sprint, Long> {
    
    /**
     * Calculates completion rate for a sprint
     * Formula: completed_tasks / total_tasks
     */
    @Query(nativeQuery = true, value =
        "SELECT \n" +
        "    s.id AS sprint_id,\n" +
        "    COUNT(t.id) AS total_tasks,\n" +
        "    SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS completed_tasks,\n" +
        "    ROUND(\n" +
        "        SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) \n" +
        "        / COUNT(t.id),\n" +
        "    4) AS completion_rate\n" +
        "FROM sprint s\n" +
        "LEFT JOIN task t \n" +
        "    ON t.assigned_sprint = s.id\n" +
        "WHERE s.id = :sprintId\n" +
        "GROUP BY s.id"
    )
    Map<String, Object> getCompletionRate(@Param("sprintId") Long sprintId);
    
    /**
     * Calculates on-time delivery rate for a sprint
     * Formula: on_time_completed_tasks / total_completed_tasks
     */
    @Query(nativeQuery = true, value =
        "SELECT \n" +
        "    s.id AS sprint_id,\n" +
        "    SUM(CASE \n" +
        "        WHEN t.status = 'DONE' THEN 1 \n" +
        "        ELSE 0 \n" +
        "    END) AS completed_tasks,\n" +
        "    SUM(CASE \n" +
        "        WHEN t.status = 'DONE' \n" +
        "         AND t.finish_date <= t.due_date THEN 1 \n" +
        "        ELSE 0 \n" +
        "    END) AS on_time_tasks,\n" +
        "    ROUND(\n" +
        "        CASE \n" +
        "            WHEN SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) = 0 \n" +
        "            THEN 0\n" +
        "            ELSE \n" +
        "                SUM(CASE \n" +
        "                    WHEN t.status = 'DONE' \n" +
        "                     AND t.finish_date <= t.due_date THEN 1 \n" +
        "                    ELSE 0 \n" +
        "                END)\n" +
        "                /\n" +
        "                SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END)\n" +
        "        END,\n" +
        "    4) AS on_time_delivery\n" +
        "FROM sprint s\n" +
        "LEFT JOIN task t \n" +
        "    ON t.assigned_sprint = s.id\n" +
        "WHERE s.id = :sprintId\n" +
        "GROUP BY s.id"
    )
    Map<String, Object> getOnTimeDelivery(@Param("sprintId") Long sprintId);
    
    /**
     * Calculates contribution score for a user in a sprint
     * Shows how much each team member contributed to sprint tasks
     */
    @Query(nativeQuery = true, value =
        "SELECT \n" +
        "    us.user_id,\n" +
        "    us.sprint_id,\n" +
        "    COUNT(ut.task_id) AS user_tasks,\n" +
        "    COUNT(DISTINCT t.id) OVER (PARTITION BY us.sprint_id) AS total_tasks,\n" +
        "    COUNT(DISTINCT us.user_id) OVER (PARTITION BY us.sprint_id) AS total_users,\n" +
        "    ROUND(\n" +
        "        LEAST(\n" +
        "            CASE \n" +
        "                WHEN COUNT(DISTINCT t.id) OVER (PARTITION BY us.sprint_id) = 0 \n" +
        "                THEN 0\n" +
        "                ELSE \n" +
        "                    (COUNT(ut.task_id) * \n" +
        "                     COUNT(DISTINCT us.user_id) OVER (PARTITION BY us.sprint_id))\n" +
        "                    /\n" +
        "                    COUNT(DISTINCT t.id) OVER (PARTITION BY us.sprint_id)\n" +
        "            END,\n" +
        "        1),\n" +
        "    4) AS contribution_score\n" +
        "FROM user_sprint us\n" +
        "LEFT JOIN user_task ut \n" +
        "    ON ut.user_id = us.user_id\n" +
        "LEFT JOIN task t \n" +
        "    ON t.id = ut.task_id\n" +
        "   AND t.assigned_sprint = us.sprint_id\n" +
        "WHERE us.sprint_id = :sprintId\n" +
        "GROUP BY us.user_id, us.sprint_id"
    )
    Map<String, Object> getContributionScore(@Param("sprintId") Long sprintId);
    
    /**
     * Calculates workload balance for a sprint
     * Shows if tasks are evenly distributed among team members
     * 1.0 = perfectly balanced, 0.0 = highly unbalanced
     */
    @Query(nativeQuery = true, value =
        "SELECT \n" +
        "    s.id AS sprint_id,\n" +
        "    1 - (\n" +
        "        CASE \n" +
        "            WHEN stats.total_tasks = 0 OR stats.min_tasks = 0 THEN 0\n" +
        "            ELSE \n" +
        "                (stats.max_tasks - stats.min_tasks) \n" +
        "                / stats.total_tasks\n" +
        "        END\n" +
        "    ) AS workload_balance\n" +
        "FROM sprint s\n" +
        "JOIN (\n" +
        "    SELECT \n" +
        "        t.assigned_sprint,\n" +
        "        COUNT(t.id) AS total_tasks,\n" +
        "        MAX(user_task_count) AS max_tasks,\n" +
        "        MIN(user_task_count) AS min_tasks\n" +
        "    FROM (\n" +
        "        SELECT \n" +
        "            t.assigned_sprint,\n" +
        "            ut.user_id,\n" +
        "            COUNT(*) AS user_task_count\n" +
        "        FROM task t\n" +
        "        JOIN user_task ut \n" +
        "            ON ut.task_id = t.id\n" +
        "        GROUP BY t.assigned_sprint, ut.user_id\n" +
        "    ) user_distribution\n" +
        "    JOIN task t\n" +
        "        ON t.assigned_sprint = user_distribution.assigned_sprint\n" +
        "    GROUP BY t.assigned_sprint\n" +
        ") stats\n" +
        "    ON stats.assigned_sprint = s.id\n" +
        "WHERE s.id = :sprintId"
    )
    Map<String, Object> getWorkloadBalance(@Param("sprintId") Long sprintId);
    
    /**
     * Calculates team participation rate for a sprint
     * Formula: total_worked_hours / total_expected_hours
     */
    @Query(nativeQuery = true, value =
        "SELECT \n" +
        "    s.id AS sprint_id,\n" +
        "    SUM(ut.worked_hours) AS total_worked_hours,\n" +
        "    SUM(t.assigned_hours) AS total_expected_hours,\n" +
        "    ROUND(\n" +
        "        CASE \n" +
        "            WHEN SUM(t.assigned_hours) = 0 THEN 0\n" +
        "            ELSE \n" +
        "                SUM(ut.worked_hours) / SUM(t.assigned_hours)\n" +
        "        END,\n" +
        "    4) AS team_participation\n" +
        "FROM sprint s\n" +
        "LEFT JOIN task t \n" +
        "    ON t.assigned_sprint = s.id\n" +
        "LEFT JOIN user_task ut \n" +
        "    ON ut.task_id = t.id\n" +
        "WHERE s.id = :sprintId\n" +
        "GROUP BY s.id"
    )
    Map<String, Object> getTeamParticipation(@Param("sprintId") Long sprintId);
}