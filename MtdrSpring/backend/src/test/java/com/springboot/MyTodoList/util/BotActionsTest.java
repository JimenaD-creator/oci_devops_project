package com.springboot.MyTodoList.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
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

import com.springboot.MyTodoList.model.Project;
import com.springboot.MyTodoList.model.Sprint;
import com.springboot.MyTodoList.model.Team;
import com.springboot.MyTodoList.model.TeamMember;
import com.springboot.MyTodoList.model.ToDoItem;
import com.springboot.MyTodoList.model.User;
import com.springboot.MyTodoList.repository.TeamMembersRepository;
import com.springboot.MyTodoList.repository.TeamRepository;
import com.springboot.MyTodoList.service.ProjectLookupService;
import com.springboot.MyTodoList.service.SprintService;
import com.springboot.MyTodoList.service.TelegramUserMappingService;
import com.springboot.MyTodoList.service.ToDoItemService;
import com.springboot.MyTodoList.service.UserService;
import com.springboot.MyTodoList.service.UserTaskService;

// Unit tests for BotActions.
// 1. developerCannotAddTaskFromMenu — developers are blocked from the add-task flow.
// 2. viewCompletedTasksInSprint — manager: completed tasks for the sprint appear on the list; sprint chooser after Back.
// 3. viewCompletedTasksForUserInSprint — developer: completed tasks for that user in the sprint.
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
    @Mock
    private ProjectLookupService projectLookupService;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private TeamMembersRepository teamMembersRepository;

    private BotStateManager stateManager;
    private BotActions botActions;

    @BeforeEach
    void setUp() {
        stateManager = new BotStateManager();
        botActions = newBotActions();
    }

    // BotActions wired to the mocks above.
    private BotActions newBotActions() {
        BotActions actions = new BotActions(
                telegramClient,
                todoService,
                null,
                stateManager,
                telegramUserMappingService,
                userTaskService,
                sprintService,
                userService);
        actions.setProjectLookupService(projectLookupService);
        actions.setTeamRepository(teamRepository);
        actions.setTeamMembersRepository(teamMembersRepository);
        return actions;
    }

    // Developers cannot add tasks from the bot; only managers use the add-task flow.
    @Test
    void developerCannotAddTaskFromMenu() throws Exception {
        long chatId = 100L;
        Long devId = 1L;
        stateManager.setTelegramSignedInUser(chatId, devId);

        User dev = new User();
        dev.setId(devId);
        dev.setType("DEVELOPER");
        when(userService.getUserById(devId)).thenReturn(Optional.of(dev));

        BotActions firstMessage = newBotActions();
        firstMessage.setChatId(chatId);
        firstMessage.setRequestText(BotLabels.ADD_NEW_ITEM.getLabel());
        firstMessage.fnAddItem();

        assertFalse(stateManager.isWaitingForNewTaskDescription(chatId));
        verify(todoService, never()).addToDoItem(any(ToDoItem.class));
        verify(telegramClient, atLeast(1)).execute(any(SendMessage.class));
    }

    @Test
    void createTaskManagerPicksSprintAssigneeAndDescription() throws Exception {
        long chatId = 101L;
        Long managerId = 10L;
        Long projectId = 1L;
        Long sprintId = 5L;
        Long devId = 20L;

        stateManager.setTelegramSignedInUser(chatId, managerId);

        User manager = new User();
        manager.setId(managerId);
        manager.setType("MANAGER");
        when(userService.getUserById(managerId)).thenReturn(Optional.of(manager));

        Project project = new Project();
        project.setId(projectId);
        when(projectLookupService.findPrimaryProjectForManager(managerId)).thenReturn(Optional.of(project));

        Sprint sprint = new Sprint();
        sprint.setId(sprintId);
        when(sprintService.findByProjectIdOrderByStartDateAsc(projectId)).thenReturn(List.of(sprint));
        when(sprintService.findById(sprintId)).thenReturn(sprint);

        Team team = new Team();
        team.setId(99L);
        when(teamRepository.findByManagerId(managerId)).thenReturn(Optional.of(team));

        User dev = new User();
        dev.setId(devId);
        dev.setName("Alice Dev");
        TeamMember tm = new TeamMember();
        tm.setUser(dev);
        when(teamMembersRepository.findByTeam_Id(99L)).thenReturn(List.of(tm));
        when(userService.getUserById(devId)).thenReturn(Optional.of(dev));

        ToDoItem saved = new ToDoItem();
        saved.setID(777);
        when(todoService.addToDoItem(any(ToDoItem.class))).thenAnswer(inv -> {
            ToDoItem item = inv.getArgument(0);
            item.setID(777);
            return item;
        });

        BotActions add = newBotActions();
        add.setChatId(chatId);
        add.setRequestText(BotLabels.ADD_NEW_ITEM.getLabel());
        add.fnAddItem();
        assertTrue(stateManager.isSelectingSprintForNewTask(chatId));

        BotActions pickSprint = newBotActions();
        pickSprint.setChatId(chatId);
        pickSprint.setRequestText("Sprint " + sprintId);
        pickSprint.fnSelectSprintForNewTask();
        assertTrue(stateManager.isSelectingAssigneeForNewTask(chatId));

        BotActions pickDev = newBotActions();
        pickDev.setChatId(chatId);
        pickDev.setRequestText("👤 Alice Dev #" + devId);
        pickDev.fnSelectAssigneeForNewTask();
        assertTrue(stateManager.isWaitingForNewTaskDescription(chatId));

        BotActions desc = newBotActions();
        desc.setChatId(chatId);
        desc.setRequestText("Ship login fix");
        desc.fnElse();

        ArgumentCaptor<ToDoItem> itemCaptor = ArgumentCaptor.forClass(ToDoItem.class);
        verify(todoService).addToDoItem(itemCaptor.capture());
        assertEquals(Math.toIntExact(sprintId), itemCaptor.getValue().getAssignedSprint());
        verify(userTaskService).assignUserToTaskAsTodo(devId, 777L);
        assertFalse(stateManager.isWaitingForNewTaskDescription(chatId));
    }

    // Manager: completed tasks for the sprint show on the keyboard with done markers; Back returns the sprint chooser.
    @Test
    void viewCompletedTasksInSprint() throws Exception {
        long chatId = 200L;
        Long sprintId = 5L;
        Long managerId = 7L;
        Long projectId = 17L;

        botActions.setChatId(chatId);
        botActions.setRequestText("pw");
        stateManager.setVerifyingCredentialsPassword(chatId, managerId, sprintId, "mgr@x.com");

        when(userService.verifyUserCredentials(eq(managerId), eq("mgr@x.com"), eq("pw"))).thenReturn(true);

        User manager = new User();
        manager.setId(managerId);
        manager.setType("MANAGER");
        when(userService.getUserById(managerId)).thenReturn(Optional.of(manager));

        ToDoItem doneA = new ToDoItem();
        doneA.setID(20);
        doneA.setDescription("Alice done");
        doneA.setStatus("DONE");
        ToDoItem doneB = new ToDoItem();
        doneB.setID(30);
        doneB.setDescription("Bob done");
        doneB.setStatus("DONE");
        ToDoItem doneC = new ToDoItem();
        doneC.setID(40);
        doneC.setDescription("Carol done");
        doneC.setStatus("DONE");
        when(todoService.findByAssignedSprint(Math.toIntExact(sprintId))).thenReturn(List.of(doneA, doneB, doneC));

        botActions.fnVerifyCredentialsPassword();

        verify(userTaskService, never()).loadUserSprintTaskListIndex(anyLong(), anyLong());

        ArgumentCaptor<SendMessage> captor = ArgumentCaptor.forClass(SendMessage.class);
        verify(telegramClient, atLeast(2)).execute(captor.capture());
        SendMessage taskListMsg = captor.getValue();
        assertTrue(taskListMsg.getText().contains("all team tasks"));
        assertTrue(taskListMsg.getText().contains("Sprint " + sprintId));
        String taskKeyboard = flattenKeyboard(taskListMsg);
        assertFalse(taskKeyboard.contains("20 - "));
        assertTrue(taskKeyboard.contains("Alice done"));
        assertTrue(taskKeyboard.contains("Bob done"));
        assertTrue(taskKeyboard.contains("Carol done"));
        // Split layout: status column shows "✅ Done" per completed task (not inline in title).
        assertEquals(4, taskKeyboard.split(Pattern.quote("\u2705 Done"), -1).length);

        Project managerProject = new Project();
        managerProject.setId(projectId);
        Sprint s5 = new Sprint();
        s5.setId(5L);
        Sprint s6 = new Sprint();
        s6.setId(6L);
        when(projectLookupService.findPrimaryProjectForManager(managerId)).thenReturn(Optional.of(managerProject));
        when(sprintService.findByProjectIdOrderByStartDateAsc(projectId)).thenReturn(List.of(s5, s6));

        BotActions backToSprints = newBotActions();
        backToSprints.setChatId(chatId);
        backToSprints.setRequestText("⬅️ Back to Sprints");
        backToSprints.fnViewSprintTasks();

        ArgumentCaptor<SendMessage> captor2 = ArgumentCaptor.forClass(SendMessage.class);
        verify(telegramClient, atLeast(3)).execute(captor2.capture());
        SendMessage pickerMsg = captor2.getValue();
        String sprintPicker = flattenKeyboard(pickerMsg);
        assertTrue(sprintPicker.contains("Sprint 5"));
        assertTrue(sprintPicker.contains("Sprint 6"));
    }

    // Developer: for that sprint, completed tasks on the keyboard are only the ones tied to that user.
    @Test
    void viewCompletedTasksForUserInSprint() throws Exception {
        long chatId = 300L;
        Long sprintId = 8L;
        Long developerId = 9L;

        User developer = new User();
        developer.setId(developerId);
        developer.setType("DEVELOPER");
        when(userService.getUserById(developerId)).thenReturn(Optional.of(developer));

        botActions.setChatId(chatId);
        botActions.setRequestText("secret");
        stateManager.setVerifyingCredentialsPassword(chatId, developerId, sprintId, "u@u.com");
        when(userService.verifyUserCredentials(eq(developerId), eq("u@u.com"), eq("secret"))).thenReturn(true);

        ToDoItem mineDoneA = new ToDoItem();
        mineDoneA.setID(1);
        mineDoneA.setDescription("My first done");
        mineDoneA.setStatus("DONE");
        ToDoItem mineDoneB = new ToDoItem();
        mineDoneB.setID(2);
        mineDoneB.setDescription("My second done");
        mineDoneB.setStatus("DONE");
        ToDoItem otherDone = new ToDoItem();
        otherDone.setID(99);
        otherDone.setDescription("Someone else done");
        otherDone.setStatus("DONE");
        when(todoService.findByAssignedSprint(Math.toIntExact(sprintId)))
                .thenReturn(List.of(mineDoneA, mineDoneB, otherDone));

        when(userTaskService.loadUserSprintTaskListIndex(developerId, sprintId))
                .thenReturn(new UserTaskService.UserSprintTaskListIndex(Set.of(1L, 2L), Set.of(1L, 2L)));

        botActions.fnVerifyCredentialsPassword();

        verify(userTaskService, times(1)).loadUserSprintTaskListIndex(eq(developerId), eq(sprintId));

        ArgumentCaptor<SendMessage> captor = ArgumentCaptor.forClass(SendMessage.class);
        verify(telegramClient, atLeast(2)).execute(captor.capture());
        SendMessage taskList = captor.getValue();
        String text = taskList.getText();
        assertTrue(text.contains("Your tasks"));
        assertTrue(text.contains("Sprint " + sprintId));
        assertFalse(text.contains("All Completed tasks"));

        String keys = flattenKeyboard(taskList);
        assertFalse(keys.contains("1 - "));
        assertFalse(keys.contains("2 - "));
        assertTrue(keys.contains("My first done"));
        assertTrue(keys.contains("My second done"));
        assertFalse(keys.contains("99 - "));
        assertFalse(keys.contains("Someone else done"));

        assertEquals(3, keys.split(Pattern.quote("\u2705 Done"), -1).length);
    }

    @Test
    void managerSprintPicker_showsOnlyOwnProjectSprints() throws Exception {
        long chatId = 400L;
        Long managerId = 11L;
        Long ownProjectId = 21L;

        stateManager.setTelegramSignedInUser(chatId, managerId);

        User manager = new User();
        manager.setId(managerId);
        manager.setType("MANAGER");
        when(userService.getUserById(managerId)).thenReturn(Optional.of(manager));

        Project ownProject = new Project();
        ownProject.setId(ownProjectId);
        when(projectLookupService.findPrimaryProjectForManager(managerId)).thenReturn(Optional.of(ownProject));

        Sprint ownSprintA = new Sprint();
        ownSprintA.setId(101L);
        Sprint ownSprintB = new Sprint();
        ownSprintB.setId(102L);
        when(sprintService.findByProjectIdOrderByStartDateAsc(ownProjectId)).thenReturn(List.of(ownSprintA, ownSprintB));

        BotActions openSprintPicker = newBotActions();
        openSprintPicker.setChatId(chatId);
        openSprintPicker.setRequestText(BotCommands.TODO_LIST.getCommand());
        openSprintPicker.fnListAll();

        ArgumentCaptor<SendMessage> captor = ArgumentCaptor.forClass(SendMessage.class);
        verify(telegramClient, atLeast(2)).execute(captor.capture());
        SendMessage pickerMsg = captor.getValue();
        String sprintPicker = flattenKeyboard(pickerMsg);

        assertTrue(sprintPicker.contains("Sprint 101"));
        assertTrue(sprintPicker.contains("Sprint 102"));
        assertFalse(sprintPicker.contains("Sprint 201"));
    }

    @Test
    void blockedReasonSubmission_returnsToSprintTasks() throws Exception {
        long chatId = 500L;
        Long developerId = 15L;
        Long sprintId = 9L;
        Integer taskId = 321;

        stateManager.setTelegramSignedInUser(chatId, developerId);
        stateManager.setWaitingForBlockedReason(chatId, taskId, developerId);

        ToDoItem task = new ToDoItem();
        task.setID(taskId);
        task.setAssignedSprint(Math.toIntExact(sprintId));
        task.setDescription("Blocked API dependency");
        task.setStatus("BLOCKED");
        when(todoService.getToDoItemById(taskId)).thenReturn(task);
        when(todoService.findByAssignedSprint(Math.toIntExact(sprintId))).thenReturn(List.of(task));
        when(userTaskService.loadUserSprintTaskListIndex(developerId, sprintId))
                .thenReturn(new UserTaskService.UserSprintTaskListIndex(Set.of(taskId.longValue()), Set.of()));

        BotActions submitReason = newBotActions();
        submitReason.setChatId(chatId);
        submitReason.setRequestText("Waiting on external API credentials");
        submitReason.fnElse();

        verify(userTaskService).saveBlockedReason(developerId, taskId.longValue(), "Waiting on external API credentials");
        assertTrue(stateManager.isViewingSprintTasks(chatId));
        assertEquals(sprintId, stateManager.getViewingSprintId(chatId));
        assertEquals(developerId, stateManager.getViewingSelectedUserId(chatId));
    }

    @Test
    void decimalHoursSubmission_savesViaUserTaskService() throws Exception {
        long chatId = 600L;
        Long developerId = 15L;
        Integer taskId = 42;

        stateManager.setTelegramSignedInUser(chatId, developerId);
        stateManager.setWaitingForHours(chatId, taskId, null, developerId);

        BotActions submitHours = newBotActions();
        submitHours.setChatId(chatId);
        submitHours.setRequestText("1.5");
        submitHours.fnElse();

        verify(userTaskService).saveWorkedHours(eq(developerId), eq(42L), eq(1.5));
        assertFalse(stateManager.hasPendingState(chatId));

        ArgumentCaptor<SendMessage> captor = ArgumentCaptor.forClass(SendMessage.class);
        verify(telegramClient, atLeast(1)).execute(captor.capture());
        assertTrue(captor.getValue().getText().contains("1.5 hours recorded"));
    }

    @Test
    void decimalHoursSubmission_acceptsCommaSeparator() throws Exception {
        long chatId = 601L;
        Long developerId = 16L;
        Integer taskId = 43;

        stateManager.setTelegramSignedInUser(chatId, developerId);
        stateManager.setWaitingForHours(chatId, taskId, null, developerId);

        BotActions submitHours = newBotActions();
        submitHours.setChatId(chatId);
        submitHours.setRequestText("1,5");
        submitHours.fnElse();

        verify(userTaskService).saveWorkedHours(eq(developerId), eq(43L), eq(1.5));
    }

    // All reply-keyboard button captions in one string (for assertions).
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
