package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.TeamMembersId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, TeamMembersId> {

    @Modifying
    @Query("DELETE FROM TeamMember tm WHERE tm.user.id = :userId")
    void deleteByUserId(@Param("userId") Long userId);
}