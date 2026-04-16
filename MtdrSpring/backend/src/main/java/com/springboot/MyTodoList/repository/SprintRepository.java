package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Sprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.transaction.Transactional;
import java.util.List;

@Repository
@Transactional
public interface SprintRepository extends JpaRepository<Sprint, Long> {
    
    List<Sprint> findByAssignedProjectId(Long projectId);
    
}