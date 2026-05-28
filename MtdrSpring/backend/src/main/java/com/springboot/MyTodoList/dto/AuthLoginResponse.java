package com.springboot.MyTodoList.dto;

public class AuthLoginResponse {
    private String token;
    private AuthUserResponse user;
    /** Primary project for manager/developer (resolved server-side at login). */
    private Long projectId;
    private String projectName;

    public AuthLoginResponse(String token, AuthUserResponse user) {
        this(token, user, null, null);
    }

    public AuthLoginResponse(String token, AuthUserResponse user, Long projectId, String projectName) {
        this.token = token;
        this.user = user;
        this.projectId = projectId;
        this.projectName = projectName;
    }

    public String getToken() {
        return token;
    }

    public AuthUserResponse getUser() {
        return user;
    }

    public Long getProjectId() {
        return projectId;
    }

    public String getProjectName() {
        return projectName;
    }
}
