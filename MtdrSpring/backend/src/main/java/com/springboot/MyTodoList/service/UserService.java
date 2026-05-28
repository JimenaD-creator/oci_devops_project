package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.repository.TeamMemberRepository;
import com.springboot.MyTodoList.repository.TeamRepository;
import com.springboot.MyTodoList.dto.UserDetailDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
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

    @Autowired
    private PasswordEncoder passwordEncoder;

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
        teamMemberRepository.deleteByUserId(id);
        teamRepository.findByManagerId(id).ifPresent(team -> {
            team.setManager(null);
            teamRepository.save(team);
        });
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
        if (password == null) return false;

        return passwordEncoder.matches(password, foundUser.getUserPassword());
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
        if (password == null || !passwordEncoder.matches(password, u.getUserPassword())) {
            return Optional.empty();
        }
        return Optional.of(u);
    }

    public Optional<Long> verifyCredentialsByPhoneOrEmailAndPassword(String phoneOrEmail, String password) {
        return authenticateByIdentifierAndPassword(phoneOrEmail, password)
                .map(User::getId);
    }
}