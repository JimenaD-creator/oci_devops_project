package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.dto.UserDetailDTO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    @Query("SELECT new com.springboot.MyTodoList.dto.UserDetailDTO(" +
           "u.id, u.name, u.type, " +
           "COALESCE(tm_team.id, managed_team.id), " +
           "tm_team.name, " +
           "managed_team.name, " +
           "COALESCE(p1.name, p2.name)) " +
           "FROM User u " +
           "LEFT JOIN TeamMember tm ON u.id = tm.user.id " +
           "LEFT JOIN Team tm_team ON tm.team.id = tm_team.id " +
           "LEFT JOIN Project p1 ON tm_team.id = p1.assignedTeam.id " +
           "LEFT JOIN Team managed_team ON u.id = managed_team.manager.id " +
           "LEFT JOIN Project p2 ON managed_team.id = p2.assignedTeam.id")
    List<UserDetailDTO> findAllUserDetails();

    Optional<User> findByPhonenumber(String phonenumber);
    Optional<User> findByIdAndUserpassword(Long userId, String userpassword);
}