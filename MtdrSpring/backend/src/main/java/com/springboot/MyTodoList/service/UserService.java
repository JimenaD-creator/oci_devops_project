package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.TeamMemberRepository;
import com.springboot.MyTodoList.repository.TeamRepository;
import com.springboot.MyTodoList.dto.UserDetailDTO;
import com.springboot.MyTodoList.util.UserRoleUtil;
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
        if (!UserRoleUtil.isAllowedMemberType(user.getType())) {
            throw new RuntimeException(
                    "Role not allowed. Use MANAGER or a team role (e.g., front-end developer, DevOps engineer).");
        }
        user.setType(UserRoleUtil.normalizeDisplayType(user.getType()));
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
            if (userDetails.getType() != null) {
                if (!UserRoleUtil.isAllowedMemberType(userDetails.getType())) {
                    throw new RuntimeException(
                            "Role not allowed. Use MANAGER or a team role (e.g., front-end developer, DevOps engineer).");
                }
                user.setType(UserRoleUtil.normalizeDisplayType(userDetails.getType()));
            }
            return userRepository.save(user);
        }).orElseThrow(() -> new RuntimeException("User not found"));
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

    public Optional<User> authenticateByIdentifierAndPassword(String identifier, String password) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String trimmed = identifier.trim();
        Optional<User> user = userRepository.findByEmailIgnoreCase(trimmed);
        if (user.isEmpty()) {
            user = userRepository.findByPhonenumber(trimmed);
        }
        if (user.isEmpty()) {
            user = userRepository.findByNameIgnoreCase(trimmed);
        }
        if (user.isEmpty()) {
            return Optional.empty();
        }
        User u = user.get();
        if (password == null || !password.equals(u.getUserPassword())) {
            return Optional.empty();
        }
        return Optional.of(u);
    }

    /**
     * Looks up a user by email (case-insensitive) or exact phone, then checks password (plain-text match, same as verifyUserCredentials).
     */
    public Optional<Long> verifyCredentialsByPhoneOrEmailAndPassword(String phoneOrEmail, String password) {
        return authenticateByIdentifierAndPassword(phoneOrEmail, password)
                .map(User::getId);
    }
}