package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.ReplyKeyboardMarkup;
import org.telegram.telegrambots.meta.generics.TelegramClient;

import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.service.SprintService;
import com.springboot.MyTodoList.service.TelegramUserMappingService;
import com.springboot.MyTodoList.service.ToDoItemService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.service.UserTaskService;

/**
 * Unit tests for BotActions class
 * 
 * 1. Task creation flow: User selects 'Add Item' -> bot waits for description -> bot creates task
 * 2. Viewing completed tasks in a sprint: User authenticates -> bot displays sprint tasks including completed ones
 * 3. Filtering tasks by user: Ensure only tasks assigned to the authenticated user are shown
 * 
 */
@ExtendWith(MockitoExtension.class)
class BotActionsTest {

    @Mock
    private TelegramClient telegramClient;
    @Mock
    private ToDoItemService todoService;
    @Mock
    private TelegramUserMappingService telegramUserMappingService;
    @Mock
    private UserTaskService userTaskService;
    @Mock
    private SprintService sprintService;
    @Mock
    private UserService userService;

    private BotStateManager stateManager;
    private BotActions botActions;

    @BeforeEach
    void setUp() {
        // Initialize fresh instances before each test to ensure test isolation
        stateManager = new BotStateManager();
        botActions = newBotActions();
    }

     // Helper method to create BotActions with mocked dependencies
    private BotActions newBotActions() {
        return new BotActions(
                telegramClient,
                todoService,
                null,
                stateManager,
                telegramUserMappingService,
                userTaskService,
                sprintService,
                userService);
    }

    @Test
    void createTask() throws Exception {
        // Test: Verify that user can create a new task through a two-step process
        // Step 1: User clicks 'Add New Item' button -> bot waits for task description
        // Step 2: User sends free text -> bot creates task and clears the waiting state
        
        long chatId = 100L;
        // Bot requires an active session before Add New Item
        stateManager.setTelegramSignedInUser(chatId, 1L);

        // Step 1: Simulate user clicking 'Add New Item' button
        BotActions firstMessage = newBotActions();
        firstMessage.setChatId(chatId);
        firstMessage.setRequestText(BotLabels.ADD_NEW_ITEM.getLabel());
        firstMessage.fnAddItem(); 
        
        // State should indicate bot is waiting for task description input
        assertTrue(stateManager.isWaitingForNewTaskDescription(chatId));

        // Step 2: Simulate user sending the task description as free text
        BotActions secondMessage = newBotActions();
        secondMessage.setChatId(chatId);
        secondMessage.setRequestText("Buy milk"); // The actual task description
        secondMessage.fnElse(); // This should create the task since state is waiting for description

        // Verify task was created and appropriate messages were sent
        verify(todoService).addToDoItem(any(ToDoItem.class)); 
        verify(telegramClient, atLeast(2)).execute(any(SendMessage.class)); 
        assertFalse(stateManager.isWaitingForNewTaskDescription(chatId)); 
    }

    @Test
    void viewCompletedTasksInSprint() throws Exception {
        // Test: Verify that user can view completed tasks in a sprint 
        
        long chatId = 200L;
        Long sprintId = 5L;
        Long userId = 7L;
        
        // Configure bot state for password verification
        botActions.setChatId(chatId);
        botActions.setRequestText("pw"); // User's password input
        stateManager.setVerifyingCredentialsPassword(chatId, userId, sprintId, "a@b.com");
        
        // User credentials are valid
        when(userService.verifyUserCredentials(eq(userId), eq("a@b.com"), eq("pw"))).thenReturn(true);
        User signedUser = new User();
        signedUser.setId(userId);
        signedUser.setName("Dev Seven");
        when(userService.getUserById(userId)).thenReturn(Optional.of(signedUser));

        // Create a completed task in the sprint
        ToDoItem done = new ToDoItem();
        done.setID(10);
        done.setDescription("Done task");
        done.setStatus("DONE");
        when(todoService.findByAssignedSprint(Math.toIntExact(sprintId))).thenReturn(List.of(done));
        
        // User has this task assigned and completed 
        when(userTaskService.loadUserSprintTaskListIndex(userId, sprintId))
                .thenReturn(new UserTaskService.UserSprintTaskListIndex(Set.of(10L), Set.of(10L)));

        // Call password verification which should trigger task list display
        botActions.fnVerifyCredentialsPassword();

        // Verify that task list was sent to user with sprint information
        ArgumentCaptor<SendMessage> captor = ArgumentCaptor.forClass(SendMessage.class);
        verify(telegramClient, atLeast(2)).execute(captor.capture()); 
        assertTrue(captor.getAllValues().stream().anyMatch(m -> m.getText().contains("Dev Seven")));
        String listText = captor.getValue().getText(); 
        assertTrue(listText.contains("Sprint " + sprintId)); 
    }

    @Test
    void viewCompletedTasksForUserInSprint() throws Exception {
        // Test: Verify that only tasks assigned to the authenticated user are displayed
        
        long chatId = 300L;
        Long sprintId = 8L;
        Long userId = 9L;
        
        // Configure bot state for password verification
        botActions.setChatId(chatId);
        botActions.setRequestText("secret"); // User's password
        stateManager.setVerifyingCredentialsPassword(chatId, userId, sprintId, "u@u.com");
        
        // User password is valid
        when(userService.verifyUserCredentials(eq(userId), eq("u@u.com"), eq("secret"))).thenReturn(true);

        // Sprint contains two completed tasks
        ToDoItem mineDone = new ToDoItem(); // Task assigned to this user
        mineDone.setID(1);
        mineDone.setDescription("Mine");
        mineDone.setStatus("DONE");
        ToDoItem otherDone = new ToDoItem(); // Task NOT assigned to this user
        otherDone.setID(99);
        otherDone.setDescription("Other");
        otherDone.setStatus("DONE");
        when(todoService.findByAssignedSprint(Math.toIntExact(sprintId))).thenReturn(List.of(mineDone, otherDone));
        
        // User task index shows only task 1 is assigned and completed (task 99 is not in the set)
        when(userTaskService.loadUserSprintTaskListIndex(userId, sprintId))
                .thenReturn(new UserTaskService.UserSprintTaskListIndex(Set.of(1L), Set.of(1L)));

        // Call password verification which displays filtered task list
        botActions.fnVerifyCredentialsPassword();

        // Verify that only the user's assigned task appears in keyboard, other task is filtered out
        ArgumentCaptor<SendMessage> captor = ArgumentCaptor.forClass(SendMessage.class);
        verify(telegramClient, atLeast(2)).execute(captor.capture());
        String flatKeyboard = flattenKeyboard(captor.getValue()); // Flatten all keyboard buttons into single string
        assertTrue(flatKeyboard.contains("1 - ")); // User's task IS present
        assertFalse(flatKeyboard.contains("99 - ")); // Other user's task is NOT present (correctly filtered)
    }

    // Flatten keyboard markup into a single string for assertion checking
    // Extracts all button text from keyboard rows and joins them with spaces
    // Used to verify which task buttons are displayed to the user
    private static String flattenKeyboard(SendMessage msg) {
        if (!(msg.getReplyMarkup() instanceof ReplyKeyboardMarkup)) {
            return "";
        }
        ReplyKeyboardMarkup m = (ReplyKeyboardMarkup) msg.getReplyMarkup();
        return m.getKeyboard().stream()
                .flatMap(row -> row.stream())
                .map(b -> b.getText())
                .collect(Collectors.joining(" "));
    }
}
