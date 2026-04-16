package com.springboot.MyTodoList.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "telegram.bot")
public class BotProps {
    private String username;
    private String token;

    public String getToken() {
        return token;
    }

    public String getUsername() {
        return username;
    }

    public void setToken(String tkn) {
        token = tkn;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}