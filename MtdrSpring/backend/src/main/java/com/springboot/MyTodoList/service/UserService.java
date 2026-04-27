package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.dto.UserDetailDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

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
        // Normalizar a mayúsculas para consistencia
        user.setType(user.getType().toUpperCase());
        return userRepository.save(user);
    }

    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    public User updateUser(Long id, User userDetails) {
        return userRepository.findById(id).map(user -> {
            user.setName(userDetails.getName());
            user.setEmail(userDetails.getEmail());
            user.setPhoneNumber(userDetails.getPhoneNumber());
            user.setUserPassword(userDetails.getUserPassword());
            
            if (userDetails.getType() != null && 
               (userDetails.getType().equalsIgnoreCase("MANAGER") || userDetails.getType().equalsIgnoreCase("DEVELOPER"))) {
                user.setType(userDetails.getType().toUpperCase());
            }
            
            return userRepository.save(user);
        }).orElseThrow(() -> new RuntimeException("Usuario no encontrado"));
    }

    /**
     * Verify user credentials against database.
     * Checks if the provided phone/email and password match a user with the given ID.
     *
     * @param userId The user ID to verify
     * @param phoneOrEmail The phone number or email provided by user
     * @param password The password provided by user
     * @return true if credentials are valid, false otherwise
     */
    public boolean verifyUserCredentials(Long userId, String phoneOrEmail, String password) {
        Optional<User> user = userRepository.findById(userId);
        if (!user.isPresent()) {
            return false;
        }

        User foundUser = user.get();
        
        // Check if provided phone/email matches
        boolean phoneMatches = phoneOrEmail != null && phoneOrEmail.equals(foundUser.getPhoneNumber());
        boolean emailMatches = phoneOrEmail != null && phoneOrEmail.equals(foundUser.getEmail());
        
        if (!phoneMatches && !emailMatches) {
            return false;
        }

        // Check if password matches
        if (password == null || !password.equals(foundUser.getUserPassword())) {
            return false;
        }

        return true;
    }
}