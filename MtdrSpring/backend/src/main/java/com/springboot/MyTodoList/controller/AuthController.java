package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.AuthLoginRequest;
import com.springboot.MyTodoList.dto.AuthLoginResponse;
import com.springboot.MyTodoList.dto.AuthUserResponse;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.JwtService;
import com.springboot.MyTodoList.service.UserService;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000")
public class AuthController {
    private final UserService userService;
    private final JwtService jwtService;

    public AuthController(UserService userService, JwtService jwtService) {
        this.userService = userService;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthLoginRequest request) {
        if (request == null || isBlank(request.getIdentifier()) || isBlank(request.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Identifier and password are required."));
        }

        Optional<User> authenticatedUser = userService.authenticateByIdentifierAndPassword(
                request.getIdentifier(),
                request.getPassword());

        if (authenticatedUser.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid credentials."));
        }

        User user = authenticatedUser.get();

        String token = jwtService.generateToken(user);
        return ResponseEntity.ok(new AuthLoginResponse(token, new AuthUserResponse(user)));
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
