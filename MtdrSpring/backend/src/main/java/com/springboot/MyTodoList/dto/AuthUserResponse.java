package com.springboot.MyTodoList.dto;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.util.UserRoleUtil;

public class AuthUserResponse {
    private Long id;
    private String name;
    private String role;
    private String profilePicture;

    public AuthUserResponse(User user) {
        this.id = user.getId();
        this.name = user.getName();
        this.role = UserRoleUtil.normalizeDisplayType(user.getType());
        this.profilePicture = user.getProfilePicture();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }

    public String getProfilePicture() {
        return profilePicture;
    }
}
