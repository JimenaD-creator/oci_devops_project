package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.transaction.Transactional;

@Repository
@Transactional
public interface TeamRepository extends JpaRepository<Team, Long> {
    
}
