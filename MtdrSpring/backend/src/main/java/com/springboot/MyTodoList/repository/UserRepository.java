package com.springboot.MyTodoList.repository;

import com.springboot.MyTodoList.dto.UserDetailDTO;
import com.springboot.MyTodoList.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByPhonenumber(String phonenumber);
    Optional<User> findByNameIgnoreCase(String name);
    
    @Query("SELECT new com.springboot.MyTodoList.dto.UserDetailDTO(" +
           "u.id, u.name, u.email, u.phonenumber, u.type, " +
           "tm.team.id, t.name, " +
           "CASE WHEN (SELECT COUNT(tm2) FROM TeamMember tm2 WHERE tm2.team.manager.id = u.id) > 0 " +
           "THEN (SELECT t2.name FROM Team t2 WHERE t2.manager.id = u.id) ELSE NULL END, " +
           "p.name) " +
           "FROM User u " +
           "LEFT JOIN TeamMember tm ON tm.user.id = u.id " +
           "LEFT JOIN Team t ON t.id = tm.team.id " +
           "LEFT JOIN Project p ON p.assignedTeam.id = tm.team.id " +
           "GROUP BY u.id, u.name, u.email, u.phonenumber, u.type, tm.team.id, t.name, p.name")
    List<UserDetailDTO> findAllUserDetails();
}