package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    boolean existsByAssignedTeamId(Long teamId);

    @Query("SELECT p FROM Project p WHERE p.assignedTeam.manager.id = :managerId")
    Optional<Project> findByManagerId(@Param("managerId") Long managerId);
}