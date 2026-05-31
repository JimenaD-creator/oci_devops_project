package com.springboot.MyTodoList.model;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class UserTaskTest {

    @Test
    void setStatus_fromCompletedToTodo_clearsWorkedHours() {
        User user = new User();
        user.setId(1L);
        Task task = new Task();
        task.setId(2L);
        UserTask ut = new UserTask(user, task);
        ut.setWorkedHours(4.5);
        ut.setStatus("COMPLETED");

        ut.setStatus("TODO");

        assertEquals("TODO", ut.getStatus());
        assertEquals(0.0, ut.getWorkedHours(), 0.001);
        assertNull(ut.getCompletedAt());
    }

    @Test
    void setStatus_fromTodoToCompleted_keepsWorkedHoursUntilExplicitSave() {
        User user = new User();
        user.setId(1L);
        Task task = new Task();
        task.setId(2L);
        UserTask ut = new UserTask(user, task);
        ut.setWorkedHours(2.0);
        ut.setStatus("TODO");

        ut.setStatus("COMPLETED");

        assertEquals(2.0, ut.getWorkedHours(), 0.001);
    }
}
