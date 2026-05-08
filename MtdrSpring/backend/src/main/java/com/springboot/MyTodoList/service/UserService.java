package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.TeamMemberRepository;
import com.springboot.MyTodoList.repository.TeamRepository;
import com.springboot.MyTodoList.dto.UserDetailDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeamMemberRepository teamMemberRepository;

    @Autowired
    private TeamRepository teamRepository;

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public List<UserDetailDTO> getAllUserDetails() {
        return userRepository.findAllUserDetails();
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public User saveUser(User user) {
        if (user.getType() == null ||
           (!user.getType().equalsIgnoreCase("MANAGER") && !user.getType().equalsIgnoreCase("DEVELOPER"))) {
            throw new RuntimeException("Rol no permitido. Solo se permite MANAGER o DEVELOPER.");
        }
        user.setType(user.getType().toUpperCase());
        return userRepository.save(user);
    }

    @Transactional
    public void deleteUser(Long id) {
        // 1. Borrar membresías del usuario en equipos
        teamMemberRepository.deleteByUserId(id);

        // 2. Desasignar de cualquier equipo donde sea manager
        teamRepository.findByManagerId(id).ifPresent(team -> {
            team.setManager(null);
            teamRepository.save(team);
        });

        // 3. Borrar el usuario
        userRepository.deleteById(id);
    }

    public User updateUser(Long id, User userDetails) {
        return userRepository.findById(id).map(user -> {
            user.setName(userDetails.getName());
            user.setEmail(userDetails.getEmail());
            user.setPhoneNumber(userDetails.getPhoneNumber());
            user.setUserPassword(userDetails.getUserPassword());
            if (userDetails.getProfilePicture() != null) {
                user.setProfilePicture(userDetails.getProfilePicture());
            }
            if (userDetails.getType() != null &&
               (userDetails.getType().equalsIgnoreCase("MANAGER") || userDetails.getType().equalsIgnoreCase("DEVELOPER"))) {
                user.setType(userDetails.getType().toUpperCase());
            }
            return userRepository.save(user);
        }).orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }

    public boolean verifyUserCredentials(Long userId, String phoneOrEmail, String password) {
        Optional<User> user = userRepository.findById(userId);
        if (!user.isPresent()) return false;

        User foundUser = user.get();
        boolean phoneMatches = phoneOrEmail != null && phoneOrEmail.equals(foundUser.getPhoneNumber());
        boolean emailMatches = phoneOrEmail != null && phoneOrEmail.equals(foundUser.getEmail());
        if (!phoneMatches && !emailMatches) return false;
        if (password == null || !password.equals(foundUser.getUserPassword())) return false;

        return true;
    }
}