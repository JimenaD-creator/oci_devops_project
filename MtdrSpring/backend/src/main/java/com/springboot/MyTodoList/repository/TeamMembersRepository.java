package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.TeamMembersId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamMembersRepository extends JpaRepository<TeamMember, TeamMembersId> {
    List<TeamMember> findByTeam_Id(Long teamId);
}
