package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    boolean existsByManagerId(Long userId);
    Optional<Team> findByManagerId(Long managerId);
}