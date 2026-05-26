package com.springboot.MyTodoList.dto;

import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.util.UserRoleUtil;

public class AuthUserResponse {
    private Long id;
    private String name;
    /** Raw USERS.TYPE from the database. */
    private String type;
    /** Display label (e.g. Frontend Developer). */
    private String role;
    private String profilePicture;

    public AuthUserResponse(User user) {
        this.id = user.getId();
        this.name = user.getName();
        this.type = user.getType();
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

    public String getType() {
        return type;
    }

    public String getProfilePicture() {
        return profilePicture;
    }
}
