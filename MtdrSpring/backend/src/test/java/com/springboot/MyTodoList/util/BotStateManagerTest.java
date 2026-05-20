package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class BotStateManagerTest {

    private BotStateManager stateManager;

    @BeforeEach
    void setUp() {
        stateManager = new BotStateManager();
    }

    @Test
    void waitingForHours_roundTripsTaskAndSprintContext() {
        long chatId = 42L;
        stateManager.setWaitingForHours(chatId, 7, 3L, 99L);

        assertEquals(7, stateManager.getTaskIdWaitingForHours(chatId));
        assertEquals(3L, stateManager.getSprintIdWaitingForHours(chatId));
        assertEquals(99L, stateManager.getActingUserIdForHours(chatId));
        assertTrue(stateManager.hasPendingState(chatId));
    }

    @Test
    void waitingForNewTaskDescription_isDetected() {
        long chatId = 50L;
        stateManager.setWaitingForNewTaskDescription(chatId);

        assertTrue(stateManager.isWaitingForNewTaskDescription(chatId));
        assertFalse(stateManager.isSelectingSprint(chatId));
    }

    @Test
    void telegramSignIn_clearsConversationState() {
        long chatId = 60L;
        stateManager.setSelectingSprint(chatId);
        stateManager.setTelegramSignedInUser(chatId, 5L);

        assertTrue(stateManager.isTelegramSignedIn(chatId));
        assertEquals(5L, stateManager.getTelegramSignedInUserId(chatId));
        assertNull(stateManager.getState(chatId));
    }

    @Test
    void expiredWaitingForHours_returnsNullAndClearsOnRead() {
        long chatId = 70L;
        stateManager.setWaitingForHours(chatId, 1, 2L, null);
        BotUserState state = stateManager.getState(chatId);
        state.setTimestamp(LocalDateTime.now().minusMinutes(31));

        assertNull(stateManager.getTaskIdWaitingForHours(chatId));
        assertNull(stateManager.getState(chatId));
    }

    @Test
    void sessionLogin_storesIdentifierForPasswordStep() {
        long chatId = 80L;
        stateManager.setSessionLoginAwaitingPassword(chatId, "dev@example.com");

        assertTrue(stateManager.isSessionLoginAwaitingPassword(chatId));
        assertEquals("dev@example.com", stateManager.getSessionLoginPendingIdentifier(chatId));
    }

    @Test
    void clearPendingState_removesMyPerformanceContext() {
        long chatId = 90L;
        stateManager.setMyPerformanceUserId(chatId, 12L);
        stateManager.setSelectingMyPerformanceScope(chatId);
        stateManager.clearPendingState(chatId);

        assertNull(stateManager.getMyPerformanceUserId(chatId));
        assertFalse(stateManager.isSelectingMyPerformanceScope(chatId));
    }
}
