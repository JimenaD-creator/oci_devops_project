package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.SprintInsightEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SprintInsightEmbeddingRepository extends JpaRepository<SprintInsightEmbedding, Long> {

    Optional<SprintInsightEmbedding> findBySprintId(Long sprintId);

    List<SprintInsightEmbedding> findByProjectId(Long projectId);

    @Modifying
    @Query("DELETE FROM SprintInsightEmbedding e WHERE e.sprintId = :sprintId")
    void deleteBySprintId(@Param("sprintId") Long sprintId);
}
