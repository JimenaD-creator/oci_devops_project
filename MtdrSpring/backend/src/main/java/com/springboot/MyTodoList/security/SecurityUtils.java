package com.springboot.MyTodoList.security;

import com.springboot.MyTodoList.util.UserRoleUtil;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/** Reads the authenticated user from the JWT (resource-server). */
public final class SecurityUtils {

    private SecurityUtils() {}

    public static Optional<Jwt> currentJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return Optional.empty();
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof Jwt) {
            return Optional.of((Jwt) principal);
        }
        return Optional.empty();
    }

    public static Optional<Long> currentUserId() {
        return currentJwt()
                .map(jwt -> {
                    Object claim = jwt.getClaim("userId");
                    if (claim instanceof Number) {
                        return ((Number) claim).longValue();
                    }
                    if (claim != null) {
                        try {
                            return Long.parseLong(String.valueOf(claim));
                        } catch (NumberFormatException ignored) {
                            return null;
                        }
                    }
                    String subject = jwt.getSubject();
                    if (subject == null || subject.isBlank()) {
                        return null;
                    }
                    try {
                        return Long.parseLong(subject.trim());
                    } catch (NumberFormatException ignored) {
                        return null;
                    }
                })
                .filter(id -> id != null);
    }

    public static Optional<String> currentUserRole() {
        return currentJwt()
                .map(jwt -> jwt.getClaim("role"))
                .map(String::valueOf)
                .filter(role -> !role.isBlank());
    }

    /** Managers may only access their own id; admins may access any manager id. */
    public static boolean canAccessManagerResource(Long managerId) {
        if (managerId == null) {
            return false;
        }
        if (currentUserRole().map(UserRoleUtil::isAdmin).orElse(false)) {
            return true;
        }
        return currentUserId().map(id -> id.equals(managerId)).orElse(false);
    }

    /** Developers may only access their own user id; admins may access any. */
    public static boolean canAccessDeveloperResource(Long userId) {
        if (userId == null) {
            return false;
        }
        if (currentUserRole().map(UserRoleUtil::isAdmin).orElse(false)) {
            return true;
        }
        return currentUserId().map(id -> id.equals(userId)).orElse(false);
    }
}
