package com.springboot.MyTodoList.service;

import com.springboot.MyTodoList.security.SecurityUtils;
import org.springframework.stereotype.Service;

@Service
public class ProjectAccessAuthorization {

    /** Managers may only read their own managerId; admins may read any. */
    public boolean managerMayAccess(Long managerId) {
        return SecurityUtils.canAccessManagerResource(managerId);
    }

    /** Developers may only read their own userId; admins may read any. */
    public boolean developerMayAccess(Long userId) {
        return SecurityUtils.canAccessDeveloperResource(userId);
    }
}
