package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.TeamMembers;
import com.springboot.MyTodoList.model.TeamMembersId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamMembersRepository extends JpaRepository<TeamMembers, TeamMembersId> {
    List<TeamMembers> findByTeam_Id(Long teamId);
}
