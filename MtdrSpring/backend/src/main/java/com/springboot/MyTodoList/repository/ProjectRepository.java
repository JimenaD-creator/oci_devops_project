package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    
    @Query("SELECT p FROM Project p JOIN p.assignedTeam t WHERE t.assignedManager.id = :managerId")
    Project findByManagerId(@Param("managerId") Integer managerId);
}