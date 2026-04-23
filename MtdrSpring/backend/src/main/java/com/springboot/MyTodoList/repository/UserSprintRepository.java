package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.UserSprint;
import com.springboot.MyTodoList.model.UserSprintId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserSprintRepository extends JpaRepository<UserSprint, UserSprintId> {

    /** Developers enrolled on the sprint (USER_SPRINT), even when they have no USER_TASK rows yet. */
    @Query("SELECT us FROM UserSprint us LEFT JOIN FETCH us.user WHERE us.id.sprintId = :sprintId")
    List<UserSprint> findBySprintIdWithUser(@Param("sprintId") Long sprintId);
}
