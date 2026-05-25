package com.springboot.MyTodoList.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.UserService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = UserController.class)
@AutoConfigureMockMvc(addFilters = false)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    @Test
    void getAllUsers_returnsList() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setName("Alice");
        user.setType("DEVELOPER");
        when(userService.getAllUsers()).thenReturn(List.of(user));

        mockMvc.perform(get("/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Alice"));
    }

    @Test
    void getUserById_whenFound_returnsUser() throws Exception {
        User user = new User();
        user.setId(2L);
        user.setName("Bob");
        when(userService.getUserById(2L)).thenReturn(Optional.of(user));

        mockMvc.perform(get("/users/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Bob"));
    }

    @Test
    void getUserById_whenMissing_returnsNotFound() throws Exception {
        when(userService.getUserById(404L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/users/404")).andExpect(status().isNotFound());
    }

    @Test
    void createUser_invalidRole_returnsBadRequest() throws Exception {
        when(userService.saveUser(any(User.class)))
                .thenThrow(new RuntimeException("Rol no permitido. Solo se permite MANAGER o DEVELOPER."));

        String body = "{\"name\":\"X\",\"type\":\"ADMIN\"}";

        mockMvc.perform(post("/users/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createUser_success_returnsUser() throws Exception {
        User saved = new User();
        saved.setId(5L);
        saved.setName("Carol");
        saved.setType("MANAGER");
        when(userService.saveUser(any(User.class))).thenReturn(saved);

        String body = "{\"name\":\"Carol\",\"type\":\"MANAGER\"}";

        mockMvc.perform(post("/users/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.type").value("MANAGER"));
    }

    @Test
    void updateUser_success_returnsUpdatedUser() throws Exception {
        User updated = new User();
        updated.setId(3L);
        updated.setName("Updated");
        when(userService.updateUser(eq(3L), any(User.class))).thenReturn(updated);

        mockMvc.perform(put("/users/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated"));
    }

    @Test
    void deleteUser_returnsNoContent() throws Exception {
        mockMvc.perform(delete("/users/9")).andExpect(status().isNoContent());

        verify(userService).deleteUser(9L);
    }
}
