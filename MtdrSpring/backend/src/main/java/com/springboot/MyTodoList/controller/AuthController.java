package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.AuthLoginRequest;
import com.springboot.MyTodoList.dto.AuthLoginResponse;
import com.springboot.MyTodoList.dto.AuthUserResponse;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.service.EmailService;
import com.springboot.MyTodoList.service.JwtService;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.util.UserRoleUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final UserService userService;
    private final JwtService jwtService;
    private final ProjectLookupService projectLookupService;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    public AuthController(
            UserService userService,
            JwtService jwtService,
            ProjectLookupService projectLookupService,
            UserRepository userRepository,
            EmailService emailService,
            PasswordEncoder passwordEncoder) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.projectLookupService = projectLookupService;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthLoginRequest request) {
        logger.info("🔐 Intento de login para identifier: {}", request.getIdentifier());

        if (request == null || isBlank(request.getIdentifier()) || isBlank(request.getPassword())) {
            logger.warn("⚠️ Login fallido: identifier o password vacío");
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

            logger.info("✅ Login exitoso para usuario: {} (ID: {})", user.getEmail(), user.getId());
            return ResponseEntity.ok(
                    new AuthLoginResponse(token, new AuthUserResponse(user), projectId, projectName));

        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Login failed on the server. Please try again or contact support."));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        logger.info("========================================");
        logger.info("📧 Solicitud de recuperación de contraseña");
        logger.info("📧 Email solicitante: {}", email);
        logger.info("========================================");

        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);

        if (userOpt.isEmpty()) {
            logger.warn("⚠️ Intento de recuperación para email NO registrado: {}", email);
            return ResponseEntity.ok(Map.of("message", "Si el email existe, recibirás un enlace en breve."));
        }

        logger.info("✅ Email encontrado en sistema: {}", email);

        String token = UUID.randomUUID().toString();
        LocalDateTime expiry = LocalDateTime.now().plusHours(1);

        User user = userOpt.get();
        user.setResetToken(token);
        user.setResetTokenExp(expiry);
        userRepository.save(user);

        logger.info("💾 Token guardado en base de datos para usuario ID: {}", user.getId());

        try {
            emailService.sendPasswordResetEmail(email, token);
            logger.info("✅ Email enviado exitosamente a: {}", email);
        } catch (Exception e) {
            logger.error("❌ Error al enviar email a {}: {}", email, e.getMessage(), e);
        }

        logger.info("========================================");
        return ResponseEntity.ok(Map.of("message", "Si el email existe, recibirás un enlace en breve."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String newPassword = body.get("password");

        logger.info("========================================");
        logger.info("🔐 Solicitud de restablecimiento de contraseña");
        logger.info("🔑 Token recibido: {}", token);
        logger.info("========================================");

        if (token == null || token.isEmpty()) {
            logger.error("❌ Token vacío en solicitud de reset");
            return ResponseEntity.badRequest().body(Map.of("error", "Token requerido"));
        }

        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> {
                    logger.error("❌ Token inválido o no encontrado: {}", token);
                    return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token inválido");
                });

        logger.info("✅ Token válido para usuario: {}", user.getEmail());

        if (user.getResetTokenExp().isBefore(LocalDateTime.now())) {
            logger.error("❌ Token expirado. Expiración: {}, Ahora: {}", user.getResetTokenExp(), LocalDateTime.now());
            return ResponseEntity.badRequest().body(Map.of("error", "El link expiró. Solicita uno nuevo."));
        }

        String encodedPassword = passwordEncoder.encode(newPassword);
        user.setUserPassword(encodedPassword);
        user.setResetToken(null);
        user.setResetTokenExp(null);
        userRepository.save(user);

        logger.info("✅ Contraseña actualizada exitosamente para usuario: {}", user.getEmail());
        logger.info("========================================");

        return ResponseEntity.ok(Map.of("message", "Contraseña actualizada correctamente."));
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}