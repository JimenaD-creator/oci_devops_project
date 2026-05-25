package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class BotUserStateTest {

    @Test
    void defaultConstructor_leavesFieldsNull() {
        BotUserState state = new BotUserState();

        assertNull(state.getChatId());
        assertNull(state.getState());
        assertNull(state.getTimestamp());
    }

    @Test
    void fourArgConstructor_setsCoreFieldsAndTimestamp() {
        BotUserState state = new BotUserState(100L, 7, 3L, "WAITING_FOR_HOURS");

        assertEquals(100L, state.getChatId());
        assertEquals(7, state.getTaskId());
        assertEquals(3L, state.getSprintId());
        assertEquals("WAITING_FOR_HOURS", state.getState());
        assertNotNull(state.getTimestamp());
    }

    @Test
    void fiveArgConstructor_setsSelectedUserId() {
        BotUserState state = new BotUserState(200L, null, 5L, 42L, "VIEWING_SPRINT");

        assertEquals(42L, state.getSelectedUserId());
        assertNull(state.getTaskId());
    }

    @Test
    void setState_refreshesTimestamp() {
        BotUserState state = new BotUserState();
        state.setTimestamp(LocalDateTime.of(2020, 1, 1, 0, 0));

        state.setState("SELECTING_SPRINT");

        assertEquals("SELECTING_SPRINT", state.getState());
        assertTrue(state.getTimestamp().isAfter(LocalDateTime.of(2020, 1, 1, 0, 0)));
    }

    @Test
    void credentialAndSelectionFields_roundTrip() {
        BotUserState state = new BotUserState();
        state.setTempPhoneEmail("dev@test.com");
        state.setCredentialUserBeingVerified(9L);
        state.setSelectedTaskId(15);

        assertEquals("dev@test.com", state.getTempPhoneEmail());
        assertEquals(9L, state.getCredentialUserBeingVerified());
        assertEquals(15, state.getSelectedTaskId());
    }

    @Test
    void toString_includesChatTaskAndState() {
        BotUserState state = new BotUserState(55L, 2, 8L, "LOGGED_IN");

        String text = state.toString();

        assertTrue(text.contains("chatId=55"));
        assertTrue(text.contains("taskId=2"));
        assertTrue(text.contains("state='LOGGED_IN'"));
    }
}
