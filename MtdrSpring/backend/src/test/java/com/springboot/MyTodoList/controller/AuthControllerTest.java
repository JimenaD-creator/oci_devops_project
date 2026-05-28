package com.springboot.MyTodoList.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.dto.AuthLoginRequest;
import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.JwtService;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.UserService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private ProjectLookupService projectLookupService;

    @Test
    void login_missingFields_returnsBadRequest() throws Exception {
        AuthLoginRequest request = new AuthLoginRequest();
        request.setIdentifier("");
        request.setPassword("secret");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Identifier and password are required."));
    }

    @Test
    void login_invalidCredentials_returnsUnauthorized() throws Exception {
        when(userService.authenticateByIdentifierAndPassword(anyString(), anyString()))
                .thenReturn(Optional.empty());

        AuthLoginRequest request = new AuthLoginRequest();
        request.setIdentifier("user@test.com");
        request.setPassword("wrong");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid credentials."));
    }

    @Test
    void login_success_returnsTokenAndUser() throws Exception {
        User user = new User();
        user.setId(3L);
        user.setName("Alice");
        user.setEmail("alice@test.com");
        user.setType("DEVELOPER");

        when(userService.authenticateByIdentifierAndPassword("alice@test.com", "ok"))
                .thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn("jwt-token-123");
        Project project = new Project();
        project.setId(10L);
        project.setName("Acme");
        when(projectLookupService.findPrimaryProjectForDeveloper(3L)).thenReturn(Optional.of(project));

        AuthLoginRequest request = new AuthLoginRequest();
        request.setIdentifier("alice@test.com");
        request.setPassword("ok");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token-123"))
                .andExpect(jsonPath("$.user.id").value(3))
                .andExpect(jsonPath("$.user.name").value("Alice"))
                .andExpect(jsonPath("$.projectId").value(10))
                .andExpect(jsonPath("$.projectName").value("Acme"));
    }
}
