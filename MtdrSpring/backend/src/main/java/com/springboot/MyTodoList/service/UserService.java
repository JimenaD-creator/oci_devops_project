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
}