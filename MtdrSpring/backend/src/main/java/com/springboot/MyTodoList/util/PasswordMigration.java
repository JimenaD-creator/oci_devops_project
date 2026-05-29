package com.springboot.MyTodoList.util;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Configuration
public class PasswordMigration {

    private static final Logger logger = LoggerFactory.getLogger(PasswordMigration.class);

    @Bean
    public CommandLineRunner migratePasswords(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            List<User> users = userRepository.findAll();
            int migrated = 0;

            for (User user : users) {
                String currentPassword = user.getUserPassword();
                if (currentPassword == null || currentPassword.isBlank()) continue;

                // Si ya está encriptado con bcrypt, lo saltamos
                if (currentPassword.startsWith("$2a$") || currentPassword.startsWith("$2b$")) {
                    logger.info("⏭️  Usuario {} ya tiene bcrypt, saltando.", user.getEmail());
                    continue;
                }

                // Encriptar y guardar
                String encoded = passwordEncoder.encode(currentPassword);
                user.setUserPassword(encoded);
                userRepository.save(user);
                migrated++;
                logger.info("✅ Contraseña migrada para usuario: {}", user.getEmail());
            }

            if (migrated == 0) {
                logger.info("✅ Todas las contraseñas ya están encriptadas, nada que migrar.");
            } else {
                logger.info("🎉 Migración completada: {} contraseña(s) encriptada(s).", migrated);
            }
        };
    }
}