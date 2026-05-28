package com.springboot.MyTodoList.util;

import java.util.Locale;

/**
 * Classifies {@link com.springboot.MyTodoList.model.User#type} for access control vs display labels.
 * Access: ADMIN, MANAGER, or any other team role (e.g. Frontend Developer, DevOps Engineer).
 */
public final class UserRoleUtil {

    private UserRoleUtil() {
    }

    public static boolean isAdmin(String type) {
        return type != null && type.trim().equalsIgnoreCase("ADMIN");
    }

    public static boolean isManager(String type) {
        return type != null && type.trim().equalsIgnoreCase("MANAGER");
    }

    /** Team member with developer UI (any role except ADMIN / MANAGER). */
    public static boolean isDeveloper(String type) {
        if (type == null || type.isBlank()) {
            return true;
        }
        return !isAdmin(type) && !isManager(type);
    }

    /** Types allowed when registering/editing team members (not ADMIN). */
    public static boolean isAllowedMemberType(String type) {
        return type != null && !type.isBlank() && !isAdmin(type);
    }

    public static boolean isDeveloperUser(com.springboot.MyTodoList.model.User user) {
        return user != null && isDeveloper(user.getType());
    }

    /**
     * Stable label stored in USERS.TYPE and shown in the UI.
     */
    public static String normalizeDisplayType(String type) {
        if (type == null || type.isBlank()) {
            return "DEVELOPER";
        }
        String t = type.trim();
        if (isAdmin(t)) {
            return "ADMIN";
        }
        if (isManager(t)) {
            return "MANAGER";
        }
        if (t.equalsIgnoreCase("DEVELOPER")) {
            return "DEVELOPER";
        }
        return toTitleCaseWords(t);
    }

    /** Short label for app chrome (sidebar); team roles map to "Developer". */
    public static String sidebarAccessLabel(String type) {
        if (isAdmin(type)) {
            return "Admin";
        }
        if (isManager(type)) {
            return "Manager";
        }
        return "Developer";
    }

    private static String toTitleCaseWords(String value) {
        String[] parts = value.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                sb.append(' ');
            }
            String p = parts[i];
            if (p.isEmpty()) {
                continue;
            }
            sb.append(Character.toUpperCase(p.charAt(0)));
            if (p.length() > 1) {
                sb.append(p.substring(1).toLowerCase(Locale.ROOT));
            }
        }
        return sb.toString();
    }
}
