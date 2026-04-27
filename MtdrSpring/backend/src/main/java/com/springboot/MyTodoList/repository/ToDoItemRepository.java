package com.springboot.MyTodoList.repository;


import com.springboot.MyTodoList.model.ToDoItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.EnableTransactionManagement;

//import jakarta.transaction.Transactional;
import java.util.List;

@Repository
@Transactional
@EnableTransactionManagement
public interface ToDoItemRepository extends JpaRepository<ToDoItem,Integer> {

    List<ToDoItem> findByAssignedSprint(Integer assignedSprint);

    @Modifying
    @Transactional
    @Query("UPDATE ToDoItem t SET t.status = :status WHERE t.ID = :id")
    int updateStatusOnly(@Param("id") int id, @Param("status") String status);
    
}
