package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    boolean existsByAssignedTeamId(Long teamId);

    @Query("SELECT p FROM Project p WHERE p.assignedTeam.manager.id = :managerId")
    Optional<Project> findByManagerId(@Param("managerId") Long managerId);

    @Query("SELECT p FROM Project p WHERE p.assignedTeam.manager.id = :managerId ORDER BY p.id")
    List<Project> findAllByManagerId(@Param("managerId") Long managerId);

    @Query("SELECT p FROM Project p "
            + "JOIN p.assignedTeam t "
            + "JOIN TeamMember tm ON tm.team.id = t.id "
            + "WHERE tm.user.id = :userId")
    Optional<Project> findByTeamMemberUserId(@Param("userId") Long userId);

    @Query("SELECT p FROM Project p WHERE p.assignedTeam.id IN "
            + "(SELECT tm.team.id FROM TeamMember tm WHERE tm.user.id = :userId) ORDER BY p.id")
    List<Project> findAllProjectsForTeamMember(@Param("userId") Long userId);
}