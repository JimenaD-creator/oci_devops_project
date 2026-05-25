package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;

@ExtendWith(MockitoExtension.class)
class JwtServiceTest {

    @Mock
    private JwtEncoder jwtEncoder;

    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService(jwtEncoder, 60L);
    }

    @Test
    void generateToken_returnsEncodedValue() {
        Jwt jwt = org.mockito.Mockito.mock(Jwt.class);
        when(jwt.getTokenValue()).thenReturn("signed-jwt-token");
        when(jwtEncoder.encode(any())).thenReturn(jwt);

        User user = new User();
        user.setId(10L);
        user.setName("Test User");
        user.setType("MANAGER");

        String token = jwtService.generateToken(user);

        assertNotNull(token);
        assertEquals("signed-jwt-token", token);
    }

    @Test
    void generateToken_defaultsRoleWhenTypeMissing() {
        Jwt jwt = org.mockito.Mockito.mock(Jwt.class);
        when(jwt.getTokenValue()).thenReturn("token");
        when(jwtEncoder.encode(any())).thenReturn(jwt);

        User user = new User();
        user.setId(1L);
        user.setName("Dev");

        assertEquals("token", jwtService.generateToken(user));
    }
}
