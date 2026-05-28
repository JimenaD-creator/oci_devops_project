package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.AuthLoginRequest;
import com.springboot.MyTodoList.dto.AuthLoginResponse;
import com.springboot.MyTodoList.dto.AuthUserResponse;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.JwtService;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.util.UserRoleUtil;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserService userService;
    private final JwtService jwtService;
    private final ProjectLookupService projectLookupService;

    public AuthController(
            UserService userService,
            JwtService jwtService,
            ProjectLookupService projectLookupService) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.projectLookupService = projectLookupService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthLoginRequest request) {
        if (request == null || isBlank(request.getIdentifier()) || isBlank(request.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Identifier and password are required."));
        }

        try {
            Optional<User> authenticatedUser = userService.authenticateByIdentifierAndPassword(
                    request.getIdentifier(),
                    request.getPassword());

            if (authenticatedUser.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Invalid credentials."));
            }

            User user = authenticatedUser.get();

            String token = jwtService.generateToken(user);
            Long projectId = null;
            String projectName = null;
            if (UserRoleUtil.isManager(user.getType())) {
                Project p = projectLookupService.findPrimaryProjectForManager(user.getId()).orElse(null);
                if (p != null) {
                    projectId = p.getId();
                    projectName = p.getName();
                }
            } else if (UserRoleUtil.isDeveloper(user.getType())) {
                Project p = projectLookupService.findPrimaryProjectForDeveloper(user.getId()).orElse(null);
                if (p != null) {
                    projectId = p.getId();
                    projectName = p.getName();
                }
            }
            return ResponseEntity.ok(
                    new AuthLoginResponse(token, new AuthUserResponse(user), projectId, projectName));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Login failed on the server. Please try again or contact support."));
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
