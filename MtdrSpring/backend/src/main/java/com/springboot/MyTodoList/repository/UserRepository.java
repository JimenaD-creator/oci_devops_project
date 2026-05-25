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
           "COALESCE(tm.team.id, mt.id), " +
           "COALESCE(t.name, mt.name), " +
           "mt.name, " +
           "COALESCE(p.name, mp.name)) " +
           "FROM User u " +
           "LEFT JOIN TeamMember tm ON tm.user.id = u.id " +
           "LEFT JOIN Team t ON t.id = tm.team.id " +
           "LEFT JOIN Project p ON p.assignedTeam.id = t.id " +
           "LEFT JOIN Team mt ON mt.manager.id = u.id " +
           "LEFT JOIN Project mp ON mp.assignedTeam.id = mt.id " +
           "GROUP BY u.id, u.name, u.email, u.phonenumber, u.type, " +
           "tm.team.id, t.name, mt.id, mt.name, p.name, mp.name")
    List<UserDetailDTO> findAllUserDetails();
}