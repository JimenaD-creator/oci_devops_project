package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.TaskEmbedding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Repository
public interface TaskEmbeddingRepository extends JpaRepository<TaskEmbedding, Long> {

    List<TaskEmbedding> findBySprintId(Long sprintId);

    List<TaskEmbedding> findByTaskId(Long taskId);

    @Modifying
    @Transactional
    @Query("DELETE FROM TaskEmbedding te WHERE te.taskId = :taskId")
    void deleteByTaskId(@Param("taskId") Long taskId);

    @Modifying
    @Transactional
    @Query("DELETE FROM TaskEmbedding te WHERE te.sprintId = :sprintId")
    void deleteBySprintId(@Param("sprintId") Long sprintId);
}