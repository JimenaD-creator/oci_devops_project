package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class UserRoleUtilTest {

    @Test
    void isDeveloper_acceptsGenericAndSpecializedLabels() {
        assertTrue(UserRoleUtil.isDeveloper("DEVELOPER"));
        assertTrue(UserRoleUtil.isDeveloper("frontend developer"));
        assertTrue(UserRoleUtil.isDeveloper("Backend Developer"));
        assertTrue(UserRoleUtil.isDeveloper("DevOps Engineer"));
        assertFalse(UserRoleUtil.isDeveloper("MANAGER"));
        assertFalse(UserRoleUtil.isDeveloper("ADMIN"));
    }

    @Test
    void normalizeDisplayType_titleCasesSpecializedDeveloperRoles() {
        assertEquals("Frontend Developer", UserRoleUtil.normalizeDisplayType("frontend developer"));
        assertEquals("MANAGER", UserRoleUtil.normalizeDisplayType("manager"));
        assertEquals("DEVELOPER", UserRoleUtil.normalizeDisplayType("developer"));
    }

    @Test
    void isAllowedMemberType_allowsManagerAndDeveloperVariants() {
        assertTrue(UserRoleUtil.isAllowedMemberType("Frontend Developer"));
        assertTrue(UserRoleUtil.isAllowedMemberType("DevOps Engineer"));
        assertTrue(UserRoleUtil.isAllowedMemberType("QA Engineer"));
        assertTrue(UserRoleUtil.isAllowedMemberType("MANAGER"));
        assertFalse(UserRoleUtil.isAllowedMemberType("ADMIN"));
    }

    @Test
    void sidebarAccessLabel_mapsTeamRolesToDeveloper() {
        assertEquals("Developer", UserRoleUtil.sidebarAccessLabel("Frontend Developer"));
        assertEquals("Developer", UserRoleUtil.sidebarAccessLabel("DevOps Engineer"));
        assertEquals("Manager", UserRoleUtil.sidebarAccessLabel("MANAGER"));
    }
}
