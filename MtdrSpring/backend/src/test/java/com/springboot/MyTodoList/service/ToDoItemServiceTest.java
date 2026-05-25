package com.springboot.MyTodoList.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.model.UserTask;
import com.springboot.MyTodoList.repository.ToDoItemRepository;
import com.springboot.MyTodoList.repository.UserTaskRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class ToDoItemServiceTest {

    @Mock
    private ToDoItemRepository toDoItemRepository;

    @Mock
    private UserTaskRepository userTaskRepository;

    @Mock
    private TaskAssignmentSyncService taskAssignmentSyncService;

    @InjectMocks
    private ToDoItemService toDoItemService;

    @Test
    void findByAssignedSprint_delegatesToRepository() {
        when(toDoItemRepository.findByAssignedSprint(3)).thenReturn(List.of());

        assertEquals(0, toDoItemService.findByAssignedSprint(3).size());
    }

    @Test
    void addToDoItem_appliesDefaults() {
        ToDoItem input = new ToDoItem();
        input.setDescription("Buy milk");
        when(toDoItemRepository.save(any(ToDoItem.class))).thenAnswer(inv -> {
            ToDoItem t = inv.getArgument(0);
            t.setID(1);
            return t;
        });

        ToDoItem saved = toDoItemService.addToDoItem(input);

        assertNotNull(saved.getStartDate());
        assertNotNull(saved.getDueDate());
        assertEquals(1, saved.getAssignedSprint());
        assertEquals("PENDING", saved.getStatus());
        assertNotNull(saved.getTitle());
    }

    @Test
    void getItemById_whenMissing_returnsNotFound() {
        when(toDoItemRepository.findById(9)).thenReturn(Optional.empty());

        assertEquals(HttpStatus.NOT_FOUND, toDoItemService.getItemById(9).getStatusCode());
    }

    @Test
    void deleteToDoItem_whenExists_returnsTrue() {
        when(toDoItemRepository.existsById(5)).thenReturn(true);

        assertTrue(toDoItemService.deleteToDoItem(5));
        verify(toDoItemRepository).deleteById(5);
    }

    @Test
    void deleteToDoItem_whenMissing_returnsFalse() {
        when(toDoItemRepository.existsById(6)).thenReturn(false);

        assertFalse(toDoItemService.deleteToDoItem(6));
    }

    @Test
    void updateToDoItem_markDone_syncsUserTasks() {
        ToDoItem existing = new ToDoItem();
        existing.setID(7);
        existing.setDone(false);
        existing.setDescription("old");

        ToDoItem patch = new ToDoItem();
        patch.setDescription("new");
        patch.setDone(true);

        when(toDoItemRepository.findById(7)).thenReturn(Optional.of(existing));
        when(toDoItemRepository.save(any(ToDoItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userTaskRepository.findByTask_Id(7L)).thenReturn(List.of(new UserTask()));

        ToDoItem result = toDoItemService.updateToDoItem(7, patch);

        assertNotNull(result);
        assertTrue(result.isDone());
        verify(userTaskRepository).save(any(UserTask.class));
        verify(taskAssignmentSyncService).syncTaskStatusFromAssignments(7L);
    }

    @Test
    void updateTaskStatusOnly_delegatesToRepository() {
        when(toDoItemRepository.updateStatusOnly(8, "DONE")).thenReturn(1);

        assertTrue(toDoItemService.updateTaskStatusOnly(8, "DONE"));
    }
}
