package com.springboot.MyTodoList.controller;

import com.springboot.MyTodoList.dto.AuthLoginRequest;
import com.springboot.MyTodoList.dto.AuthLoginResponse;
import com.springboot.MyTodoList.dto.AuthUserResponse;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.UserRepository;
import com.springboot.MyTodoList.service.EmailService;
import com.springboot.MyTodoList.service.JwtService;
import com.springboot.MyTodoList.service.UserService;

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
@CrossOrigin(origins = "http://localhost:3000")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final UserService userService;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    public AuthController(UserService userService, JwtService jwtService,
                          UserRepository userRepository, EmailService emailService,
                          PasswordEncoder passwordEncoder) {
        this.userService = userService;
        this.jwtService = jwtService;
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

        Optional<User> authenticatedUser = userService.authenticateByIdentifierAndPassword(
                request.getIdentifier(),
                request.getPassword());

        if (authenticatedUser.isEmpty()) {
            logger.warn("⚠️ Login fallido: credenciales inválidas para identifier: {}", request.getIdentifier());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid credentials."));
        }

        User user = authenticatedUser.get();
        String token = jwtService.generateToken(user);
        logger.info("✅ Login exitoso para usuario: {} (ID: {})", user.getEmail(), user.getId());
        
        return ResponseEntity.ok(new AuthLoginResponse(token, new AuthUserResponse(user)));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        logger.info("========================================");
        logger.info("📧 Solicitud de recuperación de contraseña");
        logger.info("📧 Email solicitante: {}", email);
        logger.info("========================================");

        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        
        // Respuesta genérica por seguridad — no revela si el email existe
        if (userOpt.isEmpty()) {
            logger.warn("⚠️ Intento de recuperación para email NO registrado: {}", email);
            logger.info("📧 Respuesta genérica: 'Si el email existe, recibirás un enlace'");
            return ResponseEntity.ok(Map.of("message", "Si el email existe, recibirás un enlace en breve."));
        }

        logger.info("✅ Email encontrado en sistema: {}", email);
        
        String token = UUID.randomUUID().toString();
        LocalDateTime expiry = LocalDateTime.now().plusHours(1);
        
        logger.info("🔑 Token generado: {}", token);
        logger.info("⏰ Token válido hasta: {}", expiry);

        User user = userOpt.get();
        user.setResetToken(token);
        user.setResetTokenExp(expiry);
        userRepository.save(user);
        
        logger.info("💾 Token guardado en base de datos para usuario ID: {}", user.getId());

        try {
            logger.info("🚀 Intentando enviar email de recuperación...");
            emailService.sendPasswordResetEmail(email, token);
            logger.info("✅ Email enviado exitosamente a: {}", email);
        } catch (Exception e) {
            logger.error("❌ Error al enviar email a {}: {}", email, e.getMessage(), e);
            // No lanzamos excepción para mantener respuesta genérica por seguridad
        }

        logger.info("📧 Respuesta: 'Si el email existe, recibirás un enlace'");
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
        logger.info("⏰ Token expira en: {}", user.getResetTokenExp());

        if (user.getResetTokenExp().isBefore(LocalDateTime.now())) {
            logger.error("❌ Token expirado. Expiración: {}, Ahora: {}", user.getResetTokenExp(), LocalDateTime.now());
            return ResponseEntity.badRequest().body(Map.of("error", "El link expiró. Solicita uno nuevo."));
        }

        logger.info("✅ Token vigente. Procediendo a actualizar contraseña...");
        
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