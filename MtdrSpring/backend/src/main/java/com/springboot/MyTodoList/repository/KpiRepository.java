package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Map;

@Repository
public interface KpiRepository extends JpaRepository<Sprint, Long> {

    @Query(nativeQuery = true, value =
        "SELECT s.id AS sprint_id, COUNT(t.id) AS total_tasks," +
        " SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS completed_tasks," +
        " ROUND(CASE WHEN COUNT(t.id) = 0 THEN 0" +
        " ELSE SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) / COUNT(t.id) END, 4) AS completion_rate" +
        " FROM sprint s LEFT JOIN task t ON t.assigned_sprint = s.id" +
        " WHERE s.id = :sprintId GROUP BY s.id"
    )
    Map<String, Object> getCompletionRate(@Param("sprintId") Long sprintId);

    @Query(nativeQuery = true, value =
        "SELECT s.id AS sprint_id," +
        " SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) AS completed_tasks," +
        " SUM(CASE WHEN t.status = 'DONE' AND t.finish_date <= t.due_date THEN 1 ELSE 0 END) AS on_time_tasks," +
        " ROUND(CASE WHEN SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) = 0 THEN 0" +
        " ELSE SUM(CASE WHEN t.status = 'DONE' AND t.finish_date <= t.due_date THEN 1 ELSE 0 END)" +
        " / SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) END, 4) AS on_time_delivery" +
        " FROM sprint s LEFT JOIN task t ON t.assigned_sprint = s.id" +
        " WHERE s.id = :sprintId GROUP BY s.id"
    )
    Map<String, Object> getOnTimeDelivery(@Param("sprintId") Long sprintId);

    @Query(nativeQuery = true, value =
        "SELECT us.user_id, us.sprint_id, COUNT(ut.task_id) AS user_tasks," +
        " COUNT(DISTINCT t.id) OVER (PARTITION BY us.sprint_id) AS total_tasks," +
        " COUNT(DISTINCT us.user_id) OVER (PARTITION BY us.sprint_id) AS total_users," +
        " ROUND(LEAST(CASE WHEN COUNT(DISTINCT t.id) OVER (PARTITION BY us.sprint_id) = 0 THEN 0" +
        " ELSE (COUNT(ut.task_id) * COUNT(DISTINCT us.user_id) OVER (PARTITION BY us.sprint_id))" +
        " / COUNT(DISTINCT t.id) OVER (PARTITION BY us.sprint_id) END, 1), 4) AS contribution_score" +
        " FROM user_sprint us" +
        " LEFT JOIN user_task ut ON ut.user_id = us.user_id" +
        " LEFT JOIN task t ON t.id = ut.task_id AND t.assigned_sprint = us.sprint_id" +
        " WHERE us.sprint_id = :sprintId GROUP BY us.user_id, us.sprint_id"
    )
    List<Map<String, Object>> getContributionScore(@Param("sprintId") Long sprintId);

    @Query(nativeQuery = true, value =
        "SELECT s.id AS sprint_id," +
        " CASE WHEN stats.total_tasks IS NULL OR stats.total_tasks = 0 THEN 0" +
        " WHEN stats.min_tasks = 0 THEN 0" +
        " ELSE 1 - ((stats.max_tasks - stats.min_tasks) / stats.total_tasks) END AS workload_balance" +
        " FROM sprint s LEFT JOIN (" +
        "   SELECT t.assigned_sprint, COUNT(t.id) AS total_tasks," +
        "     MAX(user_task_count) AS max_tasks, MIN(user_task_count) AS min_tasks" +
        "   FROM (SELECT t.assigned_sprint, ut.user_id, COUNT(*) AS user_task_count" +
        "     FROM task t JOIN user_task ut ON ut.task_id = t.id" +
        "     GROUP BY t.assigned_sprint, ut.user_id) user_distribution" +
        "   JOIN task t ON t.assigned_sprint = user_distribution.assigned_sprint" +
        "   GROUP BY t.assigned_sprint" +
        " ) stats ON stats.assigned_sprint = s.id" +
        " WHERE s.id = :sprintId"
    )
    Map<String, Object> getWorkloadBalance(@Param("sprintId") Long sprintId);

    @Query(nativeQuery = true, value =
        "SELECT s.id AS sprint_id," +
        " NVL(w.total_worked_hours, 0) AS total_worked_hours," +
        " NVL(e.total_expected_hours, 0) AS total_expected_hours," +
        " ROUND(CASE WHEN NVL(e.total_expected_hours, 0) = 0 THEN 0" +
        " ELSE NVL(w.total_worked_hours, 0) / e.total_expected_hours END, 4) AS team_participation" +
        " FROM sprint s" +
        " LEFT JOIN (" +
        "   SELECT t.assigned_sprint AS sprint_id, SUM(ut.worked_hours) AS total_worked_hours" +
        "   FROM task t" +
        "   LEFT JOIN user_task ut ON ut.task_id = t.id" +
        "   GROUP BY t.assigned_sprint" +
        " ) w ON w.sprint_id = s.id" +
        " LEFT JOIN (" +
        "   SELECT t.assigned_sprint AS sprint_id, SUM(t.assigned_hours) AS total_expected_hours" +
        "   FROM task t" +
        "   GROUP BY t.assigned_sprint" +
        " ) e ON e.sprint_id = s.id" +
        " WHERE s.id = :sprintId"
    )
    Map<String, Object> getTeamParticipation(@Param("sprintId") Long sprintId);
}