package com.springboot.MyTodoList.dto;

public class AuthLoginResponse {
    private String token;
    private AuthUserResponse user;
    /** Primary project for manager/developer (resolved server-side at login). */
    private Long projectId;
    private String projectName;

    public AuthLoginResponse() {}

    public AuthLoginResponse(String token, AuthUserResponse user) {
        this.token = token;
        this.user = user;
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

    public void setToken(String token) {
        this.token = token;
    }

    public AuthUserResponse getUser() {
        return user;
    }

    public void setUser(AuthUserResponse user) {
        this.user = user;
    }

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }
}
