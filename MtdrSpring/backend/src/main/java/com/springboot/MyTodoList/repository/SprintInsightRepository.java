package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.SprintInsight;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SprintInsightRepository extends JpaRepository<SprintInsight, Long> {

    Optional<SprintInsight> findBySprintId(Long sprintId);

    List<SprintInsight> findByProjectIdOrderByGeneratedAtDesc(Long projectId);
}