package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.security.SecurityUtils;
import org.springframework.stereotype.Service;

@Service
public class ProjectAccessAuthorization {

    private final ProjectLookupService projectLookupService;

    public ProjectAccessAuthorization(ProjectLookupService projectLookupService) {
        this.projectLookupService = projectLookupService;
    }

    /** Managers may only read their own managerId; admins may read any. */
    public boolean managerMayAccess(Long managerId) {
        return SecurityUtils.canAccessManagerResource(managerId);
    }

    /** Developers may only read their own userId; admins may read any. */
    public boolean developerMayAccess(Long userId) {
        return SecurityUtils.canAccessDeveloperResource(userId);
    }

    /** Authenticated user must belong to the project team (manager or developer) or be admin. */
    public boolean userMayAccessProject(Long projectId) {
        if (projectId == null) {
            return false;
        }
        if (SecurityUtils.currentUserRole().map(com.springboot.MyTodoList.util.UserRoleUtil::isAdmin).orElse(false)) {
            return true;
        }
        return SecurityUtils.currentUserId()
                .map(userId -> projectLookupService.findAllProjectsForManager(userId).stream()
                                .anyMatch(p -> projectId.equals(p.getId()))
                        || projectLookupService.findAllProjectsForDeveloper(userId).stream()
                                .anyMatch(p -> projectId.equals(p.getId())))
                .orElse(false);
    }
}
