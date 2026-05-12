package com.springboot.MyTodoList.dto;

public class AuthLoginResponse {
    private String token;
    private AuthUserResponse user;

    public AuthLoginResponse(String token, AuthUserResponse user) {
        this.token = token;
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public AuthUserResponse getUser() {
        return user;
    }
}
