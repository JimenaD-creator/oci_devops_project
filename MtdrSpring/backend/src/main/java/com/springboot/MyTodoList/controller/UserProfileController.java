package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserProfileController {

    @Autowired
    private UserRepository userRepository;

    @PutMapping("/{userId}/profile-picture")
    public ResponseEntity<?> uploadProfilePicture(
            @PathVariable Long userId,
            @RequestBody Map<String, String> body) {

        String base64 = body.get("profilePicture");
        if (base64 == null || base64.isBlank())
            return ResponseEntity.badRequest().body("No image provided");

        return userRepository.findById(userId)
            .map(user -> {
                user.setProfilePicture(base64);
                userRepository.save(user);
                return ResponseEntity.ok().build();
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{userId}/profile-picture")
    public ResponseEntity<?> deleteProfilePicture(@PathVariable Long userId) {
        return userRepository.findById(userId)
            .map(user -> {
                user.setProfilePicture(null);
                userRepository.save(user);
                return ResponseEntity.ok().build();
            })
            .orElse(ResponseEntity.notFound().build());
    }
}