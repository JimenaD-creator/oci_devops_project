package com.springboot.MyTodoList.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.service.ToDoItemService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = ToDoItemController.class)
@AutoConfigureMockMvc(addFilters = false)
class ToDoItemControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ToDoItemService toDoItemService;

    @Test
    void getAllToDoItems_returnsList() throws Exception {
        when(toDoItemService.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/todolist")).andExpect(status().isOk());
    }

    @Test
    void getToDoItemById_whenFound_returnsOk() throws Exception {
        ToDoItem item = new ToDoItem();
        item.setID(1);
        when(toDoItemService.getToDoItemById(1)).thenReturn(item);

        mockMvc.perform(get("/todolist/1")).andExpect(status().isOk());
    }

    @Test
    void getToDoItemById_whenMissing_returnsNotFound() throws Exception {
        when(toDoItemService.getToDoItemById(99)).thenReturn(null);

        mockMvc.perform(get("/todolist/99")).andExpect(status().isNotFound());
    }

    @Test
    void addToDoItem_returnsCreated() throws Exception {
        ToDoItem saved = new ToDoItem();
        saved.setID(5);
        when(toDoItemService.addToDoItem(any(ToDoItem.class))).thenReturn(saved);

        mockMvc.perform(post("/todolist")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"test task\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("location", "5"));
    }

    @Test
    void updateToDoItem_whenFound_returnsOk() throws Exception {
        ToDoItem updated = new ToDoItem();
        updated.setID(3);
        when(toDoItemService.updateToDoItem(eq(3), any(ToDoItem.class))).thenReturn(updated);

        mockMvc.perform(put("/todolist/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"updated\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void deleteToDoItem_whenDeleted_returnsOk() throws Exception {
        when(toDoItemService.deleteToDoItem(4)).thenReturn(true);

        mockMvc.perform(delete("/todolist/4")).andExpect(status().isOk());
    }
}
